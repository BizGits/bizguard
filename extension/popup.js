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
  userProfile: null,
  connectionMode: 'unknown' // 'connected', 'limited', 'unauthenticated'
};

// Last error for diagnostics
let lastError = null;

// Initialize popup
async function init() {
  try {
    state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    
    // Check token validity if authenticated
    if (state.isAuthenticated) {
      const meResult = await chrome.runtime.sendMessage({ type: 'CHECK_TOKEN' });
      state.connectionMode = meResult.mode || 'limited';
    }
    
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
  } else if (state.connectionMode === 'limited') {
    statusBadge.className = 'status-badge warning';
    statusText.textContent = 'Limited';
  } else if (!state.currentBrand) {
    statusBadge.className = 'status-badge';
    statusText.textContent = 'No brand';
  } else {
    statusBadge.className = 'status-badge active';
    statusText.textContent = state.connectionMode === 'connected' ? 'Connected' : 'Active';
  }
}

// Event Handlers

// Microsoft login button
microsoftLoginBtn.addEventListener('click', async () => {
  // Show loading
  microsoftLoginBtn.disabled = true;
  microsoftLoginBtn.querySelector('.btn-text').textContent = 'Signing in...';
  microsoftLoginBtn.querySelector('.btn-loader').classList.remove('hidden');
  hideError();
  
  try {
    const result = await chrome.runtime.sendMessage({ type: 'MICROSOFT_LOGIN' });
    
    if (result.success) {
      state.isAuthenticated = true;
      state.userProfile = result.user;
      state.connectionMode = result.mode || 'limited';
      
      // Refresh state to get brands
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      
      // Check token validity
      const meResult = await chrome.runtime.sendMessage({ type: 'CHECK_TOKEN' });
      state.connectionMode = meResult.mode || 'limited';
      
      render();
    } else {
      showError(result.error || 'Microsoft login failed', result);
    }
  } catch (error) {
    showError('An error occurred. Please try again.', { caught: error.message });
  } finally {
    microsoftLoginBtn.disabled = false;
    microsoftLoginBtn.querySelector('.btn-text').textContent = 'Sign in with Microsoft';
    microsoftLoginBtn.querySelector('.btn-loader').classList.add('hidden');
  }
});

// Show error with diagnostics
function showError(message, details = null) {
  lastError = {
    message,
    details,
    timestamp: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
  };
  
  loginError.innerHTML = `
    <div class="error-message">${escapeHtml(message)}</div>
    <button type="button" class="copy-diagnostics-btn" id="copy-diagnostics">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      Copy Diagnostics
    </button>
  `;
  loginError.classList.remove('hidden');
  
  // Add click handler for copy button
  document.getElementById('copy-diagnostics').addEventListener('click', copyDiagnostics);
}

// Hide error
function hideError() {
  loginError.classList.add('hidden');
  loginError.innerHTML = '';
}

// Copy diagnostics to clipboard
async function copyDiagnostics() {
  if (!lastError) return;
  
  const diagnostics = `BizGuard Extension Diagnostics
================================
Time: ${lastError.timestamp}
Version: ${lastError.extensionVersion}
User Agent: ${lastError.userAgent}

Error: ${lastError.message}

Details:
${JSON.stringify(lastError.details, null, 2)}
`;

  try {
    await navigator.clipboard.writeText(diagnostics);
    const btn = document.getElementById('copy-diagnostics');
    if (btn) {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy Diagnostics
        `;
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Login form submit
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  // Show loading
  loginBtn.disabled = true;
  loginBtn.querySelector('.btn-text').textContent = 'Signing in...';
  loginBtn.querySelector('.btn-loader').classList.remove('hidden');
  hideError();
  
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'LOGIN',
      email,
      password
    });
    
    if (result.success) {
      state.isAuthenticated = true;
      state.userProfile = result.user;
      state.connectionMode = 'connected';
      
      // Refresh state to get brands
      state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      render();
    } else {
      showError(result.error || 'Login failed', result);
    }
  } catch (error) {
    showError('An error occurred. Please try again.', { caught: error.message });
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
