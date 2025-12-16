import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = 'https://livbbxegwifbhtboyczy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmJieGVnd2lmYmh0Ym95Y3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NDQyMTMsImV4cCI6MjA4MTAyMDIxM30.hBcAWcwAdK4Rx-lrVWRTYKqi2ttjgVbAZRCP4jHUN2Y';

// Simple PNG generator for solid color icons with a design
function createSimplePng(size: number): Uint8Array {
  const width = size;
  const height = size;
  
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const ihdr = createIHDRChunk(width, height);
  const imageData = new Uint8Array(height * (1 + width * 4));
  
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = width * 0.4;
  const innerRadius = width * 0.15;
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    imageData[rowStart] = 0;
    
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      let r = 124, g = 58, b = 237, a = 255;
      
      if (dist < outerRadius && dist > innerRadius) {
        const angle = Math.atan2(dy, dx);
        const petalAngle = ((angle + Math.PI) / (Math.PI * 2)) * 8;
        const petalPhase = Math.abs(Math.sin(petalAngle * Math.PI));
        if (petalPhase > 0.5) {
          r = 255; g = 255; b = 255;
        }
      }
      
      if (dist < innerRadius * 0.6) {
        r = 255; g = 255; b = 255;
      }
      
      const cornerDist = Math.max(Math.abs(dx), Math.abs(dy));
      if (cornerDist > width * 0.45) {
        a = 0;
      }
      
      imageData[px] = r;
      imageData[px + 1] = g;
      imageData[px + 2] = b;
      imageData[px + 3] = a;
    }
  }
  
  const compressedData = deflateSimple(imageData);
  const idat = createChunk('IDAT', compressedData);
  const iend = createChunk('IEND', new Uint8Array(0));
  
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);
  
  return png;
}

function createIHDRChunk(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return createChunk('IHDR', data);
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc, false);
  return chunk;
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function deflateSimple(data: Uint8Array): Uint8Array {
  const blocks: number[] = [];
  const maxBlockSize = 65535;
  let offset = 0;
  
  while (offset < data.length) {
    const remaining = data.length - offset;
    const blockSize = Math.min(remaining, maxBlockSize);
    const isLast = offset + blockSize >= data.length;
    
    blocks.push(isLast ? 0x01 : 0x00);
    blocks.push(blockSize & 0xFF);
    blocks.push((blockSize >> 8) & 0xFF);
    blocks.push((~blockSize) & 0xFF);
    blocks.push((~blockSize >> 8) & 0xFF);
    
    for (let i = 0; i < blockSize; i++) {
      blocks.push(data[offset + i]);
    }
    offset += blockSize;
  }
  
  const adler = adler32(data);
  const result = new Uint8Array(2 + blocks.length + 4);
  result[0] = 0x78;
  result[1] = 0x01;
  result.set(blocks, 2);
  const view = new DataView(result.buffer);
  view.setUint32(2 + blocks.length, adler, false);
  
  return result;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

const manifestJson = `{
  "manifest_version": 3,
  "name": "BizGuard",
  "version": "5.9.0",
  "description": "Protect your brand by detecting cross-brand term usage in real-time",
  "permissions": ["storage", "activeTab", "alarms", "identity", "scripting", "tabs"],
  "host_permissions": [
    "${SUPABASE_URL}/*",
    "https://login.microsoftonline.com/*",
    "https://graph.microsoft.com/*",
    "https://app.helpdesk.com/*",
    "https://my.livechatinc.com/*",
    "https://www.text.com/*",
    "https://text.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": [
      "https://app.helpdesk.com/*",
      "https://my.livechatinc.com/*",
      "https://www.text.com/app/inbox/*",
      "https://text.com/app/inbox/*"
    ],
    "js": ["content.js"],
    "css": ["content.css"],
    "run_at": "document_idle",
    "all_frames": true
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

const backgroundJs = `// BizGuard Background Service Worker v5.9.0
const API_BASE = '${SUPABASE_URL}/functions/v1';
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';

let brands = [];
let currentBrand = null;
let isEnabled = true;
let authToken = null;
let userProfile = null;
let stateLoaded = false;

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');
}

