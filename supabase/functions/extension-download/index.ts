import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://livbbxegwifbhtboyczy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmJieGVnd2lmYmh0Ym95Y3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMTMsImV4cCI6MjA4MTAyMDIxM30.hBcAWcwAdK4Rx-lrVWRTYKqi2ttjgVbAZRCP4jHUN2Y';

const manifestJson = `{
  "manifest_version": 3,
  "name": "BizGuard",
  "version": "5.1.0",
  "description": "Protect your brand by detecting cross-brand term usage in real-time",
  "permissions": ["storage", "activeTab", "alarms", "identity"],
  "host_permissions": [
    "${SUPABASE_URL}/*",
    "https://login.microsoftonline.com/*",
    "https://graph.microsoft.com/*",
    "https://*.zendesk.com/*",
    "https://*.freshdesk.com/*",
    "https://*.intercom.io/*",
    "https://*.helpscout.net/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": [
      "https://*.zendesk.com/*",
      "https://*.freshdesk.com/*",
      "https://*.intercom.io/*",
      "https://*.helpscout.net/*"
    ],
    "js": ["content.js"],
    "css": ["content.css"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}`;

const backgroundJs = `// BizGuard Background Service Worker
const API_BASE = '${SUPABASE_URL}/functions/v1';
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';

let brands = [];
let currentBrand = null;
let isEnabled = true;
let authToken = null;
let userProfile = null;

chrome.runtime.onInstalled.addListener(async () => {
  console.log('BizGuard v5.1 installed');
  await loadState();
  await fetchBrands();
  setupHeartbeat();
});

chrome.runtime.onStartup.addListener(async () => {
  await loadState();
  await fetchBrands();
  setupHeartbeat();
});

async function loadState() {
  const data = await chrome.storage.local.get(['isEnabled', 'currentBrand', 'authToken', 'userProfile', 'brands']);
  isEnabled = data.isEnabled !== false;
  currentBrand = data.currentBrand || null;
  authToken = data.authToken || null;
  userProfile = data.userProfile || null;
  brands = data.brands || [];
}

async function saveState() {
  await chrome.storage.local.set({ isEnabled, currentBrand, authToken, userProfile, brands });
}

async function fetchBrands() {
  try {
    const response = await fetch(API_BASE + '/brands');
    if (!response.ok) throw new Error('Failed to fetch brands');
    brands = await response.json();
    await chrome.storage.local.set({ brands });
    notifyContentScripts({ type: 'BRANDS_UPDATED', brands });
    return brands;
  } catch (error) {
    console.error('Error fetching brands:', error);
    return brands;
  }
}

function setupHeartbeat() {
  chrome.alarms.create('heartbeat', { periodInMinutes: 2 });
  chrome.alarms.create('refreshBrands', { periodInMinutes: 5 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'heartbeat') await sendHeartbeat();
    if (alarm.name === 'refreshBrands') await fetchBrands();
  });
  sendHeartbeat();
}

async function sendHeartbeat() {
  if (!authToken) return;
  try {
    const browserInfo = getBrowserInfo();
    await fetch(API_BASE + '/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({
        browser: browserInfo.name,
        browser_version: browserInfo.version,
        extension_version: chrome.runtime.getManifest().version,
        is_active: isEnabled
      })
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
  }
}

function getBrowserInfo() {
  const ua = navigator.userAgent;
  let name = 'Unknown', version = '0';
  if (ua.includes('Edg/')) { name = 'Edge'; version = ua.match(/Edg\\/(\\d+)/)?.[1] || '0'; }
  else if (ua.includes('Chrome/')) { name = 'Chrome'; version = ua.match(/Chrome\\/(\\d+)/)?.[1] || '0'; }
  return { name, version };
}

function notifyContentScripts(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => { if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {}); });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_STATE':
      return { isEnabled, currentBrand, brands, isAuthenticated: !!authToken, userProfile };
    case 'SET_ENABLED':
      isEnabled = message.enabled;
      await saveState();
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
      if (authToken) await logEvent('LOGOUT', {});
      authToken = null; userProfile = null;
      await saveState();
      return { success: true };
    case 'REFRESH_BRANDS':
      return { brands: await fetchBrands() };
    case 'TERM_BLOCKED':
      await logEvent('BLOCKED', { term: message.term, brandId: message.brandId, url: sender.tab?.url });
      return { success: true };
    default:
      return { error: 'Unknown message type' };
  }
}

async function handleLogin(email, password) {
  try {
    const response = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Login failed');
    authToken = data.access_token;
    userProfile = { id: data.user.id, email: data.user.email, displayName: data.user.user_metadata?.full_name || data.user.email };
    await saveState();
    await logEvent('LOGIN', {});
    return { success: true, user: userProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleMicrosoftLogin() {
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    
    const initResponse = await fetch(API_BASE + '/azure-auth-init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirectUri })
    });

    if (!initResponse.ok) throw new Error('Failed to initialize Azure login');
    const { authUrl } = await initResponse.json();

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(redirectUrl);
      });
    });

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) throw new Error(url.searchParams.get('error_description') || error);
    if (!code) throw new Error('No authorization code received');

    const callbackResponse = await fetch(API_BASE + '/azure-auth-callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri })
    });

    const callbackData = await callbackResponse.json();
    if (!callbackResponse.ok || callbackData.error) {
      throw new Error(callbackData.message || callbackData.error || 'Authentication failed');
    }

    if (callbackData.magicLink) {
      const { access_token, user } = await verifyMagicLink(callbackData.magicLink);
      if (access_token && user) {
        authToken = access_token;
        userProfile = { id: user.id, email: user.email, displayName: user.user_metadata?.full_name || user.email };
        await saveState();
        await logEvent('LOGIN', {});
        return { success: true, user: userProfile };
      }
    }

    throw new Error('Could not complete authentication');
  } catch (error) {
    console.error('Microsoft login error:', error);
    return { success: false, error: error.message };
  }
}

async function verifyMagicLink(magicLink) {
  try {
    const url = new URL(magicLink);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') || 'magiclink';

    const response = await fetch(SUPABASE_URL + '/auth/v1/verify?token=' + tokenHash + '&type=' + type, {
      method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY },
      redirect: 'manual'
    });

    if (response.status === 303 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location);
        const hashParams = new URLSearchParams(redirectUrl.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          const userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
            headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY }
          });
          if (userResponse.ok) {
            return { access_token: accessToken, user: await userResponse.json() };
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

async function logEvent(action, data) {
  if (!authToken) return;
  try {
    await fetch(SUPABASE_URL + '/rest/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken, 'apikey': SUPABASE_ANON_KEY, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ action, user_id: userProfile?.id, brand_id: data.brandId || currentBrand?.id, term: data.term, url: data.url })
    });
  } catch (error) { console.error('Error logging event:', error); }
}`;

