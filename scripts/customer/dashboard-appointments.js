// Appointment list views, cancellation flow, and status badge styling.

function customerAppointmentsMixin() {
  return {
    matchesAppointmentSearch(appt) {
      const query = (this.appointmentSearchQuery || '').toLowerCase().trim();
      return [appt.id, appt.serviceName, appt.branchName, appt.staffName]
        .some(value => String(value || '').toLowerCase().includes(query));
    },
    getUpcomingAppointments() {
      const now = new Date();
      return this.appointments.filter(appt => {
        const apptDateTime = parseApptDateTime(appt.date, appt.time);
        return apptDateTime >= now && (appt.status === 'Confirmed' || appt.status === 'Pending') && this.matchesAppointmentSearch(appt);
      }).sort((a, b) => parseApptDateTime(a.date, a.time) - parseApptDateTime(b.date, b.time));
    },

    getPastAppointments() {
      const now = new Date();
      let past = this.appointments.filter(appt => {
        const apptDateTime = parseApptDateTime(appt.date, appt.time);
        return apptDateTime < now || ['Completed', 'Cancelled', 'Reviewed'].includes(appt.status);
      });

      if (this.appointmentSearchQuery.trim() !== '') {
        past = past.filter(appt => this.matchesAppointmentSearch(appt));
      }

      return past.sort((a, b) => parseApptDateTime(b.date, b.time) - parseApptDateTime(a.date, a.time));
    },

    getNextAppointment() {
      return this.getUpcomingAppointments()[0] || null;
    },

    openCancelModal(appointmentId) {
      this.appointmentToCancelId = appointmentId;
      this.isCancelModalOpen = true;
    },
    closeCancelModal() {
      this.isCancelModalOpen = false;
      this.appointmentToCancelId = null;
    },
    confirmCancelAppointment() {
      if (!this.appointmentToCancelId) return;
      const cancelId = this.appointmentToCancelId;

      const formData = new FormData();
      formData.append('appointment_id', cancelId);

      fetch('../../backend/customer/cancelAppointment.php', { method: 'POST', body: formData })
        .then(response => response.json().then(body => ({ status: response.status, body })))
        .then(({ body }) => {
          if (!body.success) {
            this.pushToast('error', body.message || 'Could not cancel this appointment.');
            return;
          }
          const appt = this.appointments.find(a => a.id === cancelId);
          if (appt) appt.status = 'Cancelled';
          const booking = this.allBookings.find(b => b.id === cancelId);
          if (booking) booking.status = 'Cancelled';
          this.pushToast('success', body.message || 'Your appointment has been cancelled.');
        })
        .catch(() => this.pushToast('error', 'A network error occurred while cancelling your appointment.'))
        .finally(() => this.closeCancelModal());
    },

    // Uses the same .admin-badge chips as the admin/cashier workspaces
    // (assets/css/admin-theme.css) instead of raw Tailwind color pairs —
    // those chips are already tuned for readable contrast on the portal's
    // light cream background; the old bg-indigo-950/text-indigo-400 pairing
    // in particular rendered near-invisible light text on a light chip.
    getStatusBadgeClass(status) {
      const classes = {
        'Pending': 'admin-badge admin-badge--pending',
        'Confirmed': 'admin-badge admin-badge--confirmed',
        'In Progress': 'admin-badge admin-badge--info',
        'Completed': 'admin-badge admin-badge--success',
        'Reviewed': 'admin-badge admin-badge--success',
        'Cancelled': 'admin-badge admin-badge--danger',
        'No-Show': 'admin-badge admin-badge--danger'
      };
      return classes[status] || 'admin-badge admin-badge--neutral';
    },

    openAppointmentDetails(appt) {
      this.viewingAppointment = appt;
    },
    closeAppointmentDetails() {
      this.viewingAppointment = null;
    }
  };
}
