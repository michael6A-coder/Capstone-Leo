function adminBookingsApp() {
  return {
    bookingFilterBranch: 'all',
    bookingFilterStatus: 'Completed',

    openStaffAssignModal: false,
    staffAssignBooking: null,
    selectedStaffId: '',

    openCheckoutModalFlag: false,
    checkoutBooking: null,

    openDepositModal: false,
    depositBooking: null,
    depositAmount: '',
    depositMethod: '',

    openHomeServiceQuoteModal: false,
    quoteBooking: null,
    quotePrice: '',
    reservationFee: '',

    init() {
      adminHighlightNav();
    },

    getFilteredBookings() {
      const store = Alpine.store('admin');
      let list = store.bookings;
      if (this.bookingFilterBranch !== 'all') list = list.filter(b => b.branchId === this.bookingFilterBranch);
      if (this.bookingFilterStatus !== 'all') list = list.filter(b => b.status === this.bookingFilterStatus);
      return list;
    },

    /* Each branch has its own configured concurrent-booking capacity (see
       backend/config/Scheduling.php's BOOKING_SLOT_LIMITS) -- never one
       flat number for every branch. */
    getCurrentSlotLimitLabel() {
      if (this.bookingFilterBranch === 'all') return 'Varies by branch';
      const branch = Alpine.store('admin').branches.find(b => b.id === this.bookingFilterBranch);
      return branch ? branch.slotLimit + ' concurrent' : '—';
    },

    getServicesForBranch(branchId) {
      return Alpine.store('admin').servicesByBranch[branchId] || [];
    },

    getAssignableStaff() {
      const store = Alpine.store('admin');
      if (!this.staffAssignBooking) return [];
      // Home service jobs are off-site, not tied to one branch's roster --
      // any active employee can be sent, so skip the branch filter.
      if (this.staffAssignBooking.isHomeService) return store.staffList;
      return store.staffList.filter(s => s.branchId === this.staffAssignBooking.branchId);
    },

    openStaffAssign(booking) {
      this.staffAssignBooking = booking;
      this.selectedStaffId = booking.staffId || '';
      this.openStaffAssignModal = true;
    },

    async assignStaff() {
      const store = Alpine.store('admin');
      if (!this.selectedStaffId || !this.staffAssignBooking) return;
      const result = await store.post('assignStaff.php', {
        id: this.staffAssignBooking.id,
        staffId: this.selectedStaffId
      });
      if (!result.success) {
        alert(result.message || 'Failed to assign staff.');
        return;
      }
      await store.refresh();
      this.openStaffAssignModal = false;
    },

    async updateBookingStatus(id, newStatus) {
      const store = Alpine.store('admin');
      const result = await store.post('updateBookingStatus.php', { id, status: newStatus });
      if (!result.success) {
        alert(result.message || 'Failed to update booking status.');
        return;
      }
      await store.refresh();
    },

    openConfirmDeposit(booking) {
      const allowedDepositMethods = ['Cash', 'GCash', 'Maya'];
      this.depositBooking = booking;
      // Bookings made through the online deposit-first flow already carry a
      // self-reported deposit amount/method (unverified until this confirm
      // action) -- prefill from that. Older/off-flow bookings with no
      // deposit info fall back to the full price as a starting point.
      this.depositAmount = booking.depositAmount || booking.price || '';
      this.depositMethod = allowedDepositMethods.includes(booking.paymentMethod) ? booking.paymentMethod : '';
      this.openDepositModal = true;
    },

    async confirmWithDeposit() {
      const store = Alpine.store('admin');
      if (!this.depositBooking || !this.depositAmount || !this.depositMethod) return;

      // Home service has no online payment step -- this modal is reused to
      // record a reservation payment self-reported by phone/in person
      // (backend/admin/setHomeServiceQuote.php's recordPayment action),
      // rather than confirming the request outright like a salon booking.
      const result = this.depositBooking.isHomeService
        ? await store.post('setHomeServiceQuote.php', {
            id: this.depositBooking.id,
            action: 'recordPayment',
            depositAmount: this.depositAmount,
            depositMethod: this.depositMethod
          })
        : await store.post('updateBookingStatus.php', {
            id: this.depositBooking.id,
            status: 'Confirmed',
            depositAmount: this.depositAmount,
            depositMethod: this.depositMethod
          });
      if (!result.success) {
        alert(result.message || 'Failed to confirm booking.');
        return;
      }
      await store.refresh();
      this.openDepositModal = false;
    },

    openHomeServiceQuote(booking) {
      this.quoteBooking = booking;
      this.quotePrice = booking.quotePrice || '';
      this.reservationFee = booking.depositAmount || '';
      this.openHomeServiceQuoteModal = true;
    },

    async submitHomeServiceQuote() {
      const store = Alpine.store('admin');
      if (!this.quoteBooking || !this.quotePrice) return;
      const result = await store.post('setHomeServiceQuote.php', {
        id: this.quoteBooking.id,
        action: 'quote',
        quotePrice: this.quotePrice,
        reservationFee: this.reservationFee || 0
      });
      if (!result.success) {
        alert(result.message || 'Failed to save quote.');
        return;
      }
      await store.refresh();
      this.openHomeServiceQuoteModal = false;
    },

    async rejectHomeService(booking) {
      if (!confirm(`Reject home service request ${booking.id}? The customer will be notified.`)) return;
      await this.updateBookingStatus(booking.id, 'Cancelled');
    },

    async requestHomeServiceScheduleChange(booking) {
      const note = prompt('Note to the customer about the schedule change (optional):', '');
      if (note === null) return;
      const store = Alpine.store('admin');
      const result = await store.post('setHomeServiceQuote.php', { id: booking.id, action: 'requestScheduleChange', note });
      if (!result.success) {
        alert(result.message || 'Failed to notify the customer.');
        return;
      }
      await store.refresh();
    },

    openCheckoutModal(booking) {
      this.checkoutBooking = booking;
      this.openCheckoutModalFlag = true;
    },

    async completeCheckout() {
      const store = Alpine.store('admin');
      if (!this.checkoutBooking) return;
      const result = await store.post('completeCheckout.php', { id: this.checkoutBooking.id });
      if (!result.success) {
        alert(result.message || 'Failed to complete checkout.');
        return;
      }
      await store.refresh();
      this.openCheckoutModalFlag = false;
    },

    exportBookingsToCSV() {
      const store = Alpine.store('admin');
      const rows = this.getFilteredBookings().map(b => [
        b.id, b.isHomeService ? 'Off-Site' : store.getBranchName(b.branchId), b.clientName, b.clientPhone,
        b.serviceName, b.staffName || 'Unassigned', b.date, b.time, b.endTime || '', b.durationMinutes || '',
        b.bookingType, b.status, b.paymentStatus || '', b.isHomeService ? '' : b.price
      ]);
      store.exportRowsToCSV('bookings-export.csv',
        ['Ref ID', 'Branch', 'Client', 'Phone', 'Service', 'Staff', 'Date', 'Start Time', 'End Time', 'Duration (min)', 'Type', 'Status', 'Payment Status', 'Price'],
        rows);
    }
  };
}