const contentJs = `// BizGuard Content Script
let brands = [], currentBrand = null, isEnabled = true, observer = null;

async function init() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  brands = state.brands || [];
  currentBrand = state.currentBrand;
  isEnabled = state.isEnabled;
  if (isEnabled && currentBrand) startMonitoring();
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'BRANDS_UPDATED') brands = message.brands;
  if (message.type === 'BRAND_CHANGED') { currentBrand = message.currentBrand; isEnabled && currentBrand ? startMonitoring() : stopMonitoring(); }
  if (message.type === 'ENABLED_CHANGED') { isEnabled = message.isEnabled; isEnabled && currentBrand ? startMonitoring() : stopMonitoring(); }
});

function getBlockedTerms() {
  if (!currentBrand) return [];
  const blocked = [];
  brands.forEach(brand => {
    if (brand.id !== currentBrand.id) {
      brand.terms.forEach(term => blocked.push({ term: term.toLowerCase(), brandId: brand.id, brandName: brand.name }));
    }
  });
  return blocked;
}

function checkForBlockedTerms(text) {
  const blocked = getBlockedTerms(), lower = text.toLowerCase(), found = [];
  blocked.forEach(({ term, brandId, brandName }) => { if (lower.includes(term)) found.push({ term, brandId, brandName }); });
  return found;
}

function showWarning(term, brandName, element) {
  if (element.querySelector('.bizguard-warning')) return;
  const warning = document.createElement('div');
  warning.className = 'bizguard-warning';
  warning.innerHTML = '<div class="bizguard-warning-content"><div class="bizguard-warning-icon">⚠️</div><div class="bizguard-warning-text"><strong>Brand Mismatch!</strong><p>Term from <strong>' + brandName + '</strong> detected while on <strong>' + currentBrand.name + '</strong></p><p class="bizguard-term">"' + term + '"</p></div><button class="bizguard-dismiss">Dismiss</button></div>';
  warning.querySelector('.bizguard-dismiss').addEventListener('click', (e) => { e.stopPropagation(); warning.remove(); });
  element.style.position = element.style.position || 'relative';
  element.appendChild(warning);
  chrome.runtime.sendMessage({ type: 'TERM_BLOCKED', term, brandId: brands.find(b => b.name === brandName)?.id });
  setTimeout(() => warning.parentNode && warning.remove(), 10000);
}

function debounce(func, wait) {
  let timeout;
  return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}

function monitorElement(element) {
  if (element.dataset.bizguardMonitored) return;
  element.dataset.bizguardMonitored = 'true';
  const check = () => {
    if (!isEnabled || !currentBrand) return;
    const text = element.value || element.textContent || '';
    checkForBlockedTerms(text).forEach(({ term, brandName }) => showWarning(term, brandName, element.parentElement || element));
  };
  element.addEventListener('input', debounce(check, 500));
  element.addEventListener('blur', check);
}

function findAndMonitorInputs() {
  const selectors = 'textarea, input[type="text"], [contenteditable="true"], [role="textbox"], .public-DraftEditor-content, .ql-editor, .ProseMirror';
  document.querySelectorAll(selectors).forEach(monitorElement);
}

function startMonitoring() {
  stopMonitoring();
  findAndMonitorInputs();
  observer = new MutationObserver(() => findAndMonitorInputs());
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopMonitoring() {
  if (observer) { observer.disconnect(); observer = null; }
  document.querySelectorAll('.bizguard-warning').forEach(el => el.remove());
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();`;

