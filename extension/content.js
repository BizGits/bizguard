// BizGuard Content Script - Term Detection & Blocking

let brands = [];
let currentBrand = null;
let isEnabled = true;
let observer = null;

// Initialize
async function init() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  brands = state.brands || [];
  currentBrand = state.currentBrand;
  isEnabled = state.isEnabled;
  
  if (isEnabled && currentBrand) {
    startMonitoring();
  }
  
  console.log('BizGuard content script loaded', { 
    brandsCount: brands.length, 
    currentBrand: currentBrand?.name,
    isEnabled 
  });
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'BRANDS_UPDATED':
      brands = message.brands;
      break;
    case 'BRAND_CHANGED':
      currentBrand = message.currentBrand;
      if (isEnabled && currentBrand) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
      break;
    case 'ENABLED_CHANGED':
      isEnabled = message.isEnabled;
      if (isEnabled && currentBrand) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
      break;
  }
});

// Get terms from other brands (not the current one)
function getBlockedTerms() {
  if (!currentBrand) return [];
  
  const blockedTerms = [];
  brands.forEach(brand => {
    if (brand.id !== currentBrand.id) {
      brand.terms.forEach(term => {
        blockedTerms.push({
          term: term.toLowerCase(),
          brandId: brand.id,
          brandName: brand.name
        });
      });
    }
  });
  
  return blockedTerms;
}

// Check text for blocked terms
function checkForBlockedTerms(text) {
  const blockedTerms = getBlockedTerms();
  const lowerText = text.toLowerCase();
  const found = [];
  
  blockedTerms.forEach(({ term, brandId, brandName }) => {
    if (lowerText.includes(term)) {
      found.push({ term, brandId, brandName });
    }
  });
  
  return found;
}

// Show warning overlay
function showWarning(term, brandName, element) {
  // Remove any existing warnings on this element
  const existingWarning = element.querySelector('.bizguard-warning');
  if (existingWarning) return;
  
  // Create warning element using safe DOM manipulation (prevents XSS)
  const warning = document.createElement('div');
  warning.className = 'bizguard-warning';
  
  const content = document.createElement('div');
  content.className = 'bizguard-warning-content';
  
  const icon = document.createElement('div');
  icon.className = 'bizguard-warning-icon';
  icon.textContent = '⚠️';
  
  const textDiv = document.createElement('div');
  textDiv.className = 'bizguard-warning-text';
  
  const title = document.createElement('strong');
  title.textContent = 'Brand Mismatch Detected!';
  
  const message = document.createElement('p');
  message.textContent = 'You\'re typing a term from ';
  const brandNameStrong = document.createElement('strong');
  brandNameStrong.textContent = brandName;
  message.appendChild(brandNameStrong);
  message.appendChild(document.createTextNode(' while working on '));
  const currentBrandStrong = document.createElement('strong');
  currentBrandStrong.textContent = currentBrand.name;
  message.appendChild(currentBrandStrong);
  
  const termP = document.createElement('p');
  termP.className = 'bizguard-term';
  termP.textContent = `Term: "${term}"`;
  
  textDiv.appendChild(title);
  textDiv.appendChild(message);
  textDiv.appendChild(termP);
  
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'bizguard-dismiss';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    warning.remove();
  });
  
  content.appendChild(icon);
  content.appendChild(textDiv);
  content.appendChild(dismissBtn);
  warning.appendChild(content);
  
  // Position relative to element
  element.style.position = element.style.position || 'relative';
  element.appendChild(warning);
  
  // Log the blocked event
  chrome.runtime.sendMessage({
    type: 'TERM_BLOCKED',
    term,
    brandId: brands.find(b => b.name === brandName)?.id
  });
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
    }
  }, 10000);
}

// Monitor text inputs
function monitorElement(element) {
  if (element.dataset.bizguardMonitored) return;
  element.dataset.bizguardMonitored = 'true';
  
  const checkElement = () => {
    if (!isEnabled || !currentBrand) return;
    
    const text = element.value || element.textContent || element.innerText || '';
    const foundTerms = checkForBlockedTerms(text);
    
    foundTerms.forEach(({ term, brandName }) => {
      showWarning(term, brandName, element.parentElement || element);
    });
  };
  
  // Check on input
  element.addEventListener('input', debounce(checkElement, 500));
  element.addEventListener('paste', () => setTimeout(checkElement, 100));
  
  // Check on blur
  element.addEventListener('blur', checkElement);
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Find and monitor all text inputs
function findAndMonitorInputs() {
  const selectors = [
    'textarea',
    'input[type="text"]',
    'input[type="email"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.public-DraftEditor-content', // Draft.js
    '.ql-editor', // Quill
    '.ProseMirror', // ProseMirror
    '.note-editable', // Summernote
    '.cke_editable', // CKEditor
    '.tox-edit-area__iframe', // TinyMCE
  ];
  
  const elements = document.querySelectorAll(selectors.join(', '));
  elements.forEach(monitorElement);
  
  // Also check iframes
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.querySelectorAll(selectors.join(', ')).forEach(monitorElement);
      }
    } catch (e) {
      // Cross-origin iframe, skip
    }
  });
}

// Start monitoring DOM
function startMonitoring() {
  stopMonitoring(); // Clean up first
  
  // Initial scan
  findAndMonitorInputs();
  
  // Watch for new elements
  observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
      }
    });
    
    if (shouldScan) {
      findAndMonitorInputs();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('BizGuard monitoring started');
}

// Stop monitoring
function stopMonitoring() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  
  // Remove all warnings
  document.querySelectorAll('.bizguard-warning').forEach(el => el.remove());
  
  // Clear monitored flags
  document.querySelectorAll('[data-bizguard-monitored]').forEach(el => {
    delete el.dataset.bizguardMonitored;
  });
  
  console.log('BizGuard monitoring stopped');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
