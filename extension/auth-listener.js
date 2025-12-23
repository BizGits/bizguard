// Content script that runs on the web app's extension-auth page
// to communicate auth results back to the extension

(function() {
  // Only run on extension-auth pages
  if (!window.location.pathname.includes('extension-auth')) {
    return;
  }

  console.log('BizGuard auth listener active');

  // Check for auth data in localStorage
  const checkAuthData = () => {
    try {
      const authDataStr = localStorage.getItem('bizguard_extension_auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        console.log('Found auth data, sending to extension');
        
        // Send to background script via chrome.storage
        chrome.storage.local.set({ pendingAuthData: authData }, () => {
          console.log('Auth data saved to extension storage');
          // Clear the localStorage
          localStorage.removeItem('bizguard_extension_auth');
        });
      }
    } catch (e) {
      console.error('Error checking auth data:', e);
    }
  };

  // Check immediately
  checkAuthData();

  // Also listen for storage changes
  window.addEventListener('storage', (event) => {
    if (event.key === 'bizguard_extension_auth' && event.newValue) {
      checkAuthData();
    }
  });

  // Poll periodically in case storage event is missed
  const pollInterval = setInterval(checkAuthData, 500);

  // Stop polling after 2 minutes
  setTimeout(() => {
    clearInterval(pollInterval);
  }, 120000);
})();
