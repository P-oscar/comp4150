/* Fictional menu and transactions for the offline GUI demonstration. */
window.RestaurantSeed = function () {
  const menu = [
    { id: 1, categoryId: 1, name: 'dish1', description: 'description1', price: 14.50, available: true },
    { id: 2, categoryId: 2, name: 'dish2', description: 'description2', price: 16, available: true },
    { id: 3, categoryId: 3, name: 'dish3', description: 'description3', price: 7.50, available: true },
    { id: 4, categoryId: 3, name: 'dish4', description: 'description4', price: 11, available: true },
    { id: 5, categoryId: 4, name: 'dish5', description: 'description5', price: 6, available: true },
    { id: 6, categoryId: 5, name: 'dish6', description: 'description6', price: 8, available: true },
    { id: 7, categoryId: 4, name: 'dish7', description: 'description7', price: 4.50, available: true },
    { id: 8, categoryId: 2, name: 'dish8', description: 'description8', price: 17.50, available: false }
  ];
  const categories = [{ id: 1, name: 'category1' }, { id: 2, name: 'category2' }, { id: 3, name: 'category3' }, { id: 4, name: 'category4' }, { id: 5, name: 'category5' }];
  const names = ['customer1', 'customer2', 'customer3', 'customer4', 'customer5', 'customer6'];
  const orders = Array.from({ length: 32 }, (_, i) => {
    const day = i < 6 ? 0 : 1 + Math.floor((i - 6) / 4);
    const date = new Date(Date.now() - day * 86400000 - (i % 6) * 18 * 60000);
    const product = menu[i % 7];
    const extra = menu[4];
    const items = [{ menuItemId: product.id, name: product.name, quantity: 1 + (i % 3 === 0 ? 1 : 0), unitPrice: product.price, notes: '' }];
    if (i % 2 === 0) items.push({ menuItemId: extra.id, name: extra.name, quantity: 1, unitPrice: extra.price, notes: '' });
    return {
      id: 1042 - i, customerId: i + 1, customerName: names[i % names.length], customerEmail: '',
      date: date.toISOString(), status: i === 0 ? 'Pending' : i === 1 ? 'Preparing' : i === 2 ? 'Ready' : i === 8 ? 'Cancelled' : 'Completed',
      staffId: i === 0 ? null : 1, items,
      totalAmount: Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100
    };
  });
  return { version: 2, menu, categories, orders, nextOrderId: 1043, nextMenuId: 9 };
};
