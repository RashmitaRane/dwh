document.addEventListener('DOMContentLoaded', async () => {
  if (typeof fetchAuthStatus === 'function') await fetchAuthStatus();
  if (!window.userAuthStatus?.is_authenticated) {
    window.location.href = '/catalog.html?checkout=login';
    return;
  }

  const cart = JSON.parse(sessionStorage.getItem('dwh_cart') || '[]');
  if (!cart.length) {
    window.location.href = '/catalog.html';
    return;
  }

  const stateSelect = document.getElementById('checkout-state');
  const districtSelect = document.getElementById('checkout-district');
  const addressForm = document.getElementById('checkout-address-form');
  const paymentForm = document.getElementById('checkout-payment-form');
  const alertBox = document.getElementById('checkout-alert');

  let orderTotal = 0;

  function showAlert(msg, type = 'error') {
    alertBox.hidden = false;
    alertBox.textContent = msg;
    alertBox.className = `checkout-alert ${type}`;
  }

  function getCsrfToken() {
    const parts = (`; ${document.cookie}`).split('; csrftoken=');
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  }

  function setStep(step) {
    document.querySelectorAll('.checkout-steps .step').forEach(el => {
      el.classList.toggle('active', el.dataset.step === String(step));
    });
    document.querySelectorAll('.checkout-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(step === 1 ? 'step-address' : step === 2 ? 'step-payment' : 'step-success').classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillStates() {
    if (!stateSelect || typeof INDIA_STATES === 'undefined') return;
    stateSelect.innerHTML = '<option value="">Select state</option>' +
      INDIA_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  function fillProfileForm(profile) {
    const form = addressForm;
    if (!form) return;
    Object.keys(profile).forEach(key => {
      const field = form.elements[key];
      if (field) field.value = profile[key] || '';
    });
    if (districtSelect && typeof getDistrictOptions === 'function') {
      districtSelect.innerHTML = getDistrictOptions(profile.state || '', profile.district || '');
    }
  }

  function renderCartSummary() {
    const box = document.getElementById('checkout-cart-summary');
    if (!box) return;
    orderTotal = cart.reduce((sum, item) => sum + Number(item.price) * (item.quantity || 1), 0);
    const lines = cart.map(item =>
      `<div class="checkout-line"><span>${item.quantity || 1}× ${item.name}</span><span>₹${(Number(item.price) * (item.quantity || 1)).toLocaleString('en-IN')}</span></div>`
    ).join('');
    box.innerHTML = `
      <h3>Order summary</h3>
      ${lines}
      <div class="checkout-line total"><span>Total</span><span>₹${orderTotal.toLocaleString('en-IN')}</span></div>
    `;
    const amountEl = document.getElementById('payment-amount-display');
    const qrImg = document.getElementById('payment-qr');
    if (amountEl) amountEl.textContent = `₹ ${orderTotal.toLocaleString('en-IN')}`;
    if (qrImg) qrImg.src = `/api/payment-qr/?amount=${orderTotal}`;
  }

  async function loadProfile() {
    const local = getStoredProfile();
    try {
      const res = await fetch('/api/profile/', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        fillProfileForm({ ...local, ...data, email: data.email || local.email });
        saveStoredProfile({ ...local, ...data });
        return;
      }
    } catch (e) { /* use local */ }
    fillProfileForm(local);
  }

  fillStates();
  renderCartSummary();
  await loadProfile();

  stateSelect?.addEventListener('change', () => {
    if (districtSelect && typeof getDistrictOptions === 'function') {
      districtSelect.innerHTML = getDistrictOptions(stateSelect.value);
    }
  });

  addressForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(addressForm);
    const profile = Object.fromEntries(formData.entries());
    saveStoredProfile(profile);

    try {
      const res = await fetch('/api/profile/save/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'same-origin',
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not save address.');
      setStep(2);
      alertBox.hidden = true;
    } catch (err) {
      showAlert(err.message);
    }
  });

  document.getElementById('back-to-address')?.addEventListener('click', () => setStep(1));

  paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('payment-pdf');
    const file = fileInput?.files?.[0];
    if (!file) {
      showAlert('Please upload your payment PDF.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showAlert('Only PDF files are allowed.');
      return;
    }

    const items = cart.map(item => ({
      name: item.name,
      price: item.price,
      image: item.img || item.image || '',
      quantity: item.quantity || 1,
    }));

    const body = new FormData();
    body.append('items', JSON.stringify(items));
    body.append('payment_proof', file);

    const btn = paymentForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
      const res = await fetch('/api/orders/submit/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
        credentials: 'same-origin',
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment submission failed.');

      sessionStorage.removeItem('dwh_cart');
      document.getElementById('success-order-number').textContent = data.order?.order_number || '';
      document.getElementById('success-message').textContent =
        'Your payment proof was received. Waiting for owner confirmation.';
      setStep(3);
      alertBox.hidden = true;
    } catch (err) {
      showAlert(err.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Submit payment'; }
    }
  });
});
function updatePaymentAmount() {
    const select = document.getElementById('payment-type-select');
    const display = document.getElementById('payment-amount-display');
    const total = orderTotal; // Your existing total variable
    
    const amountToPay = select.value === 'half' ? total / 2 : total;
    display.textContent = `₹ ${amountToPay.toLocaleString('en-IN')}`;
    
    // Update the QR code dynamically for the new amount
    document.getElementById('payment-qr').src = `/api/payment-qr/?amount=${amountToPay}`;
}