async function ensureStateLoaded() {
  if (!stateLoaded) {
    await loadState();
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('BizGuard v5.9.0 installed');
  await loadState();
  await fetchBrands();
  setupHeartbeat();
  // Send heartbeat immediately on install to set extension_active status
  if (authToken) {
    console.log('Auth token found, sending install heartbeat');
    await sendHeartbeat();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('BizGuard v5.9.0 starting up...');
  await loadState();
  await fetchBrands();
  setupHeartbeat();
  // Send heartbeat immediately on startup to restore extension_active status
  if (authToken) {
    console.log('Auth token found, sending startup heartbeat');
    await sendHeartbeat();
  }
});

async function loadState() {
  const data = await chrome.storage.local.get(['isEnabled', 'currentBrand', 'authToken', 'userProfile', 'brands']);
  isEnabled = data.isEnabled !== false;
  currentBrand = data.currentBrand || null;
  authToken = data.authToken || null;
  userProfile = data.userProfile || null;
  brands = data.brands || [];
  stateLoaded = true;
  console.log('State loaded:', { isEnabled, hasBrand: !!currentBrand, hasToken: !!authToken, hasProfile: !!userProfile, brandsCount: brands.length });
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
  if (!authToken) {
    console.log('Heartbeat skipped - no auth token');
    return;
  }
  try {
    const browserInfo = getBrowserInfo();
    console.log('Sending heartbeat with browser:', browserInfo);
    const response = await fetch(API_BASE + '/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({
        browser: browserInfo.name,
        browser_version: browserInfo.version,
        extension_version: chrome.runtime.getManifest().version
      })
    });
    if (response.ok) {
      console.log('Heartbeat sent successfully');
    } else {
      console.error('Heartbeat failed:', response.status);
    }
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
  ensureStateLoaded().then(() => handleMessage(message, sender)).then(sendResponse);
  return true;
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
        mode: authToken ? 'connected' : (userProfile ? 'limited' : 'none')
      };
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