const contentCss = `.bizguard-warning{position:absolute;top:100%;left:0;right:0;z-index:999999;margin-top:8px;animation:bizguard-slide-in .3s ease-out}
.bizguard-warning-content{background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(255,107,107,.3);border-radius:12px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;align-items:flex-start;gap:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff}
.bizguard-warning-icon{font-size:24px;flex-shrink:0}
.bizguard-warning-text{flex:1}
.bizguard-warning-text strong{color:#ff6b6b;font-size:14px}
.bizguard-warning-text p{margin:6px 0 0;font-size:13px;color:rgba(255,255,255,.8)}
.bizguard-term{background:rgba(255,107,107,.15);padding:4px 8px;border-radius:6px;font-family:monospace;display:inline-block}
.bizguard-dismiss{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12px;transition:all .2s}
.bizguard-dismiss:hover{background:rgba(255,255,255,.2)}
@keyframes bizguard-slide-in{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`;

const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BizGuard</title><link rel="stylesheet" href="popup.css"></head>
<body>
<div class="popup-container">
  <header class="header">
    <div class="logo"><img src="icons/icon48.png" alt="BizGuard" class="logo-icon"><div class="logo-text"><h1>BizGuard</h1><span class="version">v5.1</span></div></div>
    <div id="status-badge" class="status-badge active"><span class="status-dot"></span><span class="status-text">Active</span></div>
  </header>
  <section id="login-section" class="section login-section hidden">
    <div class="login-header"><h2>Sign In</h2><p>Login with your Bizcuits account</p></div>
    <button type="button" class="btn btn-microsoft btn-block" id="microsoft-login-btn">
      <svg class="microsoft-icon" width="20" height="20" viewBox="0 0 21 21" fill="none">
        <path d="M0 0h10v10H0V0z" fill="#F25022"/><path d="M11 0h10v10H11V0z" fill="#7FBA00"/>
        <path d="M0 11h10v10H0V11z" fill="#00A4EF"/><path d="M11 11h10v10H11V11z" fill="#FFB900"/>
      </svg>
      <span class="btn-text">Sign in with Microsoft</span>
      <span class="btn-loader hidden"></span>
    </button>
    <div id="login-error" class="error-message hidden"></div>
    <div class="login-divider"><span>or use email</span></div>
    <form id="login-form" class="login-form">
      <div class="form-group"><label for="email">Email</label><input type="email" id="email" placeholder="you@bizcuits.io" required></div>
      <div class="form-group"><label for="password">Password</label><input type="password" id="password" placeholder="••••••••" required></div>
      <button type="submit" class="btn btn-primary btn-block" id="login-btn"><span class="btn-text">Sign In</span><span class="btn-loader hidden"></span></button>
    </form>
  </section>
  <section id="main-section" class="section hidden">
    <div class="user-card"><div class="user-avatar" id="user-avatar">?</div><div class="user-info"><p class="user-name" id="user-name">Loading...</p><p class="user-email" id="user-email">-</p></div><button class="btn btn-ghost btn-icon" id="logout-btn" title="Sign Out"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button></div>
    <div class="toggle-card"><div class="toggle-info"><span class="toggle-label">Protection</span><span class="toggle-status" id="toggle-status">Enabled</span></div><label class="toggle-switch"><input type="checkbox" id="enable-toggle" checked><span class="toggle-slider"></span></label></div>
    <div class="brand-section"><div class="section-header"><h3>Active Brand</h3><button class="btn btn-ghost btn-sm" id="refresh-brands" title="Refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M21 21v-5h-5"></path></svg></button></div><div class="brand-select-wrapper"><select id="brand-select" class="brand-select"><option value="">Select a brand...</option></select></div><p class="brand-hint" id="brand-hint">Select brand you're working with</p></div>
    <div class="stats-section"><div class="stat-card"><span class="stat-value" id="brands-count">0</span><span class="stat-label">Brands</span></div><div class="stat-card"><span class="stat-value" id="terms-count">0</span><span class="stat-label">Terms</span></div></div>
  </section>
  <footer class="footer"><a href="https://bizguard.bizcuits.io/dashboard" target="_blank" class="footer-link">Open Dashboard<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></footer>
