// --- Force Page to Top on Refresh ---
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);
// --- Cart Logic ---
let cartCount = 0;

function addToCart() {
  cartCount++;
  document.getElementById('cart-badge').innerText = cartCount;
  alert("Watch added to your cart!");
}

// --- Preload Images for Smooth Sliding ---
const imageUrls = [
  '../static/images/logo.png',
  '../static/images/img1.png',
  '../static/images/img2.png',
  '../static/images/img3.png',
  '../static/images/img4.png'
];

function preloadImages(urls) {
  urls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

// Preload images on page load
preloadImages(imageUrls);


// --- Sticky Header Logic ---
const header = document.querySelector('header');

function checkScroll() {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

// Run the check when the user scrolls
window.addEventListener('scroll', checkScroll);

// Run the check IMMEDIATELY when the page refreshes!
checkScroll();


// --- Hero Slider Logic ---
let currentSlideIndex = 0;
const slider = document.getElementById('slider');
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;

// Make the very first slide active when the page loads
if(slides.length > 0) {
  slides[0].classList.add('active');
}

function updateSliderPosition() {
  // Move the slider visually
  slider.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
  
  // Remove 'active' class from ALL slides
  slides.forEach(slide => slide.classList.remove('active'));
  
  // Force browser reflow to restart CSS animation, wait 10ms
  setTimeout(() => {
    slides[currentSlideIndex].classList.add('active');
  }, 10);
}

function moveSlide(direction) {
  currentSlideIndex += direction;
  
  if (currentSlideIndex >= totalSlides) {
    currentSlideIndex = 0;
  } else if (currentSlideIndex < 0) {
    currentSlideIndex = totalSlides - 1;
  }
  
  updateSliderPosition();
}


// --- Scroll Reveal Animation ---
const revealElements = document.querySelectorAll('.reveal, .reveal-card');

const revealOptions = {
  threshold: 0.15, // Triggers when 15% is visible
  rootMargin: "0px 0px -50px 0px"
};

const revealOnScroll = new IntersectionObserver(function(entries, observer) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      return;
    } else {
      entry.target.classList.add('active');
      observer.unobserve(entry.target); 
    }
  });
}, revealOptions);

revealElements.forEach(el => {
  revealOnScroll.observe(el);
});
// --- Cart Logic ---
let cart = [];

function toggleCart() {
  document.getElementById('cart-sidebar').classList.toggle('open');
  document.getElementById('cart-overlay').classList.toggle('show');
}

function addToCart(name, price, imgSrc) {
  // Add item to array
  cart.push({ name, price, img: imgSrc });
  
  // Update badge
  document.getElementById('cart-badge').innerText = cart.length;
  
  // Refresh the cart display
  renderCart();
  
  // Automatically open cart to show the item was added
  toggleCart();
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const totalPriceElement = document.getElementById('cart-total-price');
  container.innerHTML = '';
  
  let total = 0;

  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-msg">Your cart is currently empty.</p>';
  } else {
    cart.forEach((item, index) => {
      total += item.price;
      
      const itemElement = document.createElement('div');
      itemElement.className = 'cart-item';
      itemElement.innerHTML = `
        <img src="${item.img}" alt="${item.name}">
        <div class="cart-item-info">
          <h3>${item.name}</h3>
          <p class="price">₹${item.price.toLocaleString()}</p>
          <button onclick="removeFromCart(${index})" style="background:none; border:none; color:red; cursor:pointer; font-size:0.8rem; padding:0;">Remove</button>
        </div>
      `;
      container.appendChild(itemElement);
    });
  }
  
  totalPriceElement.innerText = `₹${total.toLocaleString()}`;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  document.getElementById('cart-badge').innerText = cart.length;
  renderCart();
}
// Profile Dropdown Toggle
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');

if (profileTrigger) {
  profileTrigger.addEventListener('click', function(e) {
    e.preventDefault();
    profileDropdown.classList.toggle('show');
  });
}

// Close dropdown when clicking outside
window.addEventListener('click', function(e) {
  if (profileTrigger && !profileTrigger.contains(e.target)) {
    profileDropdown.classList.remove('show');
  }
});