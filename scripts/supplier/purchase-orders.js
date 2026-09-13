function supplierOrdersApp() {
  return {
    openModal: null,
    activeOrder: null,
    expectedDeliveryDate: '',
    deliveryNotes: '',

    init() {
      supplierHighlightNav();
    },

    getActiveOrders() {
      const activeStatuses = ['Order Placed', 'Order Confirmed', 'Out for Delivery'];
      return Alpine.store('supplier').orders
        .filter(o => activeStatuses.includes(o.status))
        .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1));
    },

    openConfirmModal(order) {
      this.activeOrder = order;
      this.expectedDeliveryDate = order.expectedDate || '';
      this.openModal = 'confirm';
    },

    openDispatchModal(order) {
      this.activeOrder = order;
      this.deliveryNotes = '';
      this.openModal = 'dispatch';
    },

    async confirmOrder() {
      const store = Alpine.store('supplier');
      if (!this.activeOrder || !this.expectedDeliveryDate) return;
      const result = await store.post('confirmOrder.php', {
        id: this.activeOrder.reference,
        expectedDeliveryDate: this.expectedDeliveryDate
      });
      if (!result.success) {
        alert(result.message || 'Failed to confirm order.');
        return;
      }
      await store.refresh();
      this.openModal = null;
    },

    async markOutForDelivery() {
      const store = Alpine.store('supplier');
      if (!this.activeOrder) return;
      const result = await store.post('markOutForDelivery.php', {
        id: this.activeOrder.reference,
        deliveryNotes: this.deliveryNotes
      });
      if (!result.success) {
        alert(result.message || 'Failed to update order.');
        return;
      }
      await store.refresh();
      this.openModal = null;
    }
  };
}