</div>
<script src="popup.js"></script>
</body></html>`;

const popupCss = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;background:linear-gradient(180deg,#f5f5f7,#fff);color:#1d1d1f;width:340px;min-height:400px}.popup-container{display:flex;flex-direction:column;min-height:400px}.header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(255,255,255,.8);backdrop-filter:blur(20px);border-bottom:1px solid rgba(0,0,0,.06)}.logo{display:flex;align-items:center;gap:10px}.logo-icon{width:32px;height:32px}.logo-text h1{font-size:16px;font-weight:600;color:#1d1d1f}.logo-text .version{font-size:11px;color:#86868b}.status-badge{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:500;background:rgba(0,0,0,.04);color:#86868b}.status-badge.active{background:rgba(52,199,89,.12);color:#248a3d}.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}.section{padding:20px;flex:1}.hidden{display:none!important}.login-section{display:flex;flex-direction:column;justify-content:center}.login-header{text-align:center;margin-bottom:24px}.login-header h2{font-size:22px;font-weight:600}.login-header p{font-size:14px;color:#86868b}.login-form{display:flex;flex-direction:column;gap:16px}.form-group{display:flex;flex-direction:column;gap:6px}.form-group label{font-size:13px;font-weight:500}.form-group input{padding:12px 14px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:15px;background:rgba(255,255,255,.8)}.form-group input:focus{outline:none;border-color:#0071e3;box-shadow:0 0 0 3px rgba(0,113,227,.15)}.error-message{padding:10px 12px;background:rgba(255,59,48,.1);border-radius:8px;color:#d70015;font-size:13px;margin-top:12px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border:none;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s}.btn-primary{background:#0071e3;color:#fff}.btn-primary:hover{background:#0077ed}.btn-microsoft{background:#2f2f2f;color:#fff}.btn-microsoft:hover{background:#404040}.btn-microsoft:disabled{opacity:.7;cursor:not-allowed}.microsoft-icon{flex-shrink:0}.btn-ghost{background:transparent;color:#86868b;padding:8px}.btn-ghost:hover{background:rgba(0,0,0,.04)}.btn-block{width:100%}.btn-loader{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.login-divider{display:flex;align-items:center;text-align:center;margin:20px 0}.login-divider::before,.login-divider::after{content:'';flex:1;border-bottom:1px solid rgba(0,0,0,.1)}.login-divider span{padding:0 12px;font-size:12px;color:#86868b}.user-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px;margin-bottom:16px}.user-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0071e3,#5856d6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#fff}.user-info{flex:1;min-width:0}.user-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user-email{font-size:12px;color:#86868b}.toggle-card{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px;margin-bottom:16px}.toggle-info{display:flex;flex-direction:column;gap:2px}.toggle-label{font-size:14px;font-weight:500}.toggle-status{font-size:12px;color:#248a3d}.toggle-switch{position:relative;width:50px;height:30px}.toggle-switch input{opacity:0;width:0;height:0}.toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.12);border-radius:30px;transition:all .3s}.toggle-slider::before{position:absolute;content:'';height:26px;width:26px;left:2px;bottom:2px;background:#fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:all .3s}input:checked+.toggle-slider{background:#34c759}input:checked+.toggle-slider::before{transform:translateX(20px)}.brand-section{margin-bottom:16px}.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.section-header h3{font-size:13px;font-weight:600;color:#86868b;text-transform:uppercase}.brand-select-wrapper{position:relative}.brand-select{width:100%;padding:12px 40px 12px 14px;border:1px solid rgba(0,0,0,.1);border-radius:10px;font-size:15px;background:rgba(255,255,255,.8);appearance:none;cursor:pointer}.brand-select:focus{outline:none;border-color:#0071e3}.brand-select-wrapper::after{content:'';position:absolute;right:14px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #86868b;pointer-events:none}.brand-hint{font-size:12px;color:#86868b;margin-top:8px}.stats-section{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stat-card{display:flex;flex-direction:column;align-items:center;padding:16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px}.stat-value{font-size:24px;font-weight:600}.stat-label{font-size:12px;color:#86868b;margin-top:4px}.footer{padding:14px 20px;background:rgba(255,255,255,.6);border-top:1px solid rgba(0,0,0,.06)}.footer-link{display:flex;align-items:center;justify-content:center;gap:6px;color:#0071e3;text-decoration:none;font-size:13px;font-weight:500}`;

