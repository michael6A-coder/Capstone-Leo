/* pages/cashier/payment.html — single-ticket checkout terminal.
   Reads ?ref=<reference_code> from the URL, loads that booking from the
   shared getDashboardData.php payload, lets the cashier add retail
   products + a tip, then posts to payment.php and redirects to the
   printable receipt. */

const state = {
  data: null,
  ticket: null,
  branchInventory: [],
  cartProducts: [], // [{ id, name, price, stock, qty }]
  tip: 0,
  selectedMethod: 'Cash',
  pendingVerifyRef: null
};

function getReferenceFromUrl() {
  return new URLSearchParams(window.location.search).get('ref') || '';
}

async function init() {
  CashierApp.startClock('liveClock');
  CashierApp.initChrome();
  wireStaticEvents();
  selectPaymentMethod('Cash');

  const ref = getReferenceFromUrl();
  const result = await CashierApp.fetchDashboard();
  if (!result.success) {
    CashierApp.toast(result.message || 'Failed to load data.', 'error');
    if (ref) showNotFound();
    return;
  }
  state.data = result;
  CashierApp.applyBranchChrome(result.myBranch.key);

  if (!ref) {
    document.getElementById('verifyListSection').classList.remove('hidden');
    document.getElementById('ticketTerminal').classList.add('hidden');
    renderVerifyList();
    return;
  }

  document.getElementById('verifyListSection').classList.add('hidden');
  document.getElementById('ticketTerminal').classList.remove('hidden');

  const ticket = result.bookings.find(b => b.id === ref);
  if (!ticket) {
    showNotFound();
    return;
  }

  state.ticket = ticket;
  state.branchInventory = result.inventory.filter(i => i.branchId === ticket.branchId);

  const branch = result.branches.find(b => b.branchKey === ticket.branchId);
  renderTicketSummary(branch);

  const receiptCheck = await CashierApp.get('receipt.php', { reference: ticket.id });
  if (receiptCheck.success) {
    showAlreadyPaid(ref, receiptCheck.receipt);
  } else {
    document.getElementById('btnSellProduct').disabled = false;
    document.getElementById('btnProcessPayment').disabled = false;
  }

  renderCart();
}

/* PAYMENTS TO VERIFY -- self-reported deposits/reservation payments on
   Pending bookings, awaiting a cashier's manual verification. Customers
   never verify their own payment -- this list and its actions are
   cashier/admin-only (see backend/cashier/updateStatus.php's role check). */
