/* All data access lives here. The GUI never connects directly to MySQL. */
(function () {
  'use strict';
  const config = window.RestaurantConfig;
  const key = 'comp4150.table-and-thyme.v1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const cents = value => Math.round(Number(value) * 100);
  let volatileStore;
  let sessionRole = 'customer';
  let csrfToken = '';
  const transitions = {
    Pending: ['Preparing', 'Cancelled'], Preparing: ['Ready', 'Cancelled'],
    Ready: ['Completed'], Completed: [], Cancelled: []
  };
  function load() {
    if (volatileStore) return copy(volatileStore);
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      if (parsed && [1, 2].includes(parsed.version) && Array.isArray(parsed.menu) && Array.isArray(parsed.orders) && Array.isArray(parsed.categories)) {
        if (parsed.version === 1) {
          // Rename the existing sample data without resetting orders or prices.
          const seed = window.RestaurantSeed();
          for (const item of parsed.menu) {
            const sample = seed.menu.find(sample => sample.id === item.id);
            if (sample) { item.name = sample.name; item.description = sample.description; }
          }
          for (const category of parsed.categories) category.name = `category${category.id}`;
          for (const order of parsed.orders) {
            for (const item of order.items) {
              if (seed.menu.some(sample => sample.id === item.menuItemId)) item.name = `dish${item.menuItemId}`;
            }
            const sample = seed.orders.find(sample => sample.id === order.id && sample.customerId === order.customerId);
            if (sample) order.customerName = sample.customerName;
          }
          parsed.version = 2;
          save(parsed);
        }
        return parsed;
      }
    } catch (_) { /* Storage may be unavailable in private/file browsing. */ }
    const seed = window.RestaurantSeed();
    save(seed);
    return copy(seed);
  }
  function save(data) {
    // Persist before returning success; retain a working in-memory demo if storage is blocked.
    volatileStore = copy(data);
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { /* Memory-only fallback. */ }
  }
  function requireOperator() {
    if (!['staff', 'manager'].includes(sessionRole)) throw new Error('Switch to an operator role for this demo action.');
  }
  async function request(path, options = {}) {
    const response = await fetch(config.apiBaseUrl.replace(/\/$/, '') + path, {
      credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.message || `Request failed (${response.status}).`);
    return body;
  }
  const api = {
    async getSession() { const value = await request('/session'); csrfToken = value.csrfToken || ''; sessionRole = value.role; return value; },
    async login(email, password) { const value = await request('/session', { method: 'POST', body: JSON.stringify({ email, password }) }); csrfToken = value.csrfToken || ''; sessionRole = value.role; return value; },
    async logout() { await request('/session', { method: 'DELETE' }); csrfToken = ''; sessionRole = 'customer'; },
    async getMenu() { return request('/menu'); },
    async getCategories() { return request('/categories'); },
    async listOrders() { return request('/orders'); },
    async createOrder(payload) { return request('/orders', { method: 'POST', body: JSON.stringify(payload) }); },
    async updateOrderStatus(id, status) { return request(`/orders/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
    async saveMenuItem(item) { return request(item.id ? `/menu/${encodeURIComponent(item.id)}` : '/menu', { method: item.id ? 'PUT' : 'POST', body: JSON.stringify(item) }); },
    async deleteMenuItem(id) { return request(`/menu/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  };
  const demo = {
    async getSession() { return { role: sessionRole, name: sessionRole === 'customer' ? 'Guest' : sessionRole === 'staff' ? 'Demo staff' : 'Demo manager' }; },
    async switchRole(role) { if (!['customer', 'staff', 'manager'].includes(role)) throw new Error('Unknown role.'); sessionRole = role; },
    async getMenu() { return copy(load().menu); },
    async getCategories() { return copy(load().categories); },
    async listOrders() { return copy(load().orders).sort((a, b) => new Date(b.date) - new Date(a.date)); },
    async createOrder(payload) {
      const data = load();
      const name = String(payload.customerName || '').trim();
      if (!name || name.length > 80) throw new Error('Enter a name of 1–80 characters.');
      const email = String(payload.customerEmail || '').trim();
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email, or leave it blank.');
      if (!Array.isArray(payload.items) || !payload.items.length) throw new Error('Add an item before placing your order.');
      const seen = new Set();
      const items = payload.items.map(item => {
        const product = data.menu.find(p => p.id === Number(item.menuItemId));
        if (!product || !product.available) throw new Error('An item is no longer available. Please refresh the menu.');
        if (seen.has(product.id)) throw new Error('Combine quantities for the same menu item.');
        seen.add(product.id);
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new Error('Quantity must be between 1 and 20.');
        if (String(item.notes || '').length > 200) throw new Error('Keep item instructions within 200 characters.');
        return { menuItemId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price, notes: String(item.notes || '').trim() };
      });
      const order = {
        id: data.nextOrderId++, customerId: null, customerName: name, customerEmail: email,
        date: new Date().toISOString(), status: 'Pending', staffId: null, items,
        totalAmount: items.reduce((sum, item) => sum + cents(item.unitPrice) * item.quantity, 0) / 100
      };
      data.orders.unshift(order); save(data); return copy(order);
    },
    async updateOrderStatus(id, status) {
      requireOperator();
      const data = load(); const order = data.orders.find(o => o.id === Number(id));
      if (!order) throw new Error('Order not found.');
      if (!transitions[order.status]?.includes(status)) throw new Error('This status change is no longer available. Refresh the order.');
      order.status = status; order.staffId = 1; save(data); return copy(order);
    },
    async saveMenuItem(input) {
      requireOperator(); const data = load();
      const item = { id: input.id ? Number(input.id) : data.nextMenuId, categoryId: Number(input.categoryId), name: String(input.name || '').trim(), description: String(input.description || '').trim(), price: Number(input.price), available: Boolean(input.available) };
      if (!item.name || item.name.length > 80) throw new Error('Menu name must be 1–80 characters.');
      if (!data.categories.some(c => c.id === item.categoryId)) throw new Error('Choose an existing category.');
      if (!Number.isFinite(item.price) || item.price < 0 || item.price > 9999.99 || Math.abs(item.price * 100 - Math.round(item.price * 100)) > 0.000001) throw new Error('Enter a valid price with up to two decimal places.');
      const index = data.menu.findIndex(p => p.id === item.id);
      if (input.id && index < 0) throw new Error('Menu item not found.');
      if (index >= 0) { data.menu[index] = item; }
      else { data.menu.push(item); data.nextMenuId++; }
      save(data); return copy(item);
    },
    async deleteMenuItem(id) {
      requireOperator(); const data = load();
      const item = data.menu.find(p => p.id === Number(id));
      if (!item) throw new Error('Menu item not found.');
      if (data.orders.some(o => o.items.some(i => i.menuItemId === item.id))) {
        item.available = false; save(data); return { archived: true };
      }
      data.menu = data.menu.filter(p => p.id !== item.id); save(data); return { archived: false };
    },
    async reset() { const data = window.RestaurantSeed(); save(data); }
  };
  window.RestaurantService = config.mode === 'api' ? api : demo;
  window.RestaurantTransitions = Object.freeze(transitions);
})();