async function handleMicrosoftLogin() {
  const diagnostics = { startTime: new Date().toISOString(), steps: [], errors: [] };
  
  try {
    const redirectUri = chrome.identity.getRedirectURL();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    diagnostics.steps.push('PKCE generated');
    console.log('Starting Microsoft login with PKCE...');
    console.log('Redirect URI:', redirectUri);
    
    let initResponse;
    try {
      initResponse = await fetch(API_BASE + '/azure-auth-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUri, codeChallenge })
      });
    } catch (e) {
      diagnostics.errors.push('Init fetch failed: ' + e.message);
      return { success: false, error: 'Network error', diagnostics };
    }

    if (!initResponse.ok) {
      diagnostics.errors.push('Init not ok: ' + initResponse.status);
      return { success: false, error: 'Failed to initialize Azure login', diagnostics };
    }
    
    const { authUrl } = await initResponse.json();
    diagnostics.steps.push('Got auth URL');

    let responseUrl;
    try {
      responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUrl) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(redirectUrl);
        });
      });
      diagnostics.steps.push('Web auth flow completed');
    } catch (e) {
      diagnostics.errors.push('Auth flow error: ' + e.message);
      return { success: false, error: e.message, diagnostics };
    }

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      diagnostics.errors.push('Azure error: ' + error);
      return { success: false, error: url.searchParams.get('error_description') || error, diagnostics };
    }
    if (!code) {
      diagnostics.errors.push('No code received');
      return { success: false, error: 'No authorization code received', diagnostics };
    }
    
    diagnostics.steps.push('Got authorization code');

    let callbackData;
    try {
      const callbackResponse = await fetch(API_BASE + '/azure-auth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri, codeVerifier })
      });
      callbackData = await callbackResponse.json();
      diagnostics.steps.push('Callback received');
      diagnostics.callbackKeys = Object.keys(callbackData);
      
      if (!callbackResponse.ok || callbackData.error) {
        diagnostics.errors.push('Callback error: ' + (callbackData.message || callbackData.error));
        return { success: false, error: callbackData.message || callbackData.error || 'Authentication failed', diagnostics };
      }
    } catch (e) {
      diagnostics.errors.push('Callback fetch failed: ' + e.message);
      return { success: false, error: 'Failed to complete authentication', diagnostics };
    }

    if (callbackData.userData) {
      userProfile = { id: callbackData.userData.id, email: callbackData.userData.email, displayName: callbackData.userData.displayName || callbackData.userData.email.split('@')[0] };
      diagnostics.steps.push('User profile from userData');
    } else if (callbackData.email) {
      userProfile = { id: callbackData.userId, email: callbackData.email, displayName: callbackData.displayName || callbackData.email.split('@')[0] };
      diagnostics.steps.push('User profile from email');
    } else {
      diagnostics.errors.push('No user data in response');
      return { success: false, error: 'No user data received', diagnostics };
    }

    const email = (userProfile.email || '').toLowerCase();
    if (!email.endsWith('@bizcuits.io')) {
      diagnostics.errors.push('Invalid domain: ' + email);
      userProfile = null;
      return { success: false, error: 'Only @bizcuits.io accounts are allowed', diagnostics };
    }

    let tokenObtained = false;
    let connectionMode = 'limited';
    
    // First, check if callback returned a direct authToken (preferred method)
    if (callbackData.authToken) {
      authToken = callbackData.authToken;
      tokenObtained = true;
      connectionMode = 'connected';
      diagnostics.steps.push('Token from direct authToken');
      console.log('Direct auth token received from callback');
    }
    
    // Fallback: try tokenHash verification
    if (!tokenObtained && callbackData.tokenHash) {
      try {
        const verifyResponse = await fetch(SUPABASE_URL + '/auth/v1/verify?token=' + callbackData.tokenHash + '&type=magiclink', {
          method: 'GET',
          headers: { 'apikey': SUPABASE_ANON_KEY },
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
              diagnostics.steps.push('Token from hash verify');
            }
          }
        }
      } catch (e) {
        diagnostics.steps.push('Hash verify error: ' + e.message);
      }
    }
    
    // Fallback: try magic link verification
    if (!tokenObtained && callbackData.magicLink) {
      try {
        const { access_token, user } = await verifyMagicLink(callbackData.magicLink);
        if (access_token) {
          authToken = access_token;
          tokenObtained = true;
          connectionMode = 'connected';
          diagnostics.steps.push('Token from magic link');
        }
      } catch (e) {
        diagnostics.steps.push('Magic link error: ' + e.message);
      }
    }
    
    // Log final token status
    console.log('Token obtained:', tokenObtained, 'Mode:', connectionMode, 'Has authToken:', !!authToken);

    await saveState();
    diagnostics.steps.push('State saved');
    
    // Send heartbeat immediately to set extension_active and browser info
    if (authToken) {
      try {
        await sendHeartbeat();
        diagnostics.steps.push('Initial heartbeat sent');
      } catch (e) {
        diagnostics.steps.push('Initial heartbeat error: ' + e.message);
      }
      try {
        await logEvent('LOGIN', {});
        diagnostics.steps.push('Login event logged');
      } catch (e) {}
    }

    diagnostics.steps.push('Complete - mode: ' + connectionMode);
    console.log('Microsoft login successful:', userProfile?.email, 'Mode:', connectionMode);
    
    return { success: true, user: userProfile, mode: connectionMode, diagnostics };
  } catch (error) {
    diagnostics.errors.push('Unexpected: ' + error.message);
    console.error('Microsoft login error:', error);
    return { success: false, error: error.message, diagnostics };
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

// Original content.js with brand auto-detection + backend brand support
const contentJs = `// BizGuard Content Script v5.9.0 - Brand Auto-Detection + Backend Support
(function() {
  console.log('[BizGuard] Content script booting...');

  // ==================== UTILITIES ====================
  const log = (...a) => console.log('[BizGuard]', ...a);
  const err = (...a) => console.error('[BizGuard]', ...a);

  const normSpace = (s) => s.replace(/\\s+/g, ' ').trim();
  const stripAccents = (s) => s.normalize?.('NFD').replace(/[\\u0300-\\u036f]/g, '') || s;
  const onlyText = (el) => (el ? normSpace(el.textContent || '') : '');

  function normalizeBrandKey(s) {
    if (!s) return '';
    let x = String(s);
    x = stripAccents(x).toLowerCase();
    x = x.replace(/[\\u200b-\\u200d\\uFEFF]/g, '');
    x = x.replace(/\\s+/g, ' ').trim();
    x = x.replace(/^[^a-z0-9]+/, '');
    if (x.length >= 2 && x[0] === x[1] && /[a-z]/.test(x[0])) x = x.slice(1);
    x = x.replace(/[@._-]+/g, '-').replace(/\\s+/g, '-');
    return x;
  }

  function normalizeTerm(s) {
    return stripAccents(String(s || '')).toLowerCase().trim();
  }

  function countOccurrences(text, term) {
    if (!text || !term) return 0;
    const esc = term.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    const re = new RegExp(esc, 'gi');
    return (text.match(re) || []).length;
  }

  // ==================== MODAL ALERT ====================
  function showCustomAlert(message) {
    const id = 'bizguard-alert-modal';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = id;
    modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:2147483647;background:rgba(0,0,0,0.35);font-family:system-ui,Arial,sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'background:#cec2ef;border:2px solid #693de5;padding:24px 22px;max-width:520px;width:calc(100% - 40px);box-shadow:0 4px 16px rgba(0,0,0,0.25);border-radius:10px;color:#000;text-align:left;box-sizing:border-box;overflow-wrap:break-word;';

    const p = document.createElement('div');
    p.innerHTML = message.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
    p.style.cssText = 'margin:0 0 18px 0;font-size:15px;line-height:1.5;color:#000;white-space:pre-line;word-wrap:break-word;overflow-wrap:break-word;';

    const btn = document.createElement('button');
    btn.textContent = 'Acknowledge';
    btn.style.cssText = 'display:block;margin:0 auto;padding:10px 30px;font-size:16px;font-weight:600;border-radius:6px;border:none;background:#693de5;color:#fff;cursor:pointer;transition:background 0.2s ease-in-out,transform 0.1s ease-in-out;';
    btn.onmouseenter = () => (btn.style.background = '#5a2fcf');
    btn.onmouseleave = () => (btn.style.background = '#693de5');
    btn.onclick = () => modal.remove();

    card.appendChild(p);
    card.appendChild(btn);
    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  // ==================== HARDCODED BRAND MAPPING (Fallback) ====================
  const brandMappingRaw = {
    'Liquid Brokers': [
      'sway markets','sway funded','sway hydration','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'swaymarkets','swayfunded','swayhydration','valormarkets',
      'www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'Astropips': [
      'liquid brokers','sway funded','sway hydration','bizcuits','valor markets','liquid charts',
      'liquidbrokers','swayfunded','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'Sway Funded': [
      'liquid brokers','sway markets','sway hydration','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'Sway Hydration': [
      'liquid brokers','sway markets','sway funded','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'Bizcuits': [
      'liquid brokers','sway markets','sway funded','sway hydration','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.valormarkets.com'
    ],
    'Valor Markets': [
      'liquid brokers','sway markets','sway funded','sway hydration','bizcuits','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','swayhydration','liquidcharts','liquid charts',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com'
    ],
    'support@liquidbrokers.com': [
      'sway markets','sway funded','sway hydration','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'swaymarkets','swayfunded','swayhydration','valormarkets','liquidcharts','liquid charts',
      'www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'support@astropips.com': [
      'liquid brokers','sway funded','sway hydration','bizcuits','valor markets',
      'liquidbrokers','swayfunded','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'support@swayfunded.com': [
      'liquid brokers','sway markets','sway hydration','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayhydration.com','www.bizcuits.com','www.valormarkets.com'
    ],
    'support@swayhydration.com': [
      'liquid brokers','sway markets','sway funded','bizcuits','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.bizcuits.com','www.valormarkets.com'
    ],
    '1941558782@tickets.helpdesk.com': [
      'liquid brokers','sway markets','sway funded','sway hydration','valor markets','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','swayhydration','valormarkets',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.valormarkets.com'
    ],
    'support@valormarkets.com': [
      'liquid brokers','sway markets','sway funded','sway hydration','bizcuits','astropips','astro pips','www.astropips.co',
      'liquidbrokers','swaymarkets','swayfunded','swayhydration',
      'www.liquidbrokers.com','www.swaymarkets.com','www.swayfunded.com','www.swayhydration.com','www.bizcuits.com'
    ]
  };

  // Build normalized lookup
  const canonToTerms = new Map();
  const aliasToCanon = new Map();

  Object.keys(brandMappingRaw).forEach((label) => {
    const nk = normalizeBrandKey(label);
    const list = brandMappingRaw[label].map(normalizeTerm);
    if (!canonToTerms.has(nk)) canonToTerms.set(nk, new Set());
    list.forEach((t) => canonToTerms.get(nk).add(t));
    aliasToCanon.set(nk, nk);
  });

  [...aliasToCanon.keys()].forEach((k) => {
    if (k.length >= 2 && k[0] === k[1] && /[a-z]/.test(k[0])) {
      const fixed = k.slice(1);
      if (aliasToCanon.has(fixed)) {
        aliasToCanon.set(k, fixed);
      }
    }
  });

  function registerAlias(alias, canonical) {
    const a = normalizeBrandKey(alias);
    const c = normalizeBrandKey(canonical);
    aliasToCanon.set(a, c);
  }
  registerAlias('LiquidBrokers', 'Liquid Brokers');
  registerAlias('ValorMarkets', 'Valor Markets');
  registerAlias('SwayFunded', 'Sway Funded');
  registerAlias('SwayHydration', 'Sway Hydration');
  registerAlias('Astro Pips', 'Astropips');
  registerAlias('AstroPips', 'Astropips');

  function resolveCanonical(brandLabel) {
    const key = normalizeBrandKey(brandLabel);
    if (aliasToCanon.has(key)) return aliasToCanon.get(key);
    return key;
  }

  const allCanonNames = new Set([...aliasToCanon.values()]);

  // ==================== BACKEND BRANDS ====================
  let backendBrands = [];
  let isEnabled = true;

  async function loadBackendState() {
    try {
      const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      backendBrands = state.brands || [];
      isEnabled = state.isEnabled !== false;
      log('Backend state loaded:', { brandsCount: backendBrands.length, isEnabled });
      
      // Merge backend brands into local mapping
      backendBrands.forEach(brand => {
        const nk = normalizeBrandKey(brand.name);
        if (!canonToTerms.has(nk)) canonToTerms.set(nk, new Set());
        (brand.terms || []).forEach(term => {
          canonToTerms.get(nk).add(normalizeTerm(term));
        });
        aliasToCanon.set(nk, nk);
        allCanonNames.add(nk);
      });
    } catch (e) {
      err('Failed to load backend state:', e);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'BRANDS_UPDATED') {
      backendBrands = message.brands || [];
      backendBrands.forEach(brand => {
        const nk = normalizeBrandKey(brand.name);
        if (!canonToTerms.has(nk)) canonToTerms.set(nk, new Set());
        (brand.terms || []).forEach(term => canonToTerms.get(nk).add(normalizeTerm(term)));
        aliasToCanon.set(nk, nk);
        allCanonNames.add(nk);
      });
    }
    if (message.type === 'ENABLED_CHANGED') {
      isEnabled = message.isEnabled;
      if (!isEnabled) cleanupAll();
      else { scanForComposers(); startGlobalObserver(); }
    }
  });

  // ==================== MISMATCH CHECK ====================
  function checkForMismatches({ content, previous, url, brandCanonicalKey, termCounts }) {
    if (!isEnabled) return;
    
    const lowerContent = (content || '').toLowerCase();

    let termsSet = canonToTerms.get(brandCanonicalKey);
    if (!termsSet || termsSet.size === 0) {
      termsSet = new Set(
        [...allCanonNames].filter((k) => k !== brandCanonicalKey).map((k) => k.replace(/-/g, ' '))
      );
    }

    let brandPretty = brandCanonicalKey.replace(/-/g, ' ').trim();
    if (!brandPretty) brandPretty = 'current brand';
    if (brandPretty.length > 40) brandPretty = brandPretty.slice(0, 40) + '...';

    for (const term of termsSet) {
      const t = normalizeTerm(term);
      const curr = countOccurrences(lowerContent, t);
      const stored = termCounts.get(t) || 0;

      if (curr > stored) {
        let normalizedUrl;
        try {
          const u = new URL(url);
          normalizedUrl = u.origin + u.pathname;
        } catch {
          normalizedUrl = url;
        }

        const termPretty = t.length > 40 ? t.slice(0, 40) + '...' : t;

        const message =
          '**Brand Mismatch Detected**\\n\\n' +
          '**Active team:** ' + brandPretty + '\\n' +
          '**Detected reference:** "' + termPretty + '"\\n' +
          '**Source:** ' + normalizedUrl + '\\n\\n' +
          'Please ensure your reply aligns with the correct brand or transfer this interaction if necessary.';

        log('Triggering alert:', { brand: brandPretty, term: termPretty });
        showCustomAlert(message);
        termCounts.set(t, curr);

        // Log to backend
        try {
          const brandId = backendBrands.find(b => normalizeBrandKey(b.name) === brandCanonicalKey)?.id;
          chrome.runtime.sendMessage({ type: 'TERM_BLOCKED', term: t, brandId, url });
        } catch (e) {}
      } else if (curr < stored) {
        termCounts.set(t, curr);
      }
    }
  }

  // ==================== BRAND DETECTION FROM UI ====================
  function detectBrandForNode(contextEl) {
    const root =
      document.querySelector('[aria-label*="Chat info"]') ||
      document.querySelector('[aria-label*="Ticket info"]') ||
      contextEl?.closest?.("[role='dialog'],[data-overlay-container],main") ||
      document.body;

    const safeText = (el) => {
      if (!el) return '';
      const t = onlyText(el);
      if (!t) return '';
      const trimmed = t.trim();
      if (trimmed.length === 0 || trimmed.length > 40) return '';
      return trimmed;
    };

    const allNodes = [...root.querySelectorAll('*')];

    const teamLabel = allNodes.find((el) => {
      const t = onlyText(el).toLowerCase();
      return t === 'team' || t === 'teams';
    });

    if (teamLabel) {
      let sib = teamLabel.nextElementSibling;
      for (let i = 0; i < 5 && sib; i++, sib = sib.nextElementSibling) {
        const val = safeText(sib);
        if (val && !/^(team|teams)$/i.test(val)) {
          return val;
        }
        const chip = sib.querySelector('span,div');
        const chipTxt = safeText(chip);
        if (chipTxt && !/^(team|teams)$/i.test(chipTxt)) {
          return chipTxt;
        }
      }
    }

    const knownPills = [
      'div.css-3i49oa',
      'p.css-1h52dri',
      'div.css-1w6mwsv.eolihl26 p'
    ];

    for (const sel of knownPills) {
      const el = root.querySelector(sel);
      const txt = safeText(el);
      if (txt) return txt;
    }

    return '';
  }

  // ==================== COMPOSER MONITORING ====================
  const chatContexts = new Map();
  let globalObserver = null;

  function setupComposerWatcher(textbox) {
    if (!textbox || chatContexts.has(textbox)) return;

    let brandLabel = detectBrandForNode(textbox) || detectBrandForNode(document.body);
    let brandKey = resolveCanonical(brandLabel);
    log('Composer found. Brand label:', brandLabel, '-> canonical key:', brandKey);

    const termCounts = new Map();
    let previousText = '';

    const contentObs = new MutationObserver(() => {
      if (!isEnabled) return;
      const current = (textbox.innerText || textbox.textContent || '').trim();
      checkForMismatches({
        content: current,
        previous: previousText,
        url: location.href,
        brandCanonicalKey: brandKey,
        termCounts
      });
      previousText = current;
    });
    contentObs.observe(textbox, { childList: true, subtree: true, characterData: true });

    const brandRoot = textbox.closest("[role='dialog'],[data-overlay-container],main") || document.body;
    const brandObs = new MutationObserver(() => {
      const fresh = detectBrandForNode(textbox) || detectBrandForNode(document.body);
      const freshKey = resolveCanonical(fresh);
      if (freshKey && freshKey !== brandKey) {
        log('Brand changed:', brandKey, '->', freshKey);
        brandKey = freshKey;
        termCounts.clear();
        previousText = '';
      }
    });
    brandObs.observe(brandRoot, { childList: true, subtree: true, characterData: true });

    chatContexts.set(textbox, { contentObs, brandObs });
  }

  function scanForComposers() {
    const editors = new Set([
      ...document.querySelectorAll('div[contenteditable="true"][role="textbox"]'),
      ...document.querySelectorAll('div[contenteditable="true"].rich-text-editor'),
      ...document.querySelectorAll('[data-testid*="editor"][contenteditable="true"]'),
      ...document.querySelectorAll('textarea'),
      ...document.querySelectorAll('input[type="text"]')
    ]);
    if (editors.size === 0) {
      log('No editors found (yet).');
      return;
    }
    editors.forEach(setupComposerWatcher);
  }

  function startGlobalObserver() {
    if (globalObserver) return;
    globalObserver = new MutationObserver(() => {
      scanForComposers();
    });
    globalObserver.observe(document.body, { childList: true, subtree: true });
  }

  function cleanupAll() {
    chatContexts.forEach(({ contentObs, brandObs }) => {
      try { contentObs?.disconnect(); } catch {}
      try { brandObs?.disconnect(); } catch {}
    });
    chatContexts.clear();
    try { globalObserver?.disconnect(); } catch {}
    globalObserver = null;
    log('Cleaned up observers.');
  }

  // ==================== SPA ROUTING ====================
  let lastPath = '';

  function onRouteChange() {
    const path = location.origin + location.pathname;
    if (path === lastPath) return;
    log('Route changed ->', path);
    lastPath = path;
    cleanupAll();
    scanForComposers();
    startGlobalObserver();
  }

  function hookHistory() {
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function() {
      const r = origPush.apply(this, arguments);
      window.dispatchEvent(new Event('bizguard-route'));
      return r;
    };
    history.replaceState = function() {
      const r = origReplace.apply(this, arguments);
      window.dispatchEvent(new Event('bizguard-route'));
      return r;
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('bizguard-route')));
    window.addEventListener('bizguard-route', onRouteChange);
  }

  // ==================== BOOT ====================
  async function boot() {
    try {
      await loadBackendState();
      hookHistory();
      onRouteChange();
      log('Monitoring started on:', location.href);
    } catch (e) {
      err('Boot error:', e);
    }
  }

  setTimeout(boot, 1500);
})();`;

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
    <div class="logo"><img src="icons/icon48.png" alt="BizGuard" class="logo-icon"><div class="logo-text"><h1>BizGuard</h1><span class="version">v5.9.0</span></div></div>
    <div id="status-badge" class="status-badge active"><span class="status-dot"></span><span class="status-text">Active</span></div>
  </header>
  <section id="login-section" class="section login-section hidden">
    <div class="login-header"><h2>Sign In</h2><p>Login with your Bizcuits Microsoft account</p></div>
    <button type="button" class="btn btn-microsoft btn-block" id="microsoft-login-btn">
      <svg class="microsoft-icon" width="20" height="20" viewBox="0 0 21 21" fill="none">
        <path d="M0 0h10v10H0V0z" fill="#F25022"/><path d="M11 0h10v10H11V0z" fill="#7FBA00"/>
        <path d="M0 11h10v10H0V11z" fill="#00A4EF"/><path d="M11 11h10v10H11V11z" fill="#FFB900"/>
      </svg>
      <span class="btn-text">Sign in with Microsoft</span>
      <span class="btn-loader hidden"></span>
    </button>
    <div id="login-error" class="error-message hidden"></div>
    <p class="domain-hint">Only @bizcuits.io accounts are allowed</p>
  </section>
  <section id="main-section" class="section hidden">
    <div class="user-card"><div class="user-avatar" id="user-avatar">?</div><div class="user-info"><p class="user-name" id="user-name">Loading...</p><p class="user-email" id="user-email">-</p></div><button class="btn btn-ghost btn-icon" id="logout-btn" title="Sign Out"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button></div>
    <div class="toggle-card"><div class="toggle-info"><span class="toggle-label">Protection</span><span class="toggle-status" id="toggle-status">Enabled</span></div><label class="toggle-switch"><input type="checkbox" id="enable-toggle" checked><span class="toggle-slider"></span></label></div>
    <div class="brand-section"><div class="section-header"><h3>Active Brand</h3><button class="btn btn-ghost btn-sm" id="refresh-brands" title="Refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M21 21v-5h-5"></path></svg></button></div><p class="brand-info">Brand auto-detected from page UI</p></div>
    <div class="stats-section"><div class="stat-card"><span class="stat-value" id="brands-count">0</span><span class="stat-label">Brands</span></div><div class="stat-card"><span class="stat-value" id="terms-count">0</span><span class="stat-label">Terms</span></div></div>
  </section>
  <footer class="footer"><a href="https://bizguard.bizcuits.io/dashboard" target="_blank" class="footer-link">Open Dashboard<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a></footer>
</div>
<script src="popup.js"></script>
</body></html>`;

const popupCss = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;background:linear-gradient(180deg,#f5f5f7,#fff);color:#1d1d1f;width:340px;min-height:400px}.popup-container{display:flex;flex-direction:column;min-height:400px}.header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(255,255,255,.8);backdrop-filter:blur(20px);border-bottom:1px solid rgba(0,0,0,.06)}.logo{display:flex;align-items:center;gap:10px}.logo-icon{width:32px;height:32px}.logo-text h1{font-size:16px;font-weight:600;color:#1d1d1f}.logo-text .version{font-size:11px;color:#86868b}.status-badge{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:500;background:rgba(0,0,0,.04);color:#86868b}.status-badge.active{background:rgba(52,199,89,.12);color:#248a3d}.status-dot{width:6px;height:6px;border-radius:50%;background:currentColor}.section{padding:20px;flex:1}.hidden{display:none!important}.login-section{display:flex;flex-direction:column;justify-content:center}.login-header{text-align:center;margin-bottom:24px}.login-header h2{font-size:22px;font-weight:600}.login-header p{font-size:14px;color:#86868b}.domain-hint{text-align:center;font-size:12px;color:#86868b;margin-top:16px}.error-message{padding:10px 12px;background:rgba(255,59,48,.1);border-radius:8px;color:#d70015;font-size:13px;margin-top:12px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border:none;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;transition:all .2s}.btn-microsoft{background:#2f2f2f;color:#fff}.btn-microsoft:hover{background:#404040}.btn-microsoft:disabled{opacity:.7;cursor:not-allowed}.microsoft-icon{flex-shrink:0}.btn-ghost{background:transparent;color:#86868b;padding:8px}.btn-ghost:hover{background:rgba(0,0,0,.04)}.btn-block{width:100%}.btn-loader{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.user-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px;margin-bottom:16px}.user-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0071e3,#5856d6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#fff}.user-info{flex:1;min-width:0}.user-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.user-email{font-size:12px;color:#86868b}.toggle-card{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px;margin-bottom:16px}.toggle-info{display:flex;flex-direction:column;gap:2px}.toggle-label{font-size:14px;font-weight:500}.toggle-status{font-size:12px;color:#248a3d}.toggle-switch{position:relative;width:50px;height:30px}.toggle-switch input{opacity:0;width:0;height:0}.toggle-slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.12);border-radius:30px;transition:all .3s}.toggle-slider::before{position:absolute;content:'';height:26px;width:26px;left:2px;bottom:2px;background:#fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:all .3s}input:checked+.toggle-slider{background:#34c759}input:checked+.toggle-slider::before{transform:translateX(20px)}.brand-section{margin-bottom:16px}.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.section-header h3{font-size:13px;font-weight:600;color:#86868b;text-transform:uppercase}.brand-info{font-size:13px;color:#86868b;padding:12px;background:rgba(0,0,0,.02);border-radius:8px}.stats-section{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stat-card{display:flex;flex-direction:column;align-items:center;padding:16px;background:rgba(255,255,255,.8);border:1px solid rgba(0,0,0,.06);border-radius:14px}.stat-value{font-size:24px;font-weight:600}.stat-label{font-size:12px;color:#86868b;margin-top:4px}.footer{padding:14px 20px;background:rgba(255,255,255,.6);border-top:1px solid rgba(0,0,0,.06)}.footer-link{display:flex;align-items:center;justify-content:center;gap:6px;color:#0071e3;text-decoration:none;font-size:13px;font-weight:500}`;

const popupJs = `const loginSection=document.getElementById('login-section'),mainSection=document.getElementById('main-section'),loginError=document.getElementById('login-error'),microsoftLoginBtn=document.getElementById('microsoft-login-btn'),logoutBtn=document.getElementById('logout-btn'),enableToggle=document.getElementById('enable-toggle'),toggleStatus=document.getElementById('toggle-status'),statusBadge=document.getElementById('status-badge'),refreshBrandsBtn=document.getElementById('refresh-brands'),userName=document.getElementById('user-name'),userEmail=document.getElementById('user-email'),userAvatar=document.getElementById('user-avatar'),brandsCount=document.getElementById('brands-count'),termsCount=document.getElementById('terms-count');let state={isEnabled:true,isAuthenticated:false,brands:[],userProfile:null};

async function init(){try{state=await chrome.runtime.sendMessage({type:'GET_STATE'});render()}catch(e){console.error(e)}}

function render(){state.isAuthenticated?(loginSection.classList.add('hidden'),mainSection.classList.remove('hidden'),renderMain()):(loginSection.classList.remove('hidden'),mainSection.classList.add('hidden'));updateStatus()}

function renderMain(){if(state.userProfile){userName.textContent=state.userProfile.displayName||'User';userEmail.textContent=state.userProfile.email||'';userAvatar.textContent=(state.userProfile.displayName||'U').charAt(0).toUpperCase()}enableToggle.checked=state.isEnabled;toggleStatus.textContent=state.isEnabled?'Enabled':'Disabled';brandsCount.textContent=state.brands.length;termsCount.textContent=state.brands.reduce((s,b)=>s+(b.terms?.length||0),0)}

function updateStatus(){const t=statusBadge.querySelector('.status-text');if(!state.isAuthenticated){statusBadge.className='status-badge';t.textContent='Not logged in'}else if(!state.isEnabled){statusBadge.className='status-badge';t.textContent='Disabled'}else{statusBadge.className='status-badge active';t.textContent='Active'}}

microsoftLoginBtn.addEventListener('click',async()=>{microsoftLoginBtn.disabled=true;microsoftLoginBtn.querySelector('.btn-text').textContent='Signing in...';microsoftLoginBtn.querySelector('.btn-loader').classList.remove('hidden');loginError.classList.add('hidden');try{const r=await chrome.runtime.sendMessage({type:'MICROSOFT_LOGIN'});if(r.success){state.isAuthenticated=true;state.userProfile=r.user;state=await chrome.runtime.sendMessage({type:'GET_STATE'});render()}else{loginError.textContent=r.error||'Microsoft login failed';loginError.classList.remove('hidden')}}catch(e){loginError.textContent='An error occurred. Please try again.';loginError.classList.remove('hidden')}finally{microsoftLoginBtn.disabled=false;microsoftLoginBtn.querySelector('.btn-text').textContent='Sign in with Microsoft';microsoftLoginBtn.querySelector('.btn-loader').classList.add('hidden')}});

logoutBtn.addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'LOGOUT'});state.isAuthenticated=false;state.userProfile=null;render()});

enableToggle.addEventListener('change',async()=>{await chrome.runtime.sendMessage({type:'SET_ENABLED',enabled:enableToggle.checked});state.isEnabled=enableToggle.checked;toggleStatus.textContent=state.isEnabled?'Enabled':'Disabled';updateStatus()});

refreshBrandsBtn.addEventListener('click',async()=>{const r=await chrome.runtime.sendMessage({type:'REFRESH_BRANDS'});if(r.brands){state.brands=r.brands;brandsCount.textContent=state.brands.length;termsCount.textContent=state.brands.reduce((s,b)=>s+(b.terms?.length||0),0)}});

init();`;

const readmeMd = `# BizGuard Extension v5.9.0

## Installation
1. Go to chrome://extensions (Chrome) or edge://extensions (Edge)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this folder

## Features
- Real-time term detection with auto brand detection from UI
- Works on HelpDesk, LiveChat, and Text.com
- Microsoft/Azure AD sign-in
- Auto-sync with dashboard
- Hardcoded fallback brand mapping + backend brand support

## Supported Sites
- https://app.helpdesk.com/*
- https://my.livechatinc.com/*
- https://www.text.com/app/inbox/*
- https://text.com/app/inbox/*

## How It Works
The extension automatically detects which brand you're working on by reading the Team label from the page UI. When you type terms from other brands, it shows a warning modal.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generating extension ZIP v5.9.0...');
    
    const zip = new JSZip();
    
    zip.addFile('manifest.json', manifestJson);
    zip.addFile('background.js', backgroundJs);
    zip.addFile('content.js', contentJs);
    zip.addFile('content.css', contentCss);
    zip.addFile('popup.html', popupHtml);
    zip.addFile('popup.css', popupCss);
    zip.addFile('popup.js', popupJs);
    zip.addFile('README.md', readmeMd);
    
    const iconSizes = [16, 32, 48, 128];
    for (const size of iconSizes) {
      const pngData = createSimplePng(size);
      zip.addFile(`icons/icon${size}.png`, pngData);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    console.log('ZIP generated, size:', zipBlob.size);
    
    return new Response(zipBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="bizguard-extension-v5.9.0.zip"',
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
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
