// --- 1. Mobile Click Support for the New Account Dropdown ---
const accountTrigger = document.getElementById('account-trigger');
const accountDropdown = document.getElementById('account-dropdown');

if (accountTrigger) {
  accountTrigger.addEventListener('click', function(e) {
    if (accountDropdown.contains(e.target)) return; 
    e.preventDefault();
    accountDropdown.classList.toggle('show');
  });
}

window.addEventListener('click', function(e) {
  if (accountDropdown && accountDropdown.classList.contains('show')) {
    if (accountTrigger && !accountTrigger.contains(e.target)) {
      accountDropdown.classList.remove('show');
    }
  }
});

// --- 2. Sliding Cart Toggle Logic ---
function toggleCart() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
}

// --- 3. Search Bar Typing Animation ---
const searchInput = document.getElementById('animated-search');

// Only run the animation if the user hasn't already typed something in
if (searchInput && !searchInput.value) {
    const placeholderTexts = [
        "Search 'HMT Janata'...", 
        "Search 'HMT Rajat'...", 
        "Search 'HMT Kohinoor'...", 
        "Search 'HMT Himalaya'..."
    ];
    
    let textIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typePlaceholder() {
        const currentText = placeholderTexts[textIndex];
        
        if (isDeleting) {
            charIndex--;
        } else {
            charIndex++;
        }

        searchInput.setAttribute('placeholder', currentText.substring(0, charIndex));

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentText.length) {
            typeSpeed = 2000; 
            isDeleting = true;
        } 
        else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            textIndex = (textIndex + 1) % placeholderTexts.length;
            typeSpeed = 500; 
        }

        setTimeout(typePlaceholder, typeSpeed);
    }
    
    setTimeout(typePlaceholder, 1000);
}

if (searchInput) {
    searchInput.addEventListener('focus', function() {
        this.setAttribute('placeholder', 'Search...');
    });
}