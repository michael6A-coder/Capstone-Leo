/* pages/cashier/appointments.html — Branch Appointment Pipeline.
   Branch is fixed by the logged-in Cashier's account (server-side); see
   database/migrations/007_cashier_branch_lock.sql. bookings is already
   scoped to that one branch by getDashboardData.php. */

const state = {
  data: null,
  branch: null,
  pendingAdmitRef: null,
  pendingReassignRef: null,
  activeTab: 'Pending'
};

async function init() {
  CashierApp.initChrome();
  wireStaticEvents();
  setActiveTab('Pending');
  await refreshData();
}

async function refreshData() {
  try {
    const result = await CashierApp.fetchDashboard();
    if (!result.success) {
      CashierApp.toast(result.message || 'Failed to load appointments.', 'error');
      return;
    }
    state.data = result;
    state.branch = result.myBranch.key;
    CashierApp.applyBranchChrome(state.branch);
    renderAppointments();
    CashierApp.updateQueueBadge(result.bookings);
  } catch (e) {
    console.error(e);
  }
}

function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('#statusTabs .tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('bg-amber-500', active);
    btn.classList.toggle('text-slate-950', active);
    btn.classList.toggle('text-gray-500', !active);
    btn.classList.toggle('hover:text-gray-800', !active);
  });
  renderAppointments();
}

/* Real duration/price/service values sometimes come back empty (a booking
   with no linked appointment_services row, for example) -- show "—" rather
   than a blank cell. */
function cellOrDash(value) {
  return value === null || value === undefined || value === '' ? '—' : escapeHtml(String(value));
}