const popupJs = `const loginSection=document.getElementById('login-section'),mainSection=document.getElementById('main-section'),loginForm=document.getElementById('login-form'),loginError=document.getElementById('login-error'),loginBtn=document.getElementById('login-btn'),microsoftLoginBtn=document.getElementById('microsoft-login-btn'),logoutBtn=document.getElementById('logout-btn'),enableToggle=document.getElementById('enable-toggle'),toggleStatus=document.getElementById('toggle-status'),statusBadge=document.getElementById('status-badge'),brandSelect=document.getElementById('brand-select'),brandHint=document.getElementById('brand-hint'),refreshBrandsBtn=document.getElementById('refresh-brands'),userName=document.getElementById('user-name'),userEmail=document.getElementById('user-email'),userAvatar=document.getElementById('user-avatar'),brandsCount=document.getElementById('brands-count'),termsCount=document.getElementById('terms-count');let state={isEnabled:true,isAuthenticated:false,currentBrand:null,brands:[],userProfile:null};

async function init(){try{state=await chrome.runtime.sendMessage({type:'GET_STATE'});render()}catch(e){console.error(e)}}

function render(){state.isAuthenticated?(loginSection.classList.add('hidden'),mainSection.classList.remove('hidden'),renderMain()):(loginSection.classList.remove('hidden'),mainSection.classList.add('hidden'));updateStatus()}

function renderMain(){if(state.userProfile){userName.textContent=state.userProfile.displayName||'User';userEmail.textContent=state.userProfile.email||'';userAvatar.textContent=(state.userProfile.displayName||'U').charAt(0).toUpperCase()}enableToggle.checked=state.isEnabled;toggleStatus.textContent=state.isEnabled?'Enabled':'Disabled';renderBrands();brandsCount.textContent=state.brands.length;termsCount.textContent=state.brands.reduce((s,b)=>s+(b.terms?.length||0),0)}

function renderBrands(){brandSelect.innerHTML='<option value="">Select a brand...</option>';state.brands.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name+' ('+(b.terms?.length||0)+' terms)';if(state.currentBrand?.id===b.id)o.selected=true;brandSelect.appendChild(o)});brandHint.textContent=state.currentBrand?'Monitoring for other brand terms':'Select brand you\\'re working with'}

function updateStatus(){const t=statusBadge.querySelector('.status-text');if(!state.isAuthenticated){statusBadge.className='status-badge';t.textContent='Not logged in'}else if(!state.isEnabled){statusBadge.className='status-badge';t.textContent='Disabled'}else{statusBadge.className='status-badge active';t.textContent='Active'}}

microsoftLoginBtn.addEventListener('click',async()=>{microsoftLoginBtn.disabled=true;microsoftLoginBtn.querySelector('.btn-text').textContent='Signing in...';microsoftLoginBtn.querySelector('.btn-loader').classList.remove('hidden');loginError.classList.add('hidden');try{const r=await chrome.runtime.sendMessage({type:'MICROSOFT_LOGIN'});if(r.success){state.isAuthenticated=true;state.userProfile=r.user;state=await chrome.runtime.sendMessage({type:'GET_STATE'});render()}else{loginError.textContent=r.error||'Microsoft login failed';loginError.classList.remove('hidden')}}catch(e){loginError.textContent='An error occurred. Please try again.';loginError.classList.remove('hidden')}finally{microsoftLoginBtn.disabled=false;microsoftLoginBtn.querySelector('.btn-text').textContent='Sign in with Microsoft';microsoftLoginBtn.querySelector('.btn-loader').classList.add('hidden')}});

loginForm.addEventListener('submit',async e=>{e.preventDefault();const email=document.getElementById('email').value,password=document.getElementById('password').value;loginBtn.disabled=true;loginBtn.querySelector('.btn-text').textContent='Signing in...';loginBtn.querySelector('.btn-loader').classList.remove('hidden');loginError.classList.add('hidden');try{const r=await chrome.runtime.sendMessage({type:'LOGIN',email,password});if(r.success){state.isAuthenticated=true;state.userProfile=r.user;state=await chrome.runtime.sendMessage({type:'GET_STATE'});render()}else{loginError.textContent=r.error||'Login failed';loginError.classList.remove('hidden')}}finally{loginBtn.disabled=false;loginBtn.querySelector('.btn-text').textContent='Sign In';loginBtn.querySelector('.btn-loader').classList.add('hidden')}});

logoutBtn.addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'LOGOUT'});state.isAuthenticated=false;state.userProfile=null;render()});

enableToggle.addEventListener('change',async()=>{await chrome.runtime.sendMessage({type:'SET_ENABLED',enabled:enableToggle.checked});state.isEnabled=enableToggle.checked;toggleStatus.textContent=state.isEnabled?'Enabled':'Disabled';updateStatus()});

brandSelect.addEventListener('change',async()=>{const brand=state.brands.find(b=>b.id===brandSelect.value)||null;await chrome.runtime.sendMessage({type:'SET_CURRENT_BRAND',brand});state.currentBrand=brand;brandHint.textContent=brand?'Monitoring for other brand terms':'Select brand';updateStatus()});

refreshBrandsBtn.addEventListener('click',async()=>{const r=await chrome.runtime.sendMessage({type:'REFRESH_BRANDS'});if(r.brands){state.brands=r.brands;renderBrands();brandsCount.textContent=state.brands.length;termsCount.textContent=state.brands.reduce((s,b)=>s+(b.terms?.length||0),0)}});

init();`;

