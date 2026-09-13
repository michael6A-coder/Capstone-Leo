function adminDefaultItemForm() {
  return { name: '', branchId: '', stock: 0, minQty: 5, costPrice: 0, salePrice: null, supplier: '' };
}

function adminInventoryApp() {
  return {
    inventoryFilterBranch: 'all',
    showInactiveItems: false,

    openItemModal: false,
    editingItemId: null,
    itemForm: adminDefaultItemForm(),

    orderFormItem: '',
    orderFormQty: 1,
    orderFormSupplierId: '',

    init() {
      adminHighlightNav();
    },

    getFilteredInventory() {
      const store = Alpine.store('admin');
      let list = store.inventory;
      if (this.inventoryFilterBranch !== 'all') list = list.filter(i => i.branchId === this.inventoryFilterBranch);
      if (!this.showInactiveItems) list = list.filter(i => i.isActive);
      return list;
    },

    openAddItemModal() {
      this.editingItemId = null;
      this.itemForm = adminDefaultItemForm();
      this.openItemModal = true;
    },

    openEditItem(item) {
      this.editingItemId = item.id;
      this.itemForm = { ...item, supplier: item.supplier || '' };
      this.openItemModal = true;
    },

    async saveItem() {
      const store = Alpine.store('admin');
      const result = await store.post('saveInventoryItem.php', {
        id: this.editingItemId || '',
        name: this.itemForm.name,
        branchId: this.itemForm.branchId,
        stock: this.itemForm.stock,
        minQty: this.itemForm.minQty,
        costPrice: this.itemForm.costPrice,
        salePrice: this.itemForm.salePrice === null || this.itemForm.salePrice === '' ? '' : this.itemForm.salePrice,
        supplier: this.itemForm.supplier
      });
      if (!result.success) {
        alert(result.message || 'Failed to save inventory item.');
        return;
      }
      await store.refresh();
      this.openItemModal = false;
    },

    async incrementStock(itemId, delta) {
      const store = Alpine.store('admin');
      const result = await store.post('adjustStock.php', { id: itemId, delta });
      if (!result.success) {
        alert(result.message || 'Failed to adjust stock.');
        return;
      }
      await store.refresh();
    },

    async toggleItemActive(item) {
      const goingActive = !item.isActive;
      if (!goingActive && !confirm(`Deactivate "${item.name}"? It will be hidden from active use but its history is kept and this can be undone.`)) return;
      const store = Alpine.store('admin');
      const result = await store.post('toggleInventoryItemActive.php', { id: item.id, active: goingActive ? 1 : 0 });
      if (!result.success) {
        alert(result.message || 'Failed to update item status.');
        return;
      }
      await store.refresh();
    },

    getTargetBranchFromOrderForm() {
      const store = Alpine.store('admin');
      if (!this.orderFormItem) return '—';
      const item = store.inventory.find(i => i.id === this.orderFormItem);
      return item ? store.getBranchName(item.branchId) : '—';
    },

    async placeSupplierOrder() {
      const store = Alpine.store('admin');
      if (!this.orderFormItem) return;
      const result = await store.post('placeSupplierOrder.php', {
        itemId: this.orderFormItem,
        qty: this.orderFormQty,
        supplierId: this.orderFormSupplierId || ''
      });
      if (!result.success) {
        alert(result.message || 'Failed to place supplier order.');
        return;
      }
      await store.refresh();
      this.orderFormItem = '';
      this.orderFormQty = 1;
      this.orderFormSupplierId = '';
    },

    async advanceOrderStatus(orderId) {
      const store = Alpine.store('admin');
      const result = await store.post('advanceOrderStatus.php', { id: orderId });
      if (!result.success) {
        alert(result.message || 'Failed to update order status.');
        return;
      }
      await store.refresh();
    }
  };
}
