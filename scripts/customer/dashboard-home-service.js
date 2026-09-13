// Home service request modal and status badge styling.

function customerHomeServiceMixin() {
  return {
    // Maps the internal `home_service_requests.status` enum values
    // ('Pending Review'/'Confirmed'/'Completed'/'Cancelled') to
    // customer-friendly display labels. Display-only -- the internal
    // values are unchanged and still drive the admin-side workflow
    // (see backend/admin/updateBookingStatus.php).
    getHomeServiceStatusLabel(status) {
      const labels = {
        'Pending Review': 'Under Review',
        'Confirmed': 'Confirmed',
        'Completed': 'Completed',
        'Cancelled': 'Cancelled'
      };
      return labels[status] || status;
    },

    getHomeServiceStatusBadgeClass(status) {
      const classes = {
        'Pending Review': 'bg-amber-950 text-amber-400 border border-amber-900/60',
        'Confirmed': 'bg-indigo-950 text-indigo-400 border border-indigo-900/60',
        'Completed': 'bg-emerald-950 text-emerald-400 border border-emerald-900/60',
        'Cancelled': 'bg-rose-950 text-rose-400 border border-rose-900/60'
      };
      return classes[status] || 'bg-slate-800 text-slate-300';
    },

    openHomeServiceModal() {
      this.homeServiceForm.preferredDate = getLocalISODate();
      this.isHomeServiceSuccess = false;
      this.isHomeServiceModalOpen = true;
    },
    closeHomeServiceModal() {
      this.isHomeServiceModalOpen = false;
      this.homeServiceForm = { address: '', eventType: 'Standard Home Service', otherEventType: '', weddingPackage: '', clients: '', services: [], venueDetails: '', preferredDate: getLocalISODate(), preferredTime: '', requests: '', agreedToTerms: false };
    },

    submitHomeServiceRequest() {
      if (!this.homeServiceForm.address || !this.homeServiceForm.preferredDate || !this.homeServiceForm.preferredTime) {
        return this.pushToast('error', 'Please provide your address, preferred date, and preferred time.');
      }
      const eventType = this.homeServiceForm.eventType === 'Other' ? this.homeServiceForm.otherEventType.trim() : this.homeServiceForm.eventType;
      if (!eventType) return this.pushToast('error', 'Please specify the event type.');
      if (this.homeServiceForm.eventType === 'Wedding' && !this.homeServiceForm.weddingPackage) {
        return this.pushToast('error', 'Please choose a wedding package.');
      }
      if (!this.homeServiceForm.agreedToTerms) return this.pushToast('error', 'Please agree to the Terms & Conditions to continue.');

      if (!Number.isInteger(Number(this.homeServiceForm.clients)) || Number(this.homeServiceForm.clients) < 1) return this.pushToast('error', 'Please enter the number of clients (at least 1).');
      if (this.homeServiceForm.eventType !== 'Wedding' && !this.homeServiceForm.services.length) return this.pushToast('error', 'Please select the services you need.');
      if (new Date(this.homeServiceForm.preferredDate + 'T' + this.homeServiceForm.preferredTime + ':00+08:00').getTime() <= Date.now()) return this.pushToast('error', 'Please choose a future date and time.');
      this.isSubmittingHomeService = true;

      const formData = new FormData();
      formData.append('address', this.homeServiceForm.address);
      formData.append('eventType', eventType);
      formData.append('preferredDate', this.homeServiceForm.preferredDate);
      formData.append('preferredTime', this.homeServiceForm.preferredTime);
      formData.append('requests', this.homeServiceForm.requests);
      formData.append('clients', this.homeServiceForm.clients);
      formData.append('venueDetails', this.homeServiceForm.venueDetails);
      this.homeServiceForm.services.forEach(service => formData.append('services[]', service));
      if (this.homeServiceForm.eventType === 'Wedding') {
        formData.append('weddingPackage', this.homeServiceForm.weddingPackage);
      }
      formData.append('agreedToTerms', this.homeServiceForm.agreedToTerms ? '1' : '0');

      fetch('../../backend/customer/submitHomeServiceRequest.php', { method: 'POST', body: formData })
        .then(response => response.json().then(body => ({ status: response.status, body })))
        .then(({ body }) => {
          this.isSubmittingHomeService = false;

          if (!body.success) {
            this.pushToast('error', body.message || 'Could not submit your home service request.');
            return;
          }

          this.homeServiceRequests.unshift(body.request);
          this.addNotification('success', `Your home service request ${body.request.id} has been received. We will contact you at ${this.customerProfile.phone} about availability, pricing, staff, and any required payment.`);
          this.isHomeServiceModalOpen = false;
          this.isHomeServiceSuccess = true;
          this.homeServiceForm = { address: '', eventType: 'Standard Home Service', otherEventType: '', weddingPackage: '', clients: '', services: [], venueDetails: '', preferredDate: getLocalISODate(), preferredTime: '', requests: '', agreedToTerms: false };
          this.pushToast('success', body.message || 'Home service request submitted!');
        })
        .catch(() => {
          this.isSubmittingHomeService = false;
          this.pushToast('error', 'A network error occurred while submitting your request.');
        });
    }
  };
}
