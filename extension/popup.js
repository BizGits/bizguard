// BizGuard Popup Script

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const microsoftLoginBtn = document.getElementById('microsoft-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const enableToggle = document.getElementById('enable-toggle');
const toggleStatus = document.getElementById('toggle-status');
const statusBadge = document.getElementById('status-badge');
const brandSelect = document.getElementById('brand-select');
const brandHint = document.getElementById('brand-hint');
const refreshBrandsBtn = document.getElementById('refresh-brands');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userAvatar = document.getElementById('user-avatar');
const brandsCount = document.getElementById('brands-count');
const termsCount = document.getElementById('terms-count');

// State
let state = {
  isEnabled: true,
  isAuthenticated: false,
  currentBrand: null,
  brands: [],
  userProfile: null
};

// Initialize popup
async function init() {
  try {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    render();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Render UI based on state
function render() {
  if (state.isAuthenticated) {
    loginSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    renderMainSection();
  } else {
    loginSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
  }
  
  updateStatusBadge();
}

// Render main section
function renderMainSection() {
  // User info
  if (state.userProfile) {
    userName.textContent = state.userProfile.displayName || 'User';
    userEmail.textContent = state.userProfile.email || '';
    userAvatar.textContent = (state.userProfile.displayName || 'U').charAt(0).toUpperCase();
  }
  
  // Toggle
  enableToggle.checked = state.isEnabled;
  toggleStatus.textContent = state.isEnabled ? 'Enabled' : 'Disabled';
  toggleStatus.classList.toggle('disabled', !state.isEnabled);
  
  // Brands
  renderBrandSelect();
  
  // Stats
  brandsCount.textContent = state.brands.length;
  const totalTerms = state.brands.reduce((sum, b) => sum + (b.terms?.length || 0), 0);
  termsCount.textContent = totalTerms;
}

// Render brand select dropdown
function renderBrandSelect() {
  brandSelect.innerHTML = '<option value="">Select a brand...</option>';
  
  state.brands.forEach(brand => {
    const option = document.createElement('option');
    option.value = brand.id;
    option.textContent = `${brand.name} (${brand.terms?.length || 0} terms)`;
    if (state.currentBrand?.id === brand.id) {
      option.selected = true;
    }
    brandSelect.appendChild(option);
  });
  
  // Update hint
  if (state.currentBrand) {
    brandHint.textContent = `Monitoring for terms from other brands`;
  } else {
    brandHint.textContent = 'Select the brand you\'re currently working with';
  }
}

// Update status badge
function updateStatusBadge() {
  const statusText = statusBadge.querySelector('.status-text');
  
  if (!state.isAuthenticated) {
    statusBadge.className = 'status-badge inactive';
    statusText.textContent = 'Not logged in';
  } else if (!state.isEnabled) {
    statusBadge.className = 'status-badge inactive';
    statusText.textContent = 'Disabled';
  } else if (!state.currentBrand) {
    statusBadge.className = 'status-badge';
    statusText.textContent = 'No brand';
  } else {
    statusBadge.className = 'status-badge active';
    statusText.textContent = 'Active';
  }
}

// Event Handlers

// Microsoft login button
microsoftLoginBtn.addEventListener('click', async () => {
  // Show loading
  microsoftLoginBtn.disabled = true;
  microsoftLoginBtn.querySelector('.btn-text').textContent = 'Signing in...';
  microsoftLoginBtn.querySelector('.btn-loader').classList.remove('hidden');
  loginError.classList.add('hidden');
  
  try {
    const result = await chrome.runtime.sendMessage({ type: 'MICROSOFT_LOGIN' });
    
    if (result.success) {
      state.isAuthenticated = true;
      state.userProfile = result.user;
      
      // Refresh state to get brands
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      render();
    } else {
      loginError.textContent = result.error || 'Microsoft login failed';
      loginError.classList.remove('hidden');
    }
  } catch (error) {
    loginError.textContent = 'An error occurred. Please try again.';
    loginError.classList.remove('hidden');
  } finally {
    microsoftLoginBtn.disabled = false;
    microsoftLoginBtn.querySelector('.btn-text').textContent = 'Sign in with Microsoft';
    microsoftLoginBtn.querySelector('.btn-loader').classList.add('hidden');
  }
});

// Login form submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // Show loading
  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').textContent = 'Signing in...';
  loginBtn.querySelector('.btn-loader').classList.remove('hidden');
  loginError.classList.add('hidden');
  
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'LOGIN',
      email,
      password
    });
    
    if (result.success) {
      state.isAuthenticated = true;
      state.userProfile = result.user;
      
      // Refresh state to get brands
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      render();
    } else {
      loginError.textContent = result.error || 'Login failed';
      loginError.classList.remove('hidden');
    }
  } catch (error) {
    loginError.textContent = 'An error occurred. Please try again.';
    loginError.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.querySelector('.btn-text').textContent = 'Sign In';
    loginBtn.querySelector('.btn-loader').classList.add('hidden');
  }
});

// Logout button
logoutBtn.addEventListener('click', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'LOGOUT' });
  
  if (result.success) {
    state.isAuthenticated = false;
    state.userProfile = null;
    render();
  }
});

// Enable toggle
enableToggle.addEventListener('change', async () => {
  const enabled = enableToggle.checked;
  
  await chrome.runtime.sendMessage({
    type: 'SET_ENABLED',
    enabled
  });
  
  state.isEnabled = enabled;
  toggleStatus.textContent = enabled ? 'Enabled' : 'Disabled';
  toggleStatus.classList.toggle('disabled', !enabled);
  updateStatusBadge();
});

// Brand select
brandSelect.addEventListener('change', async () => {
  const brandId = brandSelect.value;
  const brand = state.brands.find(b => b.id === brandId) || null;
  
  await chrome.runtime.sendMessage({
    type: 'SET_CURRENT_BRAND',
    brand
  });
  
  state.currentBrand = brand;
  
  if (brand) {
    brandHint.textContent = `Monitoring for terms from other brands`;
  } else {
    brandHint.textContent = 'Select the brand you\'re currently working with';
  }
  
  updateStatusBadge();
});

// Refresh brands
refreshBrandsBtn.addEventListener('click', async () => {
  refreshBrandsBtn.style.transform = 'rotate(360deg)';
  refreshBrandsBtn.style.transition = 'transform 0.5s ease';
  
  const result = await chrome.runtime.sendMessage({ type: 'REFRESH_BRANDS' });
  
  if (result.brands) {
    state.brands = result.brands;
    renderBrandSelect();
    brandsCount.textContent = state.brands.length;
    const totalTerms = state.brands.reduce((sum, b) => sum + (b.terms?.length || 0), 0);
    termsCount.textContent = totalTerms;
  }
  
  setTimeout(() => {
    refreshBrandsBtn.style.transform = '';
    refreshBrandsBtn.style.transition = '';
  }, 500);
});

// Initialize
init();
