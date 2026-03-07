# Desktop Files — Setup & Deployment Guide

## Overview

This guide walks you through turning the Desktop Files prototype into a working app your wife can install on her Chromebook. We'll:

1. Set up a Google Cloud project with Drive API access
2. Scaffold the React app for production
3. Deploy to GitHub Pages as an installable PWA

**Time estimate:** About 1–2 hours for the full setup.

---

## Part 1: Google Cloud Project Setup

This is the bit that gives us permission to read/write files in Google Drive.

### 1.1 Create a Google Cloud Account

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Sign in with the Google account that owns the Drive files (your wife's account, or a shared one)
3. If prompted, agree to the terms of service

### 1.2 Create a New Project

1. Click the project dropdown at the top of the page (it may say "Select a project")
2. Click **New Project**
3. Name it something like `Desktop Files`
4. Click **Create**
5. Make sure the new project is selected in the dropdown

### 1.3 Enable the Google Drive API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **Google Drive API**
3. Click on it, then click **Enable**

### 1.4 Configure the OAuth Consent Screen

This is what users see when they first log in to the app.

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** (unless you have a Google Workspace org, then Internal is fine)
3. Click **Create**
4. Fill in:
   - **App name:** Desktop Files
   - **User support email:** your email
   - **Developer contact information:** your email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes**
7. Search for and add these scopes:
   - `https://www.googleapis.com/auth/drive.readonly` (to list and read files)
   - `https://www.googleapis.com/auth/drive.file` (to create/modify files the app creates)
   - `https://www.googleapis.com/auth/drive` (full Drive access — needed for moving/copying files between folders)
   - `https://www.googleapis.com/auth/drive.appdata` (to store layout config in hidden app folder — this is what enables cross-device sync)
8. Click **Update**, then **Save and Continue**
9. On the **Test users** page, add your wife's Google email address
10. Click **Save and Continue**, then **Back to Dashboard**

> **Note:** While the app is in "Testing" mode, only the test users you add can use it. This is fine for personal use. If you ever want to publish it publicly, you'd need to go through Google's verification process.

### 1.5 Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `Desktop Files Web`
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development with Vite)
   - `https://YOUR-GITHUB-USERNAME.github.io` (for production)
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173`
   - `https://YOUR-GITHUB-USERNAME.github.io/desktop-files/`
7. Click **Create**
8. **Copy the Client ID** — you'll need this. It looks like: `123456789-abcdef.apps.googleusercontent.com`

---

## Part 2: Project Scaffolding

### 2.1 Prerequisites

Make sure you have these installed on your dev machine (Mac Mini):

```bash
# Check Node.js (need v18+)
node --version

# If not installed:
brew install node

# Check Git
git --version

# If not installed:
brew install git
```

### 2.2 Create the React App

```bash
# Create a new Vite + React project
npm create vite@latest desktop-files -- --template react
cd desktop-files

# Install dependencies
npm install

# Install Google Identity Services (for OAuth)
npm install jwt-decode

# Test it works
npm run dev
```

You should see the Vite dev server running at `http://localhost:5173`.

### 2.3 Project Structure

Replace the default Vite scaffolding with our app structure:

```
desktop-files/
├── public/
│   ├── manifest.json          ← PWA manifest
│   ├── icon-192.png           ← App icon (192x192)
│   ├── icon-512.png           ← App icon (512x512)
│   └── sw.js                  ← Service worker (offline support)
├── src/
│   ├── App.jsx                ← Main app (our desktop-files-v3.jsx)
│   ├── main.jsx               ← Entry point
│   ├── api/
│   │   └── drive.js           ← Google Drive API wrapper
│   ├── auth/
│   │   └── google.js          ← OAuth login/logout
│   ├── components/
│   │   ├── DesktopCanvas.jsx  ← Main desktop canvas
│   │   ├── FileIcon.jsx       ← Individual file icon
│   │   ├── Fence.jsx          ← Desktop fence component
│   │   ├── FolderPicker.jsx   ← Folder picker dialog
│   │   ├── ContextMenu.jsx    ← Right-click menus
│   │   └── Dialogs.jsx        ← Rename, wallpaper, etc.
│   ├── hooks/
│   │   ├── useDragDrop.js     ← Drag & drop logic
│   │   └── usePositions.js    ← Position persistence
│   └── config.js              ← API keys, constants
├── index.html
├── vite.config.js
└── package.json
```

### 2.4 Configuration File

Create `src/config.js`:

```javascript
export const CONFIG = {
  // Replace with your Client ID from step 1.5
  GOOGLE_CLIENT_ID: 'YOUR-CLIENT-ID-HERE.apps.googleusercontent.com',

  // The Drive folder ID to use as the "desktop"
  // You can find this in the URL when you open a folder in Google Drive:
  // https://drive.google.com/drive/folders/THIS_IS_THE_FOLDER_ID
  ROOT_FOLDER_ID: null, // null = user picks on first launch

  // API settings
  DRIVE_API_BASE: 'https://www.googleapis.com/drive/v3',
  SCOPES: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.appdata',
};
```