function paymentStatusBadgeClass(status) {
  switch (status) {
    case 'Fully Paid':
    case 'Down Payment Verified': return 'bg-emerald-100 text-emerald-700';
    case 'Awaiting Verification': return 'bg-amber-100 text-amber-800';
    case 'Rejected':
    case 'Refunded':
    case 'Forfeited': return 'bg-rose-100 text-rose-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function renderAppointments() {
  if (!state.data) return;
  const bookings = state.data.bookings;
  const tbody = document.getElementById('appointmentsTableBody');

  const search = (document.getElementById('apptSearch').value || '').toLowerCase().trim();
  const filtered = bookings.filter(b => {
    const matchesTab = state.activeTab === 'All' || b.status === state.activeTab;
    const matchesSearch = !search
      || b.clientName.toLowerCase().includes(search)
      || (b.clientPhone || '').includes(search)
      || b.id.toLowerCase().includes(search);
    return matchesTab && matchesSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr><td colspan="12" class="py-12 text-center">
        <i class="fa-solid fa-calendar-xmark text-3xl text-gray-200 mb-2 block"></i>
        <span class="text-xs text-gray-400 italic">No ${state.activeTab === 'All' ? '' : state.activeTab.toLowerCase() + ' '}bookings found for this branch.</span>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(b => `
    <tr class="hover:bg-amber-50/40 transition-colors duration-150">
      <td class="p-2.5 font-mono text-[10px]">${escapeHtml(b.id)}</td>
      <td class="p-2.5">${cellOrDash(b.date)}</td>
      <td class="p-2.5">${cellOrDash(b.time)}</td>
      <td class="p-2.5">${cellOrDash(b.endTime)}</td>
      <td class="p-2.5 font-semibold text-slate-800 capitalize">${escapeHtml(b.clientName)}</td>
      <td class="p-2.5">${cellOrDash(b.clientPhone)}</td>
      <td class="p-2.5">${cellOrDash(b.serviceName)}</td>
      <td class="p-2.5">${b.durationMinutes ? b.durationMinutes + ' min' : '—'}</td>
      <td class="p-2.5 capitalize">${cellOrDash(b.staffName)}</td>
      <td class="p-2.5">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(b.status)}${b.status === 'In Progress' ? ' badge-live' : ''}">${escapeHtml(b.status)}</span>
        ${b.status === 'Pending' && b.hasConflict ? '<span class="ml-1 text-[9px] font-bold text-rose-600">⚠ Conflict</span>' : ''}
      </td>
      <td class="p-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded ${paymentStatusBadgeClass(b.paymentStatus)}">${cellOrDash(b.paymentStatus)}</span></td>
      <td class="p-2.5 space-x-1.5 whitespace-nowrap">${actionsFor(b)}</td>
    </tr>
  `).join('');
}

/* Only actions valid for the booking's current status. */
function actionsFor(b) {
  const ref = escapeHtml(b.id);
  const details = `<button data-action="details" data-ref="${ref}" class="text-slate-500 hover:text-slate-800 hover:underline">View</button>`;

  if (b.status === 'Pending') {
    const verify = (b.depositAmount || b.depositReference)
      ? `<button data-action="verify" data-ref="${ref}" class="text-sky-700 font-bold hover:underline">Verify Payment</button>`
      : '';
    return `
      ${details}
      ${verify}
      <button data-action="confirm" data-ref="${ref}" class="text-emerald-700 font-bold hover:underline">Confirm</button>
      <button data-action="reschedule" data-ref="${ref}" class="text-amber-700 font-bold hover:underline">Reschedule</button>
      <button data-action="cancel" data-ref="${ref}" class="text-rose-700 font-bold hover:underline">Cancel</button>
    `;
  }
  if (b.status === 'Confirmed') {
    return `${details}<button data-action="reassign" data-ref="${ref}" class="text-amber-700 font-bold hover:underline">${b.staffName ? 'Reassign' : 'Assign'} Staff</button>`;
  }
  if (b.status === 'In Progress') {
    return details;
  }
  if (b.status === 'Completed') {
    return `
      ${details}
      <a href="payment.html?ref=${encodeURIComponent(b.id)}" class="text-amber-700 font-bold hover:underline">Checkout</a>
      ${b.paymentStatus === 'Fully Paid' || b.paymentStatus === 'Down Payment Verified'
        ? `<a href="receipt.html?ref=${encodeURIComponent(b.id)}" class="text-emerald-700 font-bold hover:underline">Receipt</a>` : ''}
    `;
  }
  return details;
}

function showDetails(ref) {
  const b = state.data.bookings.find(x => x.id === ref);
  if (!b) return;
  document.getElementById('detailsModalBody').innerHTML = `
    <div class="grid grid-cols-2 gap-y-2 gap-x-3">
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Reference</span>${cellOrDash(b.id)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Status</span>${cellOrDash(b.status)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Client</span>${cellOrDash(b.clientName)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Contact</span>${cellOrDash(b.clientPhone)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Date</span>${cellOrDash(b.date)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Time</span>${cellOrDash(b.time)} &ndash; ${cellOrDash(b.endTime)}</div>
      <div class="col-span-2"><span class="text-gray-400 block text-[10px] uppercase font-bold">Service(s)</span>${cellOrDash(b.serviceName)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Duration</span>${b.durationMinutes ? b.durationMinutes + ' min' : '—'}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Staff</span>${cellOrDash(b.staffName)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Payment Status</span>${cellOrDash(b.paymentStatus)}</div>
      <div><span class="text-gray-400 block text-[10px] uppercase font-bold">Total</span>${CashierApp.formatCurrency(b.price)}</div>
      ${b.depositAmount || b.depositReference ? `
      <div class="col-span-2 border-t border-gray-100 pt-2 mt-1">
        <span class="text-gray-400 block text-[10px] uppercase font-bold mb-1">${b.depositVerified ? 'Verified Payment' : 'Self-Reported Payment (unverified)'}</span>
        <p>Amount: <strong>${b.depositAmount ? CashierApp.formatCurrency(b.depositAmount) : '—'}</strong> via <strong>${cellOrDash(b.paymentMethod)}</strong></p>
        <p>Reference: <strong>${cellOrDash(b.depositReference)}</strong></p>
      </div>` : ''}
    </div>
  `;
  CashierApp.showModal('detailsModal');
}

/* Pending bookings haven't been staffed yet. "Confirm" auto-assigns the
   first on-duty stylist at this branch, then -- after a deposit is
   recorded in the modal -- advances the booking to Confirmed. The deposit
   is what actually "locks" the reservation. */
async function admitAppointmentToQueue(ref, depositAmount, depositMethod) {
  const onDutyStaff = state.data.staffList.filter(s => s.onShift);
  if (!onDutyStaff.length) {
    CashierApp.toast('No on-duty stylist available to admit this client.', 'error');
    return;
  }

  let assignedStylist = null;
  let lastError = null;
  for (const stylist of onDutyStaff) {
    const assignResult = await CashierApp.post('assignStaff.php', { id: ref, staffId: stylist.id });
    if (assignResult.success) {
      assignedStylist = stylist;
      break;
    }
    lastError = assignResult.message;
  }

  if (!assignedStylist) {
    CashierApp.toast(lastError || 'No on-duty stylist is qualified for this booking.', 'error');
    return;
  }

  const statusResult = await CashierApp.post('updateStatus.php', { id: ref, status: 'Confirmed', depositAmount, depositMethod });
  if (!statusResult.success) {
    CashierApp.toast(statusResult.message || 'Failed to confirm the booking.', 'error');
    return;
  }

  CashierApp.toast(`Booking confirmed, assigned to ${assignedStylist.name}.`, 'success');
  await refreshData();
}

function openDepositModal(ref) {
  state.pendingAdmitRef = ref;
  const booking = state.data.bookings.find(b => b.id === ref);
  const allowedDepositMethods = ['Cash', 'GCash', 'Maya'];

  document.getElementById('depositAmountInput').value = booking ? (booking.depositAmount || booking.price) : '';
  document.getElementById('depositMethodInput').value = booking && allowedDepositMethods.includes(booking.paymentMethod) ? booking.paymentMethod : '';

  const banner = document.getElementById('depositVerifyBanner');
  if (booking && booking.depositAmount && !booking.depositVerified) {
    banner.classList.remove('hidden');
    document.getElementById('depositVerifyAmount').textContent = CashierApp.formatCurrency(booking.depositAmount);
    document.getElementById('depositVerifyMethod').textContent = booking.paymentMethod || '';
    document.getElementById('depositVerifyRefRow').classList.toggle('hidden', !booking.depositReference);
    document.getElementById('depositVerifyRefValue').textContent = booking.depositReference || '';
    document.getElementById('depositVerifyNoRef').classList.toggle('hidden', !!booking.depositReference);
  } else {
    banner.classList.add('hidden');
  }
  document.getElementById('btnConfirmDeposit').textContent = (booking && booking.depositAmount && !booking.depositVerified) ? 'Verify & Admit' : 'Confirm & Admit';

  CashierApp.showModal('depositModal');
}

async function confirmDepositAndAdmit() {
  const amount = document.getElementById('depositAmountInput').value;
  const method = document.getElementById('depositMethodInput').value;
  if (!amount || Number(amount) <= 0 || !method) {
    CashierApp.toast('A deposit amount and payment method are required.', 'error');
    return;
  }
  await admitAppointmentToQueue(state.pendingAdmitRef, amount, method);
  CashierApp.hideModal('depositModal');
  state.pendingAdmitRef = null;
}

function openReassignModal(ref) {
  state.pendingReassignRef = ref;
  const booking = state.data.bookings.find(b => b.id === ref);
  const staff = state.data.staffList;
  const select = document.getElementById('reassignStaffSelect');
  select.innerHTML = staff.length
    ? staff.map(s => `<option value="${s.id}" ${booking && booking.staffId === s.id ? 'selected' : ''}>${escapeHtml(titleCase(s.name))} (${escapeHtml(s.role || 'Staff')})</option>`).join('')
    : '<option value="">No staff available</option>';
  CashierApp.showModal('reassignModal');
}

async function confirmReassign() {
  const staffId = document.getElementById('reassignStaffSelect').value;
  if (!staffId) {
    CashierApp.toast('Please select a staff member.', 'error');
    return;
  }
  const result = await CashierApp.post('assignStaff.php', { id: state.pendingReassignRef, staffId });
  if (result.success) {
    CashierApp.toast('Staff assigned.', 'success');
    CashierApp.hideModal('reassignModal');
    state.pendingReassignRef = null;
    await refreshData();
  } else {
    CashierApp.toast(result.message || 'Failed to assign staff.', 'error');
  }
}

async function rescheduleBooking(ref) {
  if (!window.confirm('Mark this booking as needing a schedule change? The customer will be notified.')) return;
  const result = await CashierApp.post('updateStatus.php', { id: ref, status: 'Reschedule Requested' });
  CashierApp.toast(result.message || (result.success ? 'Reschedule requested.' : 'Failed to update booking.'), result.success ? 'success' : 'error');
  if (result.success) await refreshData();
}

async function cancelBooking(ref) {
  if (!window.confirm('Cancel this booking? This cannot be undone.')) return;
  const result = await CashierApp.post('updateStatus.php', { id: ref, status: 'Cancelled' });
  CashierApp.toast(result.message || (result.success ? 'Booking cancelled.' : 'Failed to cancel booking.'), result.success ? 'success' : 'error');
  if (result.success) await refreshData();
}

function wireStaticEvents() {
  document.getElementById('statusTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) setActiveTab(btn.dataset.tab);
  });
  document.getElementById('apptSearch').addEventListener('input', renderAppointments);

  document.getElementById('appointmentsTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const ref = btn.dataset.ref;
    switch (btn.dataset.action) {
      case 'details': showDetails(ref); break;
      case 'verify': showDetails(ref); break;
      case 'confirm': openDepositModal(ref); break;
      case 'reassign': openReassignModal(ref); break;
      case 'reschedule': rescheduleBooking(ref); break;
      case 'cancel': cancelBooking(ref); break;
    }
  });

  document.getElementById('btnCloseDepositModal').addEventListener('click', () => CashierApp.hideModal('depositModal'));
  document.getElementById('btnConfirmDeposit').addEventListener('click', confirmDepositAndAdmit);
  document.getElementById('btnCloseDetailsModal').addEventListener('click', () => CashierApp.hideModal('detailsModal'));
  document.getElementById('btnCloseReassignModal').addEventListener('click', () => CashierApp.hideModal('reassignModal'));
  document.getElementById('btnConfirmReassign').addEventListener('click', confirmReassign);
}

document.addEventListener('DOMContentLoaded', init);
