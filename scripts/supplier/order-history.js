function supplierHistoryApp() {
  return {
    filterStatus: 'All',

    init() {
      supplierHighlightNav();
    },

    getFilteredOrders() {
      let list = Alpine.store('supplier').orders;
      if (this.filterStatus !== 'All') list = list.filter(o => o.status === this.filterStatus);
      return [...list].sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
    }
  };
}