### 2.5 Google Auth Module

Create `src/auth/google.js`:

```javascript
import { CONFIG } from '../config';

let tokenClient = null;
let accessToken = null;

export function initAuth() {
  return new Promise((resolve) => {
    // Load the Google Identity Services library
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
          if (response.access_token) {
            accessToken = response.access_token;
            localStorage.setItem('gapi_token', response.access_token);
          }
        },
      });
      // Check for existing token
      accessToken = localStorage.getItem('gapi_token');
      resolve();
    };
    document.head.appendChild(script);
  });
}

export function signIn() {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (response) => {
      if (response.error) reject(response);
      else {
        accessToken = response.access_token;
        localStorage.setItem('gapi_token', response.access_token);
        resolve(response);
      }
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function signOut() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken);
    accessToken = null;
    localStorage.removeItem('gapi_token');
  }
}

export function getToken() {
  return accessToken;
}

export function isSignedIn() {
  return !!accessToken;
}
```

### 2.6 Google Drive API Wrapper

Create `src/api/drive.js`:

```javascript
import { CONFIG } from '../config';
import { getToken } from '../auth/google';

const API = CONFIG.DRIVE_API_BASE;

async function driveRequest(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Drive API error');
  }

  return response.json();
}

// ─── Config Sync (appDataFolder) ───
// Stores layout config in a hidden app-specific folder in the user's Drive.
// The user never sees this file. It syncs across all devices automatically.

const CONFIG_FILENAME = 'desktop-files-config.json';

// Find or create the config file in appDataFolder
async function getConfigFileId() {
  const query = `name = '${CONFIG_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
  const data = await driveRequest(`/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id)`);

  if (data.files.length > 0) return data.files[0].id;

  // Create the config file
  const created = await driveRequest('/files', {
    method: 'POST',
    body: JSON.stringify({
      name: CONFIG_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }),
  });
  return created.id;
}

// Load config from Drive
export async function loadCloudConfig() {
  try {
    const fileId = await getConfigFileId();
    const token = getToken();
    const response = await fetch(`${API}/files/${fileId}?alt=media`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn('Failed to load cloud config:', e);
    return null;
  }
}

// Save config to Drive
export async function saveCloudConfig(config) {
  try {
    const fileId = await getConfigFileId();
    const token = getToken();
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      }
    );
    return true;
  } catch (e) {
    console.warn('Failed to save cloud config:', e);
    return false;
  }
}

// ─── File Operations ───

// List files in a folder
export async function listFiles(folderId = 'root') {
  const query = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id,name,mimeType,thumbnailLink,iconLink,webViewLink,modifiedTime,size)';
  const data = await driveRequest(
    `/files?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=name&pageSize=200`
  );
  return data.files.map(f => ({
    id: f.id,
    name: f.name,
    type: mimeToType(f.mimeType),
    mimeType: f.mimeType,
    parentId: folderId === 'root' ? null : folderId,
    thumbnail: f.thumbnailLink,
    icon: f.iconLink,
    webLink: f.webViewLink,
    modified: f.modifiedTime,
    size: f.size,
  }));
}

// Create a new folder
export async function createFolder(name, parentId = 'root') {
  return driveRequest('/files', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
}

// Move a file to a different folder
export async function moveFile(fileId, newParentId, oldParentId) {
  return driveRequest(
    `/files/${fileId}?addParents=${newParentId}&removeParents=${oldParentId}`,
    { method: 'PATCH' }
  );
}

// Copy a file
export async function copyFile(fileId, newName, parentId) {
  return driveRequest(`/files/${fileId}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      name: newName,
      parents: [parentId],
    }),
  });
}

// Rename a file
export async function renameFile(fileId, newName) {
  return driveRequest(`/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });
}

