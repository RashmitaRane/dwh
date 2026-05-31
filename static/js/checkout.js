document.addEventListener('DOMContentLoaded', async () => {
  if (typeof fetchAuthStatus === 'function') await fetchAuthStatus();
  if (!window.userAuthStatus?.is_authenticated) {
    window.location.href = '/catalog.html?checkout=login';
    return;
  }

  const cart = JSON.parse(localStorage.getItem('dwh_cart') || '[]');
  if (!cart.length) {
    window.location.href = '/catalog.html';
    return;
  }

  const stateSelect = document.getElementById('checkout-state');
  const districtSelect = document.getElementById('checkout-district');
  const addressForm = document.getElementById('checkout-address-form');
  const paymentForm = document.getElementById('checkout-payment-form');
  const paymentTypeSelect = document.getElementById('payment-type-select');
  const alertBox = document.getElementById('checkout-alert');

  let orderTotal = 0;
  let selectedPaymentType = 'full';

  function computeHalfPaymentAmount(price) {
    const value = Number(price) || 0;
    // Use the custom half-payment rule: ~63.33% of the watch price,
    // e.g. ₹3,000 becomes ₹1,900 per watch.
    return Math.max(0, Math.round(value * 0.6333333));
  }

  function getAmountToPay(items, type) {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 1) || 1;
      const price = Number(item.price) || 0;
      if (type === 'half') {
        return sum + computeHalfPaymentAmount(price) * quantity;
      }
      return sum + price * quantity;
    }, 0);
  }

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
    const lines = cart.map(item => {
      const qty = Number(item.quantity || 1) || 1;
      return `<div class="checkout-line"><span>${qty}× ${item.name}</span><span>₹${(Number(item.price) * qty).toLocaleString('en-IN')}</span></div>`;
    }).join('');
    box.innerHTML = `
      <h3>Order summary</h3>
      ${lines}
      <div class="checkout-line total"><span>Total</span><span>₹${orderTotal.toLocaleString('en-IN')}</span></div>
    `;
    updatePaymentAmount();
  }

  function updatePaymentAmount() {
    const amountEl = document.getElementById('payment-amount-display');
    const qrImg = document.getElementById('payment-qr');
    if (!amountEl || !qrImg) return;

    selectedPaymentType = paymentTypeSelect?.value || 'full';
    const amountToPay = getAmountToPay(cart, selectedPaymentType);
    amountEl.textContent = `₹ ${amountToPay.toLocaleString('en-IN')}`;
    qrImg.src = `/api/payment-qr/?amount=${amountToPay}`;
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

  paymentTypeSelect?.addEventListener('change', updatePaymentAmount);

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
    const fileInput = document.getElementById('payment-proof');
    const file = fileInput?.files?.[0];
    if (!file) {
      showAlert('Please upload your payment screenshot.');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showAlert('Only JPG and PNG images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showAlert('The image size exceeds the 5MB limit. Please upload a smaller image.');
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
    body.append('payment_type', paymentTypeSelect?.value || 'full');

    const btn = paymentForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }

    try {
      const res = await fetch('/api/orders/submit/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
        credentials: 'same-origin',
        body,
      });
      
      let data = {};
      try {
        data = await res.json();
      } catch (err) {
        throw new Error(`Server error (${res.status}): Expected JSON but received HTML. Please check your Django terminal for the actual Python error.`);
      }
      
      if (!res.ok) throw new Error(data.message || 'Payment submission failed.');

      localStorage.removeItem('dwh_cart');
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
