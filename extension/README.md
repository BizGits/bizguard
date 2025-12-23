# BizGuard Browser Extension v5

A Chrome/Edge extension that protects brands by detecting cross-brand term usage in real-time.

## Features

- **Real-time term detection**: Monitors text inputs for competitor brand terms
- **Brand switching**: Select which brand you're currently working with
- **Heartbeat system**: Keeps track of active extensions
- **Event logging**: All blocked terms are logged to the dashboard
- **Microsoft auth**: Login with your company credentials

## Installation

### Development

1. Open Chrome/Edge and go to `chrome://extensions/` or `edge://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder

### Building for Production

1. Create icons (16x16, 32x32, 48x48, 128x128) and place in `extension/icons/`
2. Zip the entire `extension` folder
3. Upload to Chrome Web Store or distribute internally

## Configuration

### Azure AD Setup (for Microsoft auth)

The extension uses a web-based redirect for Azure AD authentication, which means you only need to configure ONE redirect URI in Azure AD, regardless of how many users download the extension.

1. Register an app in Azure AD (or use existing)
2. Add redirect URI: `https://bizguard.bizcuits.io/extension-auth?action=callback`
   - This is a **Web** platform redirect URI, not SPA
3. No need to add extension-specific redirect URIs anymore!

This approach eliminates the need to configure browser redirect URIs for each extension installation.

### API Endpoints

The extension connects to:
- `GET /functions/v1/brands` - Fetch active brands and terms
- `POST /functions/v1/heartbeat` - Send heartbeat (every 2 mins)
- `POST /functions/v1/extension-status` - Update extension status

## File Structure

```
extension/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker (auth, heartbeat, state)
├── content.js         # Content script (term detection)
├── content.css        # Warning overlay styles
├── popup.html         # Popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # This file
```

## How It Works

1. **Login**: User authenticates via popup
2. **Brand Selection**: User selects which brand they're working with
3. **Monitoring**: Content script watches all text inputs
4. **Detection**: When a term from another brand is typed, a warning appears
5. **Logging**: Blocked terms are sent to the dashboard

## Supported Platforms

The content script is injected on:
- Zendesk (`*.zendesk.com`)
- Freshdesk (`*.freshdesk.com`)
- Intercom (`*.intercom.io`)
- Help Scout (`*.helpscout.net`)

Add more platforms by updating `host_permissions` and `content_scripts.matches` in `manifest.json`.

## Development Notes

- Uses MV3 (Manifest Version 3)
- Background runs as a service worker
- State persisted in `chrome.storage.local`
- Heartbeat sent every 2 minutes
- Brands refreshed every 5 minutes
