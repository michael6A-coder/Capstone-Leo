function supplierDashboardApp() {
  return {
    init() {
      supplierHighlightNav();
    },

    getRecentOrders() {
      return [...Alpine.store('supplier').orders]
        .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1))
        .slice(0, 10);
    }
  };
}
