// BizGuard Background Service Worker
const API_BASE = 'https://livbbxegwifbhtboyczy.supabase.co/functions/v1';
const SUPABASE_URL = 'https://livbbxegwifbhtboyczy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmJieGVnd2lmYmh0Ym95Y3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMTMsImV4cCI6MjA4MTAyMDIxM30.hBcAWcwAdK4Rx-lrVWRTYKqi2ttjgVbAZRCP4jHUN2Y';

// State
let brands = [];
let currentBrand = null;
let isEnabled = true;
let authToken = null;
let userProfile = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('BizGuard v5 installed');
  await loadState();
  await fetchBrands();
  setupHeartbeat();
});

// On startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('BizGuard starting up');
  await loadState();
  await fetchBrands();
  setupHeartbeat();
});

// Load state from storage
async function loadState() {
  const data = await chrome.storage.local.get([
    'isEnabled',
    'currentBrand',
    'authToken',
    'userProfile',
    'brands'
  ]);
  
  isEnabled = data.isEnabled !== false;
  currentBrand = data.currentBrand || null;
  authToken = data.authToken || null;
  userProfile = data.userProfile || null;
  brands = data.brands || [];
  
  console.log('State loaded:', { isEnabled, currentBrand: currentBrand?.name, hasAuth: !!authToken });
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({
    isEnabled,
    currentBrand,
    authToken,
    userProfile,
    brands
  });
}

// Fetch brands from API
async function fetchBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    if (!response.ok) throw new Error('Failed to fetch brands');
    
    brands = await response.json();
    await chrome.storage.local.set({ brands });
    
    console.log(`Loaded ${brands.length} brands`);
    
    // Notify content scripts
    notifyContentScripts({ type: 'BRANDS_UPDATED', brands });
    
    return brands;
  } catch (error) {
    console.error('Error fetching brands:', error);
    return brands; // Return cached brands
  }
}

// Setup heartbeat alarm (every 2 minutes)
function setupHeartbeat() {
  chrome.alarms.create('heartbeat', { periodInMinutes: 2 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'heartbeat') {
      await sendHeartbeat();
    }
  });
  // Send initial heartbeat
  sendHeartbeat();
}

// Send heartbeat to server
async function sendHeartbeat() {
  if (!authToken) return;
  
  try {
    const browserInfo = getBrowserInfo();
    
    const response = await fetch(`${API_BASE}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        browser: browserInfo.name,
        browser_version: browserInfo.version,
        extension_version: chrome.runtime.getManifest().version,
        is_active: isEnabled
      })
    });
    
    if (response.ok) {
      console.log('Heartbeat sent successfully');
    }
  } catch (error) {
    console.error('Heartbeat error:', error);
  }
}

// Update extension status on server
async function updateExtensionStatus(active) {
  if (!authToken) return;
  
  try {
    const browserInfo = getBrowserInfo();
    
    await fetch(`${API_BASE}/extension-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        is_active: active,
        browser: browserInfo.name,
        browser_version: browserInfo.version,
        extension_version: chrome.runtime.getManifest().version
      })
    });
  } catch (error) {
    console.error('Error updating extension status:', error);
  }
}

// Log event to server
async function logEvent(action, data = {}) {
  if (!authToken) return;
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        action,
        user_id: userProfile?.id,
        brand_id: data.brandId || currentBrand?.id || null,
        term: data.term || null,
        url: data.url || null
      })
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

// Get browser info
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '0';
  
  if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.match(/Edg\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Chrome/')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/(\d+)/)?.[1] || '0';
  }
  
  return { name, version };
}

// Notify all content scripts
function notifyContentScripts(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_STATE':
      return {
        isEnabled,
        currentBrand,
        brands,
        isAuthenticated: !!authToken || !!userProfile,
        userProfile,
        connectionMode: authToken ? 'connected' : (userProfile ? 'limited' : 'unauthenticated')
      };
    
    case 'CHECK_TOKEN':
      return await checkTokenValidity();
    
    case 'SET_ENABLED':
      isEnabled = message.enabled;
      await saveState();
      await updateExtensionStatus(isEnabled);
      await logEvent(isEnabled ? 'TOGGLED_ON' : 'TOGGLED_OFF');
      notifyContentScripts({ type: 'ENABLED_CHANGED', isEnabled });
      return { success: true };
    
    case 'SET_CURRENT_BRAND':
      currentBrand = message.brand;
      await saveState();
      notifyContentScripts({ type: 'BRAND_CHANGED', currentBrand });
      return { success: true };
    
    case 'LOGIN':
      return await handleLogin(message.email, message.password);
    
    case 'MICROSOFT_LOGIN':
      return await handleMicrosoftLogin();
    
    case 'LOGOUT':
      return await handleLogout();
    
    case 'REFRESH_BRANDS':
      const updatedBrands = await fetchBrands();
      return { brands: updatedBrands };
    
    case 'TERM_BLOCKED':
      await logEvent('BLOCKED', {
        term: message.term,
        brandId: message.brandId,
        url: sender.tab?.url
      });
      return { success: true };
    
    default:
      return { error: 'Unknown message type' };
  }
}

