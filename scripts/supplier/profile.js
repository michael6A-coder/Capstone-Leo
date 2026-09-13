function supplierProfileApp() {
  return {
    saved: false,

    init() {
      supplierHighlightNav();
    },

    async saveProfile() {
      const store = Alpine.store('supplier');
      const result = await store.post('saveProfile.php', {
        companyName: store.profile.companyName,
        contactPerson: store.profile.contactPerson,
        phone: store.profile.phone,
        address: store.profile.address
      });
      if (!result.success) {
        alert(result.message || 'Failed to update profile.');
        return;
      }
      await store.refresh();
      this.saved = true;
      setTimeout(() => { this.saved = false; }, 2500);
    }
  };
}
