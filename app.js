(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const root = $('#app');
  const modal = $('#modal');
  const service = window.RestaurantService;
  const config = window.RestaurantConfig;
  const demo = config.mode === 'demo';
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => new Intl.NumberFormat('en-CA', { style: 'currency', currency: config.currency }).format(value);
  const dayKey = value => new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  const dateLabel = value => new Date(value).toLocaleString('en-CA', { timeZone: config.timeZone });
  const today = () => dayKey(new Date());
  const shiftDay = (value, delta) => { const date = new Date(value + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); };
  const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } };
  const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Continue in memory. */ } };
  const state = { role: 'customer', page: 'menu', name: 'Guest', menu: [], categories: [], orders: [], cart: [], mine: readLocal('tt.my-orders', []), search: '', category: 'all', status: 'active', orderSearch: '', start: shiftDay(today(), -6), end: today(), busy: false };

  function notify(message, error = false) {
    $('#message').textContent = message;
    $('#message').className = error ? 'error' : '';
  }
  function navItems() {
    if (state.role === 'customer') return [['menu', 'Menu'], ['myorders', 'My orders']];
    if (state.role === 'staff') return [['orders', 'Orders'], ['manage', 'Manage menu']];
    return [['dashboard', 'Sales report'], ['orders', 'Orders'], ['manage', 'Manage menu']];
  }
  function render() {
    $('#session').innerHTML = demo
      ? 'Demo role: ' + ['customer', 'staff', 'manager'].map(role => `<button data-action="role" data-role="${role}" aria-pressed="${state.role === role}">${role}</button>`).join(' ')
      : `${e(state.name)} (${e(state.role)}) <button data-action="${state.role === 'customer' ? 'login' : 'logout'}">${state.role === 'customer' ? 'Staff / manager sign in' : 'Sign out'}</button>`;
    $('#navigation').innerHTML = navItems().map(([page, label]) => `<button data-action="nav" data-page="${page}" ${state.page === page ? 'aria-current="page"' : ''}>${label}</button>`).join('');
    $('#mode-label').textContent = demo ? 'Demo data saved in this browser. ' : 'Restaurant Management';
    $('#reset-demo').hidden = !demo;
    const title = navItems().find(([page]) => page === state.page)[1];
    let content = '';
    if (state.page === 'menu') content = customerMenu();
    if (state.page === 'myorders') content = myOrders();
    if (state.page === 'orders') content = orderBoard();
    if (state.page === 'manage') content = manageMenu();
    if (state.page === 'dashboard') content = dashboard();
    root.innerHTML = `<div class="toolbar"><h2>${title}</h2><button data-action="refresh">Refresh</button></div>${content}`;
  }
  function menuFilter() {
    return `<form id="menu-filter" class="toolbar">
      <label>Search<input type="search" name="search" value="${e(state.search)}"></label>
      <label>Category<select name="category">${[{ id: 'all', name: 'All' }, ...state.categories].map(c => `<option value="${c.id}" ${String(c.id) === String(state.category) ? 'selected' : ''}>${e(c.name)}</option>`).join('')}</select></label>
      <button type="submit">Search</button>
    </form>`;
  }
  function filteredMenu() {
    return state.menu.filter(item => (state.category === 'all' || String(item.categoryId) === state.category)
      && (item.name + ' ' + item.description).toLowerCase().includes(state.search.toLowerCase()));
  }
  function figure(id) {
    return `<span class="figure-placeholder">figure${e(id)}</span>`;
  }
  function customerMenu() {
    return `<section>${menuFilter()}<div class="table-scroll"><table>
      <thead><tr><th>Dish</th><th>Description</th><th>Price</th><th>Order</th></tr></thead>
      <tbody>${filteredMenu().map(item => `<tr><td>${figure(item.id)}${e(item.name)}</td><td>${e(item.description)}</td><td>${money(item.price)}</td><td>${item.available ? `<button data-action="add" data-id="${item.id}">Add</button><button data-action="customize" data-id="${item.id}">Quantity / notes</button>` : 'Unavailable'}</td></tr>`).join('') || '<tr><td colspan="4">No matching dishes.</td></tr>'}</tbody>
    </table></div></section>${cartPanel()}`;
  }
  function cartTotal() {
    return state.cart.reduce((sum, line) => sum + Math.round(line.unitPrice * 100) * line.quantity, 0) / 100;
  }
  function cartPanel() {
    return `<section><h2>Cart</h2>${state.cart.length ? `<div class="table-scroll"><table>
      <thead><tr><th>Dish</th><th>Quantity</th><th>Subtotal</th><th>Actions</th></tr></thead>
      <tbody>${state.cart.map(line => `<tr><td>${figure(line.menuItemId)}${e(line.name)}<small>${e(line.notes)}</small></td><td>
        <button data-action="quantity" data-id="${line.menuItemId}" data-delta="-1" aria-label="Decrease quantity of ${e(line.name)}">-</button> ${line.quantity}
        <button data-action="quantity" data-id="${line.menuItemId}" data-delta="1" aria-label="Increase quantity of ${e(line.name)}" ${line.quantity >= 20 ? 'disabled' : ''}>+</button>
      </td><td>${money(line.unitPrice * line.quantity)}</td><td><button data-action="customize" data-id="${line.menuItemId}">Edit</button><button data-action="remove" data-id="${line.menuItemId}">Remove</button></td></tr>`).join('')}</tbody>
      </table></div>` : '<p>Cart is empty.</p>'}
      <p>Total: <strong>${money(cartTotal())}</strong></p>
      <button data-action="checkout" ${state.cart.length ? '' : 'disabled'}>Place order</button>
      <p>Prices in CAD. No payment is collected.</p></section>`;
  }
  function myOrders() {
    const orders = demo ? state.orders.filter(order => state.mine.includes(String(order.id))) : state.orders;
    return orders.map(order => orderCard(order, false)).join('') || '<p>No orders yet.</p>';
  }
  function orderCard(order, operator) {
    const actions = operator ? window.RestaurantTransitions[order.status] || [] : [];
    return `<article class="order"><h3>Order #${e(order.id)} - ${e(order.status)}</h3>
      <p>${e(order.customerName)} | ${e(dateLabel(order.date))}</p>
      <ul>${order.items.map(item => `<li>${item.quantity} x ${e(item.name)} - ${money(item.unitPrice * item.quantity)}${item.notes ? `<br>Notes: ${e(item.notes)}` : ''}</li>`).join('')}</ul>
      <p>Total: ${money(order.totalAmount)}</p>
      <div class="actions">${actions.map(status => `<button data-action="status" data-id="${order.id}" data-status="${status}">${status === 'Cancelled' ? 'Cancel order' : 'Mark ' + status.toLowerCase()}</button>`).join('')}</div>
    </article>`;
  }
  function orderBoard() {
    const orders = state.orders.filter(order => (state.status === 'all' || (state.status === 'active' ? ['Pending', 'Preparing', 'Ready'].includes(order.status) : order.status === state.status))
      && (String(order.id) + ' ' + order.customerName).toLowerCase().includes(state.orderSearch.toLowerCase()));
    return `<form id="order-filter" class="toolbar">
      <label>Order / customer<input type="search" name="search" value="${e(state.orderSearch)}"></label>
      <label>Status<select name="status">${['active', 'all', 'Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'].map(status => `<option ${status === state.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
      <button type="submit">Search</button>
    </form>${orders.map(order => orderCard(order, true)).join('') || '<p>No matching orders.</p>'}`;
  }
  function manageMenu() {
    return `<button data-action="new-item">Add menu item</button>${menuFilter()}
      <div class="table-scroll"><table><thead><tr><th>Dish</th><th>Category</th><th>Price</th><th>Availability</th><th>Actions</th></tr></thead>
      <tbody>${filteredMenu().map(item => `<tr><td>${figure(item.id)}${e(item.name)}<small>${e(item.description)}</small></td><td>${e(state.categories.find(c => c.id === item.categoryId)?.name)}</td><td>${money(item.price)}</td><td><button data-action="availability" data-id="${item.id}">${item.available ? 'Available' : 'Unavailable'}</button></td><td><button data-action="edit-item" data-id="${item.id}">Edit</button><button data-action="delete-item" data-id="${item.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5">No matching dishes.</td></tr>'}</tbody>
    </table></div>`;
  }
  function reportOrders() {
    return state.orders.filter(order => dayKey(order.date) >= state.start && dayKey(order.date) <= state.end);
  }
  function dashboard() {
    const orders = reportOrders();
    const completed = orders.filter(order => order.status === 'Completed');
    const total = completed.reduce((sum, order) => sum + Math.round(order.totalAmount * 100), 0) / 100;
    const items = {};
    for (const order of completed) {
      for (const line of order.items) {
        if (!items[line.menuItemId]) items[line.menuItemId] = { name: line.name, quantity: 0, sales: 0 };
        items[line.menuItemId].quantity += line.quantity;
        items[line.menuItemId].sales += Math.round(line.unitPrice * 100) * line.quantity;
      }
    }
    const popular = Object.values(items).sort((a, b) => b.quantity - a.quantity);
    const daily = [];
    for (let day = state.start; day <= state.end; day = shiftDay(day, 1)) {
      const sales = completed.filter(order => dayKey(order.date) === day);
      daily.push(`<tr><td>${day}</td><td>${sales.length}</td><td>${money(sales.reduce((sum, order) => sum + Math.round(order.totalAmount * 100), 0) / 100)}</td></tr>`);
    }
    return `<form id="report-filter" class="toolbar">
      <label>From<input type="date" name="start" value="${state.start}" required></label>
      <label>To<input type="date" name="end" value="${state.end}" required></label>
      <button type="submit">Apply dates</button><button type="button" data-action="week">Last 7 days</button>
      <button type="button" data-action="export">Export CSV</button>
    </form><p>Orders: ${orders.length} | Completed: ${completed.length} | Sales: ${money(total)}</p>
    <p>Average completed order: ${money(completed.length ? total / completed.length : 0)} | Cancelled: ${orders.filter(order => order.status === 'Cancelled').length}</p>
    <p>Sales include completed orders only. Timezone: ${e(config.timeZone)}.</p>
    <h3>Daily sales</h3><div class="table-scroll"><table><thead><tr><th>Date</th><th>Completed orders</th><th>Sales</th></tr></thead><tbody>${daily.join('')}</tbody></table></div>
    <h3>Popular dishes</h3><div class="table-scroll"><table><thead><tr><th>Dish</th><th>Quantity sold</th><th>Sales</th></tr></thead>
    <tbody>${popular.map(item => `<tr><td>${e(item.name)}</td><td>${item.quantity}</td><td>${money(item.sales / 100)}</td></tr>`).join('') || '<tr><td colspan="3">No completed sales.</td></tr>'}</tbody></table></div>
    <h3>Orders in this period</h3><div class="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th></tr></thead>
    <tbody>${orders.map(order => `<tr><td>#${e(order.id)}</td><td>${e(order.customerName)}</td><td>${e(dateLabel(order.date))}</td><td>${e(order.status)}</td><td>${money(order.totalAmount)}</td></tr>`).join('') || '<tr><td colspan="5">No orders in this period.</td></tr>'}</tbody></table></div>`;
  }
  function showModal(content) {
    modal.innerHTML = `<button class="close-dialog" data-action="close-modal">Close</button>${content}`;
    if (!modal.open) modal.showModal();
  }
  function formError(message) {
    const target = modal.querySelector('.form-error');
    if (target) { target.textContent = message; target.hidden = false; }
    else notify(message, true);
  }
  const errorSlot = '<p class="form-error" role="alert" hidden></p>';
  function customize(id) {
    const item = state.menu.find(item => item.id === Number(id));
    if (!item?.available) return notify('This dish is unavailable.', true);
    const line = state.cart.find(line => line.menuItemId === item.id);
    showModal(`<h2 id="modal-title">${e(item.name)}</h2>${figure(item.id)}<p>${money(item.price)} each</p>
      <form id="customize-form"><input type="hidden" name="id" value="${item.id}">
      <label>Quantity<input name="quantity" type="number" min="1" max="20" value="${line?.quantity || 1}" required></label>
      <label>Notes (optional)<textarea name="notes" maxlength="200" rows="3">${e(line?.notes || '')}</textarea></label>
      ${errorSlot}<button type="submit">Save to cart</button></form>`);
  }
  function checkout() {
    if (!state.cart.length) return;
    showModal(`<h2 id="modal-title">Place order</h2><p>Total: ${money(cartTotal())}</p>
      <form id="checkout-form"><label>Name<input name="customerName" autocomplete="name" maxlength="80" required></label>
      <label>Email (optional)<input type="email" name="customerEmail" autocomplete="email" maxlength="254"></label>
      ${errorSlot}<button type="submit">Confirm order</button></form>`);
  }
  function editItem(id) {
    const item = state.menu.find(item => item.id === Number(id)) || { name: '', description: '', price: '', categoryId: state.categories[0]?.id, available: true };
    showModal(`<h2 id="modal-title">${item.id ? 'Edit' : 'Add'} menu item</h2><form id="menu-form">
      <input name="id" type="hidden" value="${item.id || ''}">
      <label>Name<input name="name" value="${e(item.name)}" maxlength="80" required></label>
      <label>Description<textarea name="description" rows="3" maxlength="300">${e(item.description)}</textarea></label>
      <label>Category<select name="categoryId" required>${state.categories.map(c => `<option value="${c.id}" ${c.id === item.categoryId ? 'selected' : ''}>${e(c.name)}</option>`).join('')}</select></label>
      <label>Price (CAD)<input type="number" name="price" min="0" max="9999.99" step="0.01" value="${item.price}" required></label>
      <label><input type="checkbox" name="available" ${item.available ? 'checked' : ''}> Available</label>
      ${errorSlot}<button type="submit">Save</button></form>`);
  }
  async function refresh() {
    // Customers must receive only their own orders from a real backend.
    const [menu, categories, orders] = await Promise.all([service.getMenu(), service.getCategories(), service.listOrders()]);
    if (!Array.isArray(menu) || !Array.isArray(categories) || !Array.isArray(orders)) throw new Error('Unexpected server response. Check the service.js mappings.');
    state.menu = menu; state.categories = categories; state.orders = orders;
    // Do not silently submit unavailable products or stale prices after a menu change.
    const removed = state.cart.filter(line => !menu.some(item => item.id === line.menuItemId && item.available));
    state.cart = state.cart.filter(line => menu.some(item => item.id === line.menuItemId && item.available));
    let pricesChanged = false;
    state.cart.forEach(line => { const item = menu.find(p => p.id === line.menuItemId); if (line.unitPrice !== item.price) pricesChanged = true; line.unitPrice = item.price; line.name = item.name; });
    if (removed.length) notify('Unavailable dishes were removed from your order. Please review your cart.');
    else if (pricesChanged) notify('Menu prices changed. Please review the updated subtotal.');
    render();
  }
  function add(id) {
    const item = state.menu.find(p => p.id === Number(id));
    if (!item?.available) return;
    const line = state.cart.find(l => l.menuItemId === item.id);
    if (line && line.quantity >= 20) return notify('Maximum 20 of each dish per order.', true);
    if (line) line.quantity++;
    else state.cart.push({ menuItemId: item.id, name: item.name, unitPrice: item.price, quantity: 1, notes: '' });
    render(); notify(`${item.name} added to your order.`);
  }
  function changePage(page) {
    if (!navItems().some(([value]) => value === page)) return;
    notify('');
    state.page = page; state.search = ''; state.category = 'all'; state.orderSearch = ''; render();
    $('#main')?.focus(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function exportCsv() {
    const rows = [['Order ID', 'Customer', 'Placed at (ISO)', 'Status', 'Items subtotal (CAD)', 'Included in completed-order sales'], ...reportOrders().map(o => [o.id, o.customerName, o.date, o.status, Number(o.totalAmount).toFixed(2), o.status === 'Completed' ? 'Yes' : 'No'])];
    const cell = value => { const text = String(value); return `"${(/^(?:[\t\r\n]|\s*[=+@\-])/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; };
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `restaurant-orders-${state.start}-to-${state.end}.csv`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Report exported for the selected dates.');
  }
  function login() {
    showModal('<h2 id="modal-title">Staff / manager sign in</h2><form id="login-form"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label>' + errorSlot + '<button type="submit">Sign in</button></form>');
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]'); if (!button || button.disabled) return;
    event.preventDefault(); const action = button.dataset.action; const id = Number(button.dataset.id);
    if (state.busy) return;
    try {
      switch (action) {
        case 'nav': changePage(button.dataset.page); break;
        case 'role': {
          if (!demo) break;
          notify('');
          state.busy = true; await service.switchRole(button.dataset.role); const session = await service.getSession(); state.role = session.role; state.name = session.name; state.page = navItems()[0][0]; state.search = ''; state.category = 'all'; state.status = 'active'; await refresh(); break;
        }
        case 'add': add(id); break;
        case 'customize': customize(id); break;
        case 'quantity': { const line = state.cart.find(l => l.menuItemId === id); if (!line) break; line.quantity = Math.min(20, line.quantity + Number(button.dataset.delta)); if (line.quantity <= 0) state.cart = state.cart.filter(l => l !== line); render(); break; }
        case 'remove': state.cart = state.cart.filter(line => line.menuItemId !== id); render(); break;
        case 'checkout': checkout(); break;
        case 'close-modal': modal.close(); break;
        case 'refresh': state.busy = true; button.disabled = true; await refresh(); notify('Workspace refreshed.'); break;
        case 'status': {
          const status = button.dataset.status;
          if (status === 'Cancelled') { showModal(`<h2 id="modal-title">Cancel order #${id}?</h2><p>The order will stay in history and be excluded from completed-order sales.</p><div class="actions"><button data-action="close-modal">Keep order</button><button data-action="confirm-cancel" data-id="${id}">Cancel order</button></div>`); break; }
          state.busy = true; button.disabled = true; await service.updateOrderStatus(id, status); await refresh(); notify(`Order #${id} is now ${status.toLowerCase()}.`); break;
        }
        case 'confirm-cancel': state.busy = true; button.disabled = true; await service.updateOrderStatus(id, 'Cancelled'); modal.close(); await refresh(); notify(`Order #${id} cancelled.`); break;
        case 'new-item': editItem(); break;
        case 'edit-item': editItem(id); break;
        case 'availability': { state.busy = true; button.disabled = true; const item = state.menu.find(p => p.id === id); await service.saveMenuItem({ ...item, available: !item.available }); await refresh(); notify('Menu availability updated.'); break; }
        case 'delete-item': { const item = state.menu.find(p => p.id === id); showModal(`<h2 id="modal-title">Remove ${e(item.name)}?</h2><p>If this dish appears in past orders, the demo marks it unavailable to preserve order history. Otherwise it is deleted.</p><div class="actions"><button data-action="close-modal">Keep item</button><button data-action="confirm-delete" data-id="${id}">Remove item</button></div>`); break; }
        case 'confirm-delete': { state.busy = true; button.disabled = true; const result = await service.deleteMenuItem(id); modal.close(); await refresh(); notify(result?.archived ? 'Dish marked unavailable. Order history is preserved.' : 'Menu item deleted.'); break; }
        case 'week': state.start = shiftDay(today(), -6); state.end = today(); render(); break;
        case 'export': exportCsv(); break;
        case 'reset': if (demo) showModal(`<h2 id="modal-title">Reset demo?</h2><p>This removes demo changes, your cart, and your order tracking list in this browser. Original sample data will be restored.</p><div class="actions"><button data-action="close-modal">Keep my changes</button><button data-action="confirm-reset">Reset demo</button></div>`); break;
        case 'confirm-reset': if (demo) { state.busy = true; button.disabled = true; await service.reset(); state.cart = []; state.mine = []; writeLocal('tt.my-orders', []); modal.close(); await refresh(); notify('Demo data restored.'); } break;
        case 'login': login(); break;
        case 'logout': state.busy = true; await service.logout(); state.role = 'customer'; state.name = 'Guest'; state.page = 'menu'; state.cart = []; await refresh(); break;
      }
    } catch (error) { notify(error.message || 'Something went wrong. Please try again.', true); }
    finally { state.busy = false; if (button.isConnected) button.disabled = false; }
  });
  document.addEventListener('submit', async event => {
    const form = event.target;
    const formId = form.getAttribute('id');
    if (!['customize-form', 'checkout-form', 'menu-form', 'report-filter', 'login-form', 'menu-filter', 'order-filter'].includes(formId)) return;
    event.preventDefault(); if (state.busy) return;
    const values = new FormData(form); const submit = form.querySelector('[type="submit"]');
    try {
      if (formId === 'menu-filter') {
        state.search = String(values.get('search')).trim();
        state.category = String(values.get('category'));
        render();
      } else if (formId === 'order-filter') {
        state.orderSearch = String(values.get('search')).trim();
        state.status = String(values.get('status'));
        render();
      } else if (formId === 'customize-form') {
        const item = state.menu.find(p => p.id === Number(values.get('id'))); const quantity = Number(values.get('quantity'));
        if (!item?.available || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Choose an available item and a quantity from 1 to 20.');
        state.cart = state.cart.filter(line => line.menuItemId !== item.id);
        state.cart.push({ menuItemId: item.id, name: item.name, unitPrice: item.price, quantity, notes: String(values.get('notes')).trim() }); modal.close(); render(); notify('Cart updated.');
      } else if (formId === 'checkout-form') {
        state.busy = true; submit.disabled = true; submit.textContent = 'Placing your order…';
        const order = await service.createOrder({ customerName: String(values.get('customerName')).trim(), customerEmail: String(values.get('customerEmail')).trim(), items: state.cart.map(({ menuItemId, quantity, notes }) => ({ menuItemId, quantity, notes })) });
        state.cart = []; state.mine.unshift(String(order.id)); writeLocal('tt.my-orders', state.mine); state.page = 'myorders';
        state.orders = [order, ...state.orders.filter(o => o.id !== order.id)]; render();
        showModal(`<h2 id="modal-title">Order placed</h2><p>Order #${e(order.id)}: ${e(order.status)}</p><p>Total: ${money(order.totalAmount)}</p><button data-action="close-modal">OK</button>`);
        try { await refresh(); } catch (_) { notify(`Order #${order.id} was placed. Live status could not refresh; try Refresh shortly.`, true); }
      } else if (formId === 'menu-form') {
        state.busy = true; submit.disabled = true;
        await service.saveMenuItem({ id: values.get('id') ? Number(values.get('id')) : undefined, categoryId: Number(values.get('categoryId')), name: values.get('name'), description: values.get('description'), price: Number(values.get('price')), available: values.has('available') }); modal.close(); await refresh(); notify('Menu item saved.');
      } else if (formId === 'report-filter') {
        const start = String(values.get('start')); const end = String(values.get('end'));
        if (!start || !end || start > end) throw new Error('Choose a start date on or before the end date.');
        if ((new Date(end) - new Date(start)) / 86400000 > 365) throw new Error('Choose a reporting period of at most 366 days.');
        state.start = start; state.end = end; render();
      } else if (formId === 'login-form' && !demo) {
        state.busy = true; submit.disabled = true; const session = await service.login(values.get('email'), values.get('password'));
        if (!['staff', 'manager'].includes(session.role)) throw new Error('This account does not have staff access.');
        state.role = session.role; state.name = session.name; state.page = navItems()[0][0]; modal.close(); await refresh();
      }
    } catch (error) {
      if (formId === 'report-filter') notify(error.message, true); else formError(error.message || 'Unable to save. Please try again.');
      if (formId === 'checkout-form' && submit.isConnected) submit.textContent = 'Confirm order';
    } finally { state.busy = false; if (submit?.isConnected) submit.disabled = false; }
  });
  // Receive changes from another tab when demo storage is available.
  window.addEventListener('storage', event => { if (demo && event.key === 'comp4150.table-and-thyme.v1') window.location.reload(); });
  async function init() {
    try {
      const session = await service.getSession();
      if (!['customer', 'staff', 'manager'].includes(session.role)) throw new Error('Unknown session role returned by backend.');
      state.role = session.role; state.name = session.name || 'Guest'; state.page = navItems()[0][0]; await refresh();
    } catch (error) {
      root.innerHTML = `<div><h1>Unable to load data.</h1><p>${e(error.message)}</p><p>Check the connection and backend configuration, then reload.</p><button id="retry-load">Try again</button></div>`;
      $('#retry-load').addEventListener('click', init);
    }
  }
  init();
})();