// Check token validity via /me endpoint
async function checkTokenValidity() {
  if (!authToken) {
    return { 
      valid: false, 
      mode: userProfile ? 'limited' : 'unauthenticated',
      user: userProfile
    };
  }
  
  try {
    const response = await fetch(`${API_BASE}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.valid) {
      // Update user profile with fresh data
      if (data.user) {
        userProfile = {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName
        };
        await saveState();
      }
      return { valid: true, mode: 'connected', user: data.user };
    } else {
      console.log('Token invalid:', data.error);
      return { valid: false, mode: 'limited', user: userProfile, error: data.error };
    }
  } catch (error) {
    console.error('Error checking token:', error);
    return { valid: false, mode: 'limited', user: userProfile, error: error.message };
  }
}

// Handle login with Supabase
async function handleLogin(email, password) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error_description || data.msg || 'Login failed');
    }
    
    authToken = data.access_token;
    userProfile = {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.full_name || data.user.email
    };
    
    await saveState();
    await updateExtensionStatus(isEnabled);
    await logEvent('LOGIN');
    
    console.log('Login successful:', userProfile.email);
    
    return { success: true, user: userProfile };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// Handle Microsoft/Azure AD login
async function handleMicrosoftLogin() {
  const diagnostics = {
    startTime: new Date().toISOString(),
    steps: [],
    errors: []
  };

  try {
    // Generate PKCE code verifier and challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    diagnostics.steps.push('PKCE generated');
    console.log('Starting Microsoft login with PKCE');
    
    // Get Azure auth URL from our edge function
    let initResponse;
    try {
      initResponse = await fetch(`${API_BASE}/azure-auth-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirectUri: chrome.identity.getRedirectURL(),
          codeChallenge: codeChallenge
        })
      });
    } catch (fetchError) {
      diagnostics.errors.push(`Init fetch failed: ${fetchError.message}`);
      return { success: false, error: 'Network error connecting to auth server', diagnostics };
    }

    if (!initResponse.ok) {
      const errorData = await initResponse.text();
      diagnostics.errors.push(`Init response not ok: ${initResponse.status} - ${errorData}`);
      return { success: false, error: 'Failed to initialize Azure login', diagnostics };
    }

    const { authUrl, state } = await initResponse.json();
    diagnostics.steps.push('Got auth URL');
    console.log('Got auth URL, launching web auth flow');

    // Launch OAuth flow
    let responseUrl;
    try {
      responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: authUrl,
            interactive: true
          },
          (redirectUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(redirectUrl);
            }
          }
        );
      });
      diagnostics.steps.push('Web auth flow completed');
    } catch (authFlowError) {
      diagnostics.errors.push(`Web auth flow error: ${authFlowError.message}`);
      return { success: false, error: `Authentication window error: ${authFlowError.message}`, diagnostics };
    }

    console.log('Web auth flow completed');

    // Extract authorization code from redirect URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      const errorDesc = url.searchParams.get('error_description') || error;
      diagnostics.errors.push(`Azure error: ${errorDesc}`);
      return { success: false, error: errorDesc, diagnostics };
    }

    if (!code) {
      diagnostics.errors.push('No authorization code in redirect URL');
      return { success: false, error: 'No authorization code received', diagnostics };
    }

    diagnostics.steps.push('Got authorization code');
    console.log('Got authorization code, exchanging for session');

    // Exchange code for session via our edge function with PKCE verifier
    let callbackResponse;
    let callbackData;
    try {
      callbackResponse = await fetch(`${API_BASE}/azure-auth-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirectUri: chrome.identity.getRedirectURL(),
          codeVerifier: codeVerifier
        })
      });

      callbackData = await callbackResponse.json();
      diagnostics.steps.push('Callback response received');
      diagnostics.callbackKeys = Object.keys(callbackData);
    } catch (callbackError) {
      diagnostics.errors.push(`Callback fetch failed: ${callbackError.message}`);
      return { success: false, error: 'Failed to complete authentication with server', diagnostics };
    }

    if (!callbackResponse.ok || callbackData.error) {
      diagnostics.errors.push(`Callback error: ${callbackData.message || callbackData.error}`);
      return { success: false, error: callbackData.message || callbackData.error || 'Authentication failed', diagnostics };
    }

    console.log('Got callback response:', { 
      hasEmail: !!callbackData.email, 
      hasMagicLink: !!callbackData.magicLink,
      hasTokenHash: !!callbackData.tokenHash,
      hasUserData: !!callbackData.userData
    });

    // Extract user profile from callback data - this is the critical part
    // Server already verified the user via Azure AD, so we trust this data
    if (callbackData.userData) {
      userProfile = {
        id: callbackData.userData.id,
        email: callbackData.userData.email,
        displayName: callbackData.userData.displayName || callbackData.userData.email.split('@')[0]
      };
      diagnostics.steps.push('User profile set from userData');
    } else if (callbackData.email) {
      userProfile = {
        id: callbackData.userId,
        email: callbackData.email,
        displayName: callbackData.displayName || callbackData.email.split('@')[0]
      };
      diagnostics.steps.push('User profile set from email fields');
    } else {
      diagnostics.errors.push('No user data in callback response');
      return { success: false, error: 'No user data received from server', diagnostics };
    }

    // At this point we have a valid user profile from the server
    // Token verification is optional - we'll try but won't fail if it doesn't work
    let tokenObtained = false;
    let connectionMode = 'limited';
    
    // Try token hash verification first (most reliable)
    if (callbackData.tokenHash) {
      try {
        const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/verify?token=${callbackData.tokenHash}&type=magiclink`, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_ANON_KEY
          },
          redirect: 'manual'
        });
        
        if (verifyResponse.status === 303 || verifyResponse.status === 302) {
          const location = verifyResponse.headers.get('location');
          if (location) {
            const redirectUrl = new URL(location);
            const hashParams = new URLSearchParams(redirectUrl.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            
            if (accessToken) {
              authToken = accessToken;
              tokenObtained = true;
              connectionMode = 'connected';
              diagnostics.steps.push('Token obtained from hash verification');
              console.log('Access token obtained from token hash verification');
            }
          }
        } else {
          diagnostics.steps.push(`Token hash verify status: ${verifyResponse.status}`);
        }
      } catch (verifyError) {
        diagnostics.steps.push(`Token hash verify error: ${verifyError.message}`);
        console.warn('Token hash verification failed:', verifyError);
      }
    }
    
    // Fallback: Try magic link verification
    if (!tokenObtained && callbackData.magicLink) {
      try {
        const { access_token } = await verifyMagicLink(callbackData.magicLink);
        if (access_token) {
          authToken = access_token;
          tokenObtained = true;
          connectionMode = 'connected';
          diagnostics.steps.push('Token obtained from magic link');
          console.log('Access token obtained from magic link verification');
        }
      } catch (verifyError) {
        diagnostics.steps.push(`Magic link verify error: ${verifyError.message}`);
        console.warn('Magic link verification failed:', verifyError);
      }
    }

    // Save state - we have a valid user profile regardless of token status
    await saveState();
    diagnostics.steps.push('State saved');
    
    // If we have a token, register status and log event
    if (authToken) {
      try {
        await updateExtensionStatus(isEnabled);
        await logEvent('LOGIN');
        diagnostics.steps.push('Status and login event logged');
      } catch (apiError) {
        diagnostics.steps.push(`API call error: ${apiError.message}`);
      }
    }

    diagnostics.endTime = new Date().toISOString();
    diagnostics.steps.push(`Login complete - mode: ${connectionMode}`);
    console.log('Microsoft login successful:', userProfile?.email, 'Token:', tokenObtained ? 'Yes' : 'Limited mode');

    // SUCCESS! Return user data even if we don't have a token (limited mode)
    return { 
      success: true, 
      user: userProfile, 
      mode: connectionMode,
      diagnostics 
    };
  } catch (error) {
    diagnostics.errors.push(`Unexpected error: ${error.message}`);
    diagnostics.stack = error.stack;
    console.error('Microsoft login error:', error);
    return { success: false, error: error.message, diagnostics };
  }
}

