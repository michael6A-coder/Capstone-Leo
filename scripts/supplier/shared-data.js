/* Shared live data + helpers for the Leo Mejillano Supplier Portal.
   Loaded on every pages/supplier/*.html page before that page's own script.
   Populates an Alpine.store('supplier') from the real backend
   (backend/supplier/getDashboardData.php) and refreshes it after every
   mutation, so edits on one page are visible after navigating to another.
   Same pattern as scripts/admin/shared-data.js. */

const SUPPLIER_API_BASE = '../../backend/supplier/';

document.addEventListener('alpine:init', () => {
  Alpine.store('supplier', {
    loading: true,
    profile: { supplierId: null, companyName: '', contactPerson: '', phone: '', email: '', address: '' },
    orders: [],
    counts: { newOrders: 0, confirmed: 0, outForDelivery: 0, completed: 0 },

    async refresh() {
      try {
        const response = await fetch(SUPPLIER_API_BASE + 'getDashboardData.php', { credentials: 'same-origin' });
        if (response.status === 401) {
          window.location.href = '../login/login.html';
          return;
        }
        const data = await response.json();
        if (!data.success) {
          console.error('Failed to load supplier dashboard data:', data.message);
          return;
        }
        this.profile = data.profile;
        this.orders = data.orders;
        this.counts = data.counts;
      } catch (e) {
        console.error('Network error while loading supplier dashboard data:', e);
      } finally {
        this.loading = false;
      }
    },

    /* POSTs to a backend/supplier/*.php mutation endpoint and returns the
       parsed JSON response. Callers refresh() afterward on success. */
    async post(endpoint, params) {
      const body = new URLSearchParams();
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        body.append(key, value);
      });
      const response = await fetch(SUPPLIER_API_BASE + endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        body
      });
      if (response.status === 401) {
        window.location.href = '../login/login.html';
        throw new Error('Not authenticated');
      }
      return response.json();
    },

    getStatusBadgeClass(status) {
      switch (status) {
        case 'Order Placed': return 'admin-badge admin-badge--pending';
        case 'Order Confirmed': return 'admin-badge admin-badge--info';
        case 'Out for Delivery': return 'admin-badge admin-badge--info';
        case 'Received':
        case 'Completed': return 'admin-badge admin-badge--success';
        default: return 'admin-badge admin-badge--neutral';
      }
    },

    getStatusLabel(status) {
      return status === 'Order Placed' ? 'New Order' : status;
    }
  });

  Alpine.store('supplier').refresh();
});

/* Highlights the sidebar nav link matching the current page filename. */
function supplierHighlightNav() {
  const current = location.pathname.split('/').pop();
  document.querySelectorAll('[data-nav-page]').forEach(link => {
    const isActive = link.getAttribute('data-nav-page') === current;
    link.classList.toggle('admin-nav-active', isActive);
    link.classList.toggle('font-medium', isActive);
    link.classList.toggle('border-l-4', isActive);
    link.classList.toggle('border-gold-400', isActive);
    link.classList.toggle('text-slate-400', !isActive);
  });
}
