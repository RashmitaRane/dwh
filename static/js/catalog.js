// --- 1. Watch Database (Admin Uploads) ---
const allWatches = [
  { id: 1, name: 'HMT Himalaya', price: 2800, img: '../static/images/bestseller1.png' },
  { id: 2, name: 'HMT Pilot', price: 2800, img: '../static/images/bestseller21.png' },
  { id: 3, name: 'HMT Janata', price: 2100, img: '../static/images/bestseller3.png' },
  { id: 4, name: 'HMT Mechanical', price: 3200, img: '../static/images/bestseller42.png' },
  { id: 5, name: 'HMT Kohinoor', price: 2500, img: '../static/images/img1.png' },
  { id: 6, name: 'HMT Rajat', price: 4100, img: '../static/images/img3.png' }
];

// --- 2. Profile Dropdown & Login Modal Logic ---
const loginTrigger = document.getElementById('login-trigger');
const dropdownTrigger = document.getElementById('dropdown-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const loginModal = document.getElementById('login-modal');
const closeLogin = document.getElementById('close-login');

// Toggle Dropdown Menu when 'v' is clicked
if (dropdownTrigger) {
  dropdownTrigger.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation(); // Stops the click from instantly closing the menu
    if (profileDropdown) profileDropdown.classList.toggle('show');
  });
}

// Open Login Modal when "Login" text/icon is clicked
if (loginTrigger) {
  loginTrigger.addEventListener('click', function(e) {
    e.preventDefault();
    if (loginModal) loginModal.classList.add('show');
    if (profileDropdown) profileDropdown.classList.remove('show'); 
  });
}

// Close Login Modal when 'X' is clicked
if (closeLogin) {
  closeLogin.addEventListener('click', function() {
    if (loginModal) loginModal.classList.remove('show');
  });
}

// Close dropdown and modal when clicking anywhere outside
window.addEventListener('click', function(e) {
  // Close Dropdown
  if (profileDropdown && profileDropdown.classList.contains('show')) {
    if (dropdownTrigger && !dropdownTrigger.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.classList.remove('show');
    }
  }
  
  // Close Modal
  if (loginModal && e.target === loginModal) {
    loginModal.classList.remove('show');
  }
});

// --- 3. Catalog Display & Search Logic ---
const catalogGrid = document.getElementById('catalog-grid');
const searchInput = document.getElementById('catalog-search');
const searchCount = document.getElementById('search-count');

function renderWatches(watchArray) {
  catalogGrid.innerHTML = ''; // Clear grid
  
  if (watchArray.length === 0) {
    catalogGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">No watches found matching your search.</p>';
    return;
  }

  watchArray.forEach(watch => {
    catalogGrid.innerHTML += `
      <div class="product-card reveal-card active">
        <div class="product-image-wrapper">
          <img src="${watch.img}" alt="${watch.name}">
        </div>
        <div class="product-info">
          <h3>${watch.name}</h3>
          <div class="price">₹${watch.price.toLocaleString()}</div>
          <button class="btn-add" onclick="addToCart('${watch.name}', ${watch.price}, '${watch.img}')">Add to cart</button>
        </div>
      </div>
    `;
  });
}

// Listen for typing in the search bar
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredWatches = allWatches.filter(watch => 
      watch.name.toLowerCase().includes(searchTerm)
    );
    
    renderWatches(filteredWatches);
    
    // Update count text
    if (searchTerm.length > 0) {
      searchCount.innerText = `Showing ${filteredWatches.length} results`;
    } else {
      searchCount.innerText = '';
    }
  });
}

// Load all watches when page first opens
if (catalogGrid) {
  renderWatches(allWatches);
}

// --- 4. Sliding Cart Logic (Copied from Index so it works here) ---
let cart = [];

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('show');
}

function addToCart(name, price, imgSrc) {
  cart.push({ name, price, img: imgSrc });
  document.getElementById('cart-badge').innerText = cart.length;
  updateCartDisplay();
  toggleCart(); // Auto-open cart
}

function updateCartDisplay() {
  const container = document.getElementById('cart-items-container');
  const totalPriceElement = document.getElementById('cart-total-price');
  container.innerHTML = '';
  
  let total = 0;

  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-msg">Your cart is currently empty.</p>';
  } else {
    cart.forEach((item, index) => {
      total += item.price;
      container.innerHTML += `
        <div class="cart-item">
          <img src="${item.img}" alt="${item.name}">
          <div class="cart-item-info">
            <h3>${item.name}</h3>
            <p class="price">₹${item.price.toLocaleString()}</p>
            <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer; font-size:0.8rem; padding:0;">Remove</button>
          </div>
        </div>
      `;
    });
  }
  if (totalPriceElement) {
    totalPriceElement.innerText = `₹${total.toLocaleString()}`;
  }
}

function removeFromCart(index) {
  cart.splice(index, 1);
  document.getElementById('cart-badge').innerText = cart.length;
  updateCartDisplay();
}