// Generate PKCE code verifier (random 43-128 character string)
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Generate PKCE code challenge from verifier (SHA256 hash, base64url encoded)
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Base64url encode
function base64UrlEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Verify magic link and get session
async function verifyMagicLink(magicLink) {
  try {
    // Parse the magic link to get the token
    const url = new URL(magicLink);
    const token = url.searchParams.get('token');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') || 'magiclink';

    // Verify the token with Supabase
    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify?token=${tokenHash}&type=${type}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY
      },
      redirect: 'manual'
    });

    // Get access token from response headers or follow redirect
    if (response.status === 303 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location);
        const hashParams = new URLSearchParams(redirectUrl.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          // Get user info
          const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': SUPABASE_ANON_KEY
            }
          });
          
          if (userResponse.ok) {
            const user = await userResponse.json();
            return { access_token: accessToken, user };
          }
        }
      }
    }

    return { access_token: null, user: null };
  } catch (error) {
    console.error('Error verifying magic link:', error);
    return { access_token: null, user: null };
  }
}

// Handle logout
async function handleLogout() {
  try {
    if (authToken) {
      await logEvent('LOGOUT');
    }
    
    authToken = null;
    userProfile = null;
    await saveState();
    
    console.log('Logged out');
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Refresh brands periodically (every 5 minutes)
chrome.alarms.create('refreshBrands', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshBrands') {
    await fetchBrands();
  }
});