// Delete a file (move to trash)
export async function trashFile(fileId) {
  return driveRequest(`/files/${fileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ trashed: true }),
  });
}

// Create a new Google Doc
export async function createDocument(name, parentId = 'root') {
  return driveRequest('/files', {
    method: 'POST',
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.document',
      parents: [parentId],
    }),
  });
}

// Get file open URL
export function getOpenUrl(file) {
  if (file.webLink) return file.webLink;
  return `https://drive.google.com/file/d/${file.id}/view`;
}

// Helper: map MIME types to our icon types
function mimeToType(mimeType) {
  const map = {
    'application/vnd.google-apps.folder': 'folder',
    'application/vnd.google-apps.document': 'document',
    'application/vnd.google-apps.spreadsheet': 'spreadsheet',
    'application/vnd.google-apps.presentation': 'presentation',
    'application/pdf': 'pdf',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
  };
  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  return 'document';
}
```

### 2.7 Config Sync Strategy

The app uses a **local-first, cloud-sync** approach:

1. **On startup:** Load from localStorage instantly (fast), then fetch from Drive in the background. If the Drive version has a newer timestamp, overwrite local.
2. **On change:** Save to localStorage immediately, then debounce a Drive save (2 seconds after last change). This means dragging icons around feels instant — no waiting for API calls.
3. **Conflict resolution:** Last-write-wins using timestamps. Since this is a single-user app, conflicts are extremely rare (only if two devices are used simultaneously).

The config file stored in Drive looks like:

```json
{
  "version": 1,
  "timestamp": 1708012345678,
  "rootFolderId": "abc123def456",
  "positions": {
    "driveFileId1": { "x": 100, "y": 200 },
    "driveFileId2": { "x": 300, "y": 200 }
  },
  "fences": [
    { "id": "fence-1", "name": "Work Stuff", "x": 400, "y": 100, "w": 300, "h": 300, "rolledUp": false }
  ],
  "wallpaper": "ocean",
  "customWallpaper": null
}
```

This is stored in Google Drive's `appDataFolder` — a hidden, app-specific space that the user never sees in their normal Drive. It doesn't count against their storage quota and is automatically available on any device where they sign into the app.

---

## Part 3: PWA Configuration

### 3.1 Manifest File

Create `public/manifest.json`:

```json
{
  "name": "Desktop Files",
  "short_name": "Files",
  "description": "Visual file manager for Google Drive",
  "start_url": "/desktop-files/",
  "display": "standalone",
  "background_color": "#1a472a",
  "theme_color": "#1a472a",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 3.2 Service Worker

Create `public/sw.js`:

```javascript
const CACHE_NAME = 'desktop-files-v1';
const STATIC_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first for static assets, network-first for API calls
  if (event.request.url.includes('googleapis.com')) {
    event.respondWith(fetch(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
```

### 3.3 Register the Service Worker

In `index.html`, add before `</body>`:

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/desktop-files/sw.js');
  }
</script>
```

### 3.4 Vite Config for GitHub Pages

Update `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/desktop-files/',  // Must match your GitHub repo name
})
```

---

## Part 4: Deploy to GitHub Pages

### 4.1 Create the GitHub Repository

1. Go to [https://github.com/new](https://github.com/new)
2. Name it `desktop-files`
3. Make it Public (required for free GitHub Pages)
4. Don't initialise with README (we'll push from local)
5. Click **Create repository**

### 4.2 Push Your Code

```bash
cd desktop-files

# Initialise git
git init
git add .
git commit -m "Initial commit - Desktop Files PWA"

# Add remote and push
git remote add origin https://github.com/YOUR-USERNAME/desktop-files.git
git branch -M main
git push -u origin main
```

### 4.3 Set Up GitHub Actions for Auto-Deploy

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 4.4 Enable GitHub Pages

1. Go to your repo on GitHub → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push a commit and it'll auto-deploy

### 4.5 Update Google Cloud Credentials

Go back to Google Cloud Console → Credentials and make sure your OAuth client has:
- **JavaScript origin:** `https://YOUR-USERNAME.github.io`
- **Redirect URI:** `https://YOUR-USERNAME.github.io/desktop-files/`

---

## Part 5: Installing on the Chromebook

Once deployed:

1. Open Chrome on the Chromebook
2. Go to `https://YOUR-USERNAME.github.io/desktop-files/`
3. Click the **Install** icon in the address bar (or the three-dot menu → "Install app")
4. The app now appears on the Chromebook shelf as "Desktop Files"
5. On first launch, click **Sign in with Google**
6. Choose a Drive folder to use as the "desktop"
7. Done! Files appear as draggable icons

---

## Quick Reference — Key Files to Edit

| What | Where |
|------|-------|
| Google Client ID | `src/config.js` |
| Drive API calls | `src/api/drive.js` |
| Auth logic | `src/auth/google.js` |
| Desktop UI (prototype) | `src/App.jsx` |
| PWA manifest | `public/manifest.json` |
| Deploy config | `vite.config.js` |
| Auto-deploy | `.github/workflows/deploy.yml` |

---

## Next Steps

Once the basic setup is working, we can add:

- **Folder picker on first launch** — let her choose which Drive folder to use as the desktop
- **Real file thumbnails** — Drive API provides preview images for docs, sheets, photos
- **Offline layout** — icon positions cached locally, sync when back online
- **Multiple desktops** — different folder-to-desktop mappings
- **Search** — find files across the desktop without scrolling
- **Sort options** — by name, date, type, size