const readmeMd = `# BizGuard Extension v5.1

## Installation
1. Go to chrome://extensions (Chrome) or edge://extensions (Edge)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this folder

## Features
- Real-time term detection
- Brand switching
- Microsoft/Azure AD sign-in
- Auto-sync with dashboard
- Works on Zendesk, Freshdesk, Intercom, Help Scout

## Login
Sign in with your Microsoft account or use email/password.`;

// SVG icon generator
const createSvgIcon = (size: number): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c7d2fe"/>
      <stop offset="100%" stop-color="#ddd6fe"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <path d="M64 24c-20 0-36 8-36 8v36c0 24 36 40 36 40s36-16 36-40V32s-16-8-36-8z" fill="url(#shield)" opacity="0.9"/>
  <path d="M56 64l8 8 16-16" stroke="#6366f1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating extension ZIP v5.1...');
    
    const zip = new JSZip();
    
    // Add extension files
    zip.addFile('manifest.json', manifestJson);
    zip.addFile('background.js', backgroundJs);
    zip.addFile('content.js', contentJs);
    zip.addFile('content.css', contentCss);
    zip.addFile('popup.html', popupHtml);
    zip.addFile('popup.css', popupCss);
    zip.addFile('popup.js', popupJs);
    zip.addFile('README.md', readmeMd);
    
    // Add SVG icons (work in modern browsers)
    const iconSizes = [16, 32, 48, 128];
    for (const size of iconSizes) {
      zip.addFile(`icons/icon${size}.png`, createSvgIcon(size));
      zip.addFile(`icons/icon${size}.svg`, createSvgIcon(size));
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    console.log('ZIP generated, size:', zipBlob.size);
    
    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="bizguard-extension-v5.1.zip"',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating ZIP:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