function renderVerifyList() {
  const tbody = document.getElementById('verifyTableBody');
  const toVerify = state.data.bookings.filter(b =>
    b.status === 'Pending' && (b.depositAmount || b.depositReference) && !b.depositVerified
  );

  if (!toVerify.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-12 text-center">
      <i class="fa-solid fa-circle-check text-3xl text-gray-200 mb-2 block"></i>
      <span class="text-xs text-gray-400 italic">No payments waiting on verification.</span>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = toVerify.map(b => `
    <tr class="hover:bg-amber-50/40 transition-colors duration-150">
      <td class="p-2.5 font-mono text-[10px]">${escapeHtml(b.id)}</td>
      <td class="p-2.5 font-semibold text-slate-800 capitalize">${escapeHtml(b.clientName)}</td>
      <td class="p-2.5">${CashierApp.formatCurrency(b.price)}</td>
      <td class="p-2.5">${escapeHtml(b.paymentRequirement || '—')}</td>
      <td class="p-2.5">${b.requiredAmount ? CashierApp.formatCurrency(b.requiredAmount) : '—'}</td>
      <td class="p-2.5">${b.depositAmount ? CashierApp.formatCurrency(b.depositAmount) : '—'}</td>
      <td class="p-2.5">${escapeHtml(b.depositMethod && b.depositMethod !== 'Walk-in' ? b.depositMethod : (b.paymentMethod || '—'))}</td>
      <td class="p-2.5">${escapeHtml(b.depositReference || '—')}</td>
      <td class="p-2.5">${escapeHtml(b.submittedAt || '—')}</td>
      <td class="p-2.5"><span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">${escapeHtml(b.paymentStatus || 'Awaiting Verification')}</span></td>
      <td class="p-2.5"><button data-ref="${escapeHtml(b.id)}" class="btn-verify bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[10px] font-bold shadow-sm hover:shadow-md">Verify Payment</button></td>
    </tr>
  `).join('');
}

function openVerifyModal(ref) {
  state.pendingVerifyRef = ref;
  const booking = state.data.bookings.find(b => b.id === ref);
  const allowedDepositMethods = ['Cash', 'GCash', 'Maya'];
  document.getElementById('verifyAmountInput').value = booking ? (booking.depositAmount || booking.price) : '';
  document.getElementById('verifyMethodInput').value = booking && allowedDepositMethods.includes(booking.depositMethod) ? booking.depositMethod : '';
  CashierApp.showModal('verifyModal');
}

/* If the reservation payment is valid: the appointment moves to Confirmed,
   and payment status resolves to "Reservation Payment Received" (partial)
   or "Paid in Full" (full amount) -- backend/cashier/updateStatus.php's
   Confirmed branch already derives which one from the amount vs. total. */
async function confirmVerify() {
  const amount = document.getElementById('verifyAmountInput').value;
  const method = document.getElementById('verifyMethodInput').value;
  if (!amount || Number(amount) <= 0 || !method) {
    CashierApp.toast('An amount and payment method are required.', 'error');
    return;
  }
  const result = await CashierApp.post('updateStatus.php', {
    id: state.pendingVerifyRef, status: 'Confirmed', depositAmount: amount, depositMethod: method
  });
  CashierApp.toast(result.message || (result.success ? 'Payment verified.' : 'Failed to verify payment.'), result.success ? 'success' : 'error');
  if (result.success) {
    CashierApp.hideModal('verifyModal');
    const refreshed = await CashierApp.fetchDashboard();
    if (refreshed.success) { state.data = refreshed; renderVerifyList(); }
  }
}

async function markNeedsAttention() {
  if (!window.confirm('Flag this payment as needing attention? The customer will be notified to contact the branch.')) return;
  const result = await CashierApp.post('updateStatus.php', { id: state.pendingVerifyRef, paymentAction: 'needs_attention' });
  CashierApp.toast(result.message || (result.success ? 'Payment flagged.' : 'Failed to update payment.'), result.success ? 'success' : 'error');
  if (result.success) {
    CashierApp.hideModal('verifyModal');
    const refreshed = await CashierApp.fetchDashboard();
    if (refreshed.success) { state.data = refreshed; renderVerifyList(); }
  }
}

function showNotFound() {
  document.getElementById('ticketNotFound').classList.remove('hidden');
  document.getElementById('ticketSummaryCard').classList.add('hidden');
  document.getElementById('cartItemsContainer').innerHTML = '<p class="text-xs text-rose-500 text-center py-8 italic">No ticket loaded.</p>';
}

function renderTicketSummary(branch) {
  const t = state.ticket;
  document.getElementById('ticketSummaryCard').classList.remove('hidden');
  document.getElementById('invoiceIdDisplay').textContent = t.id;
  document.getElementById('customerNameDisplay').textContent = t.clientName;
  document.getElementById('ticketClientName').textContent = t.clientName;
  document.getElementById('ticketClientPhone').textContent = t.clientPhone;
  document.getElementById('ticketBranchName').textContent = branch ? branch.name : t.branchId;
  document.getElementById('ticketStaffName').textContent = t.staffName || 'Unassigned';

  const servicesEl = document.getElementById('ticketServices');
  const serviceNames = (t.serviceName || '').split(',').map(s => s.trim()).filter(Boolean);
  servicesEl.innerHTML = serviceNames.length
    ? serviceNames.map(name => `<span class="bg-white border border-amber-200 text-amber-800 text-[11px] font-semibold px-2.5 py-1 rounded-full">${escapeHtml(name)}</span>`).join('')
    : '<span class="text-xs text-gray-400 italic">No services listed</span>';

  renderStatusUI();
}

const STATUS_STEPS = ['Confirmed', 'In Progress', 'Completed'];

function renderStatusUI() {
  const t = state.ticket;
  const badge = document.getElementById('ticketStatusBadge');
  badge.textContent = t.status;
  badge.className = `text-[10px] font-bold px-2 py-0.5 rounded ${statusBadgeClass(t.status)}`;

  const currentIndex = STATUS_STEPS.indexOf(t.status); // -1 while still Pending

  document.querySelectorAll('.progress-seg').forEach((seg, i) => {
    const fillClass = i < currentIndex ? 'bg-emerald-500' : i === currentIndex ? 'bg-amber-500' : 'bg-gray-200';
    seg.className = `progress-seg h-1.5 rounded-full ${fillClass} transition-colors duration-300`;
  });

  document.querySelectorAll('.progress-seg-label').forEach((label, i) => {
    const textClass = i < currentIndex ? 'text-emerald-600' : i === currentIndex ? 'text-slate-900' : 'text-gray-400';
    label.className = `progress-seg-label text-[9px] font-bold text-center transition-colors duration-300 ${textClass}`;
  });

  // "Start Service" only makes sense once a deposit has confirmed the
  // booking (currentIndex 0); "Mark Completed" only while actively in
  // progress (currentIndex 1). One button reflects whichever applies.
  const isCompleted = currentIndex === 2;
  const actionBtn = document.getElementById('btnWorkflowAction');
  if (currentIndex === 1) {
    actionBtn.className = 'w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5';
    actionBtn.innerHTML = '<i class="fa-solid fa-flag-checkered"></i><span>Mark Completed</span>';
    actionBtn.disabled = false;
  } else {
    actionBtn.className = 'w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-3 rounded-lg text-xs transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-1.5';
    actionBtn.innerHTML = '<i class="fa-solid fa-scissors"></i><span>Start Service</span>';
    actionBtn.disabled = currentIndex !== 0;
  }
  actionBtn.classList.toggle('hidden', isCompleted);
  const completedNotice = document.getElementById('serviceCompletedNotice');
  completedNotice.classList.toggle('hidden', !isCompleted);
  completedNotice.classList.toggle('flex', isCompleted);
}

function showAlreadyPaid(ref, receipt) {
  const notice = document.getElementById('alreadyPaidNotice');
  notice.classList.remove('hidden');
  notice.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <span>Already paid (${escapeHtml(receipt.invoiceId)}).</span>
    <a href="receipt.html?ref=${encodeURIComponent(ref)}&pid=${encodeURIComponent(receipt.paymentId)}" class="ml-auto font-bold underline">View Receipt</a>
  `;
  notice.className = 'bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center space-x-2';
  document.getElementById('btnSellProduct').disabled = true;
  document.getElementById('btnProcessPayment').disabled = true;
}


function renderCart() {
  const t = state.ticket;
  const container = document.getElementById('cartItemsContainer');
  const rows = [];

  rows.push(`
    <div class="flex justify-between items-start pt-3 first:pt-0">
      <div class="pr-2">
        <p class="font-bold text-slate-800">Services Availed</p>
        <p class="text-[10px] text-gray-400">${escapeHtml(t.serviceName || 'No services listed')}</p>
      </div>
      <span class="font-bold text-slate-800 shrink-0">${CashierApp.formatCurrency(t.price)}</span>
    </div>
  `);

  state.cartProducts.forEach(p => {
    rows.push(`
      <div class="stagger-item flex justify-between items-start pt-3" data-cart-product="${p.id}">
        <div class="pr-2">
          <p class="font-bold text-slate-800">${escapeHtml(p.name)}</p>
          <div class="flex items-center space-x-2 mt-1">
            <button type="button" class="cart-qty-btn bg-gray-100 hover:bg-gray-200 rounded w-5 h-5 text-xs font-bold" data-action="dec">-</button>
            <span class="text-[11px] font-semibold">${p.qty}</span>
            <button type="button" class="cart-qty-btn bg-gray-100 hover:bg-gray-200 rounded w-5 h-5 text-xs font-bold" data-action="inc">+</button>
            <button type="button" class="cart-remove-btn text-rose-400 hover:text-rose-600 text-[10px] font-bold ml-2"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <span class="font-bold text-slate-800 shrink-0">${CashierApp.formatCurrency(p.price * p.qty)}</span>
      </div>
    `);
  });

  container.innerHTML = rows.join('');
  renderTotals();
}

/* Mirrors the same "already-paid deposit reduces what's due now" logic
   backend/cashier/payment.php uses -- shown here so the cashier sees the
   real amount due before submitting, not the full service price again. */
function renderTotals() {
  const t = state.ticket;
  const productsTotal = state.cartProducts.reduce((sum, p) => sum + p.price * p.qty, 0);
  const serviceCharges = t ? t.price : 0;
  const reservationReceived = (t && t.depositPaid && t.depositVerified) ? (t.depositAmount || 0) : 0;
  const remainingBalance = Math.max(0, serviceCharges - reservationReceived);
  // Tips are Cash-only and never fold into a GCash/Maya transaction amount.
  const tip = state.selectedMethod === 'Cash' ? state.tip : 0;
  const total = remainingBalance + productsTotal + tip;

  document.getElementById('serviceChargesDisplay').textContent = CashierApp.formatCurrency(serviceCharges);
  document.getElementById('reservationReceivedRow').classList.toggle('hidden', reservationReceived <= 0);
  document.getElementById('reservationReceivedDisplay').textContent = '− ' + CashierApp.formatCurrency(reservationReceived);
  document.getElementById('remainingBalanceDisplay').textContent = CashierApp.formatCurrency(remainingBalance);
  document.getElementById('productsChargeRow').classList.toggle('hidden', productsTotal <= 0);
  document.getElementById('subtotalDisplay').textContent = CashierApp.formatCurrency(productsTotal);
  document.getElementById('tipDisplay').textContent = CashierApp.formatCurrency(tip);
  document.getElementById('totalDisplay').textContent = CashierApp.formatCurrency(total);

  updateCashChange(total);
}

/* Change = Cash Received - Amount Due. Checkout is blocked (button
   disabled) while Cash Received is less than what's due. */
function updateCashChange(total) {
  const btn = document.getElementById('btnProcessPayment');
  const alreadyPaid = !document.getElementById('alreadyPaidNotice').classList.contains('hidden');
  if (state.selectedMethod !== 'Cash') {
    if (!alreadyPaid) btn.disabled = false;
    return;
  }
  const received = Number(document.getElementById('cashReceivedInput').value) || 0;
  const change = Math.max(0, received - total);
  document.getElementById('changeDueDisplay').textContent = CashierApp.formatCurrency(change);
  if (!alreadyPaid) btn.disabled = received < total - 0.001;
}


function openProductModal() {
  document.getElementById('productSearchInput').value = '';
  renderProductList('');
  CashierApp.showModal('productSaleModal');
}

function renderProductList(query) {
  const q = query.toLowerCase().trim();
  const items = state.branchInventory.filter(i => !q || i.name.toLowerCase().includes(q));
  const container = document.getElementById('productListContainer');

  if (!items.length) {
    container.innerHTML = '<p class="text-gray-400 italic text-center py-6">No products match your search.</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const inCartQty = state.cartProducts.find(p => p.id === item.id)?.qty || 0;
    const remaining = item.stock - inCartQty;
    return `
    <button type="button" class="product-pick-btn w-full flex justify-between items-center bg-white border border-gray-200 hover:border-amber-400 rounded-lg p-3 text-left transition-all ${remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}" data-product-id="${item.id}" ${remaining <= 0 ? 'disabled' : ''}>
      <div>
        <p class="font-bold text-slate-800">${escapeHtml(item.name)}</p>
        <p class="text-[10px] text-gray-400">${escapeHtml(item.category)} &middot; ${remaining} in stock</p>
      </div>
      <span class="font-bold text-amber-700">${CashierApp.formatCurrency(item.price)}</span>
    </button>
  `;
  }).join('');
}

function addProductToCart(productId) {
  const item = state.branchInventory.find(i => i.id === productId);
  if (!item) return;

  const existing = state.cartProducts.find(p => p.id === productId);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty + 1 > item.stock) {
    CashierApp.toast(`Only ${item.stock} unit(s) of ${item.name} available.`, 'error');
    return;
  }

  if (existing) {
    existing.qty += 1;
  } else {
    state.cartProducts.push({ id: item.id, name: item.name, price: item.price, stock: item.stock, qty: 1 });
  }
  CashierApp.hideModal('productSaleModal');
  renderCart();
}

function adjustCartQty(productId, delta) {
  const line = state.cartProducts.find(p => p.id === productId);
  if (!line) return;
  const newQty = line.qty + delta;
  if (newQty <= 0) {
    state.cartProducts = state.cartProducts.filter(p => p.id !== productId);
  } else if (newQty > line.stock) {
    CashierApp.toast(`Only ${line.stock} unit(s) of ${line.name} available.`, 'error');
    return;
  } else {
    line.qty = newQty;
  }
  renderCart();
}

function removeCartProduct(productId) {
  state.cartProducts = state.cartProducts.filter(p => p.id !== productId);
  renderCart();
}


function setTip(value) {
  state.tip = Math.max(0, Number(value) || 0);
  document.getElementById('customTipInput').value = state.tip || '';
  renderTotals();
}

function selectPaymentMethod(method) {
  state.selectedMethod = method;
  document.querySelectorAll('.pay-method-card').forEach(card => {
    const isActive = card.dataset.method === method;
    card.classList.toggle('border-2', isActive);
    card.classList.toggle('border-amber-500', isActive);
    card.classList.toggle('bg-amber-50/40', isActive);
    card.classList.toggle('text-slate-900', isActive);
    card.classList.toggle('border', !isActive);
    card.classList.toggle('border-gray-200', !isActive);
    card.classList.toggle('bg-white', !isActive);
    card.classList.toggle('text-slate-600', !isActive);
  });

  const isCash = method === 'Cash';
  document.getElementById('tipSection').classList.toggle('hidden', !isCash);
  document.getElementById('cashSection').classList.toggle('hidden', !isCash);
  if (!isCash) {
    setTip(0);
  } else {
    renderTotals();
  }
}


async function updateTicketStatus(status) {
  const result = await CashierApp.post('updateStatus.php', { id: state.ticket.id, status });
  if (result.success) {
    state.ticket.status = status;
    renderStatusUI();
    CashierApp.toast('Status updated.', 'success');
  } else {
    CashierApp.toast(result.message || 'Failed to update status.', 'error');
  }
}


async function processPayment() {
  if (!state.ticket) return;

  const payload = {
    reference: state.ticket.id,
    paymentMethod: state.selectedMethod,
    tip: state.selectedMethod === 'Cash' ? state.tip : 0,
    products: JSON.stringify(state.cartProducts.map(p => ({ id: p.id, qty: p.qty })))
  };

  if (state.selectedMethod === 'Cash') {
    const cashReceived = Number(document.getElementById('cashReceivedInput').value) || 0;
    const dueText = document.getElementById('totalDisplay').textContent;
    const due = Number(dueText.replace(/[^0-9.]/g, '')) || 0;
    if (cashReceived < due - 0.001) {
      CashierApp.toast('Cash received is less than the amount due.', 'error');
      return;
    }
    payload.cashReceived = cashReceived;
  }

  const btn = document.getElementById('btnProcessPayment');
  btn.disabled = true;

  const result = await CashierApp.post('payment.php', payload);

  if (result.success) {
    CashierApp.toast('Payment processed. Redirecting to receipt...', 'success');
    setTimeout(() => {
      window.location.href = `receipt.html?ref=${encodeURIComponent(result.reference)}&pid=${encodeURIComponent(result.paymentId)}`;
    }, 600);
  } else {
    CashierApp.toast(result.message || 'Failed to process payment.', 'error');
    btn.disabled = false;
  }
}


function wireStaticEvents() {
  document.getElementById('btnSellProduct').addEventListener('click', openProductModal);
  document.getElementById('btnCloseProductModal').addEventListener('click', () => CashierApp.hideModal('productSaleModal'));
  document.getElementById('productSearchInput').addEventListener('input', (e) => renderProductList(e.target.value));
  document.getElementById('productListContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('.product-pick-btn');
    if (!btn || btn.disabled) return;
    addProductToCart(btn.dataset.productId);
  });

  document.getElementById('cartItemsContainer').addEventListener('click', (e) => {
    const row = e.target.closest('[data-cart-product]');
    if (!row) return;
    const productId = row.dataset.cartProduct;
    if (e.target.closest('.cart-qty-btn')) {
      const action = e.target.closest('.cart-qty-btn').dataset.action;
      adjustCartQty(productId, action === 'inc' ? 1 : -1);
    } else if (e.target.closest('.cart-remove-btn')) {
      removeCartProduct(productId);
    }
  });

  document.querySelectorAll('.tip-btn').forEach(btn => {
    btn.addEventListener('click', () => setTip(btn.dataset.tip));
  });
  document.getElementById('customTipInput').addEventListener('input', (e) => setTip(e.target.value));
  document.getElementById('cashReceivedInput').addEventListener('input', renderTotals);

  document.querySelectorAll('.pay-method-card').forEach(card => {
    card.addEventListener('click', () => selectPaymentMethod(card.dataset.method));
  });

  // "Confirmed" has no button here -- that transition only happens through
  // the Appointments page's Admit Client flow, which collects the deposit
  // updateStatus.php requires for it.
  document.getElementById('btnWorkflowAction').addEventListener('click', () => {
    const currentIndex = STATUS_STEPS.indexOf(state.ticket.status);
    if (currentIndex === 0) updateTicketStatus('In Progress');
    else if (currentIndex === 1) updateTicketStatus('Completed');
  });

  document.getElementById('btnProcessPayment').addEventListener('click', processPayment);

  const verifyBody = document.getElementById('verifyTableBody');
  if (verifyBody) {
    verifyBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-verify');
      if (btn) openVerifyModal(btn.dataset.ref);
    });
  }
  const closeVerify = document.getElementById('btnCloseVerifyModal');
  if (closeVerify) closeVerify.addEventListener('click', () => CashierApp.hideModal('verifyModal'));
  const confirmVerifyBtn = document.getElementById('btnConfirmVerify');
  if (confirmVerifyBtn) confirmVerifyBtn.addEventListener('click', confirmVerify);
  const needsAttentionBtn = document.getElementById('btnNeedsAttention');
  if (needsAttentionBtn) needsAttentionBtn.addEventListener('click', markNeedsAttention);
}

document.addEventListener('DOMContentLoaded', init);
