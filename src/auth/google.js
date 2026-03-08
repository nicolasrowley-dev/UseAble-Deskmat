// ─── Google Identity Services OAuth ───
// Handles sign-in, sign-out, and token management.
// Uses the GIS token flow (implicit grant) — no backend required.

import { CONFIG } from '../config';

let tokenClient = null;
let accessToken = null;
const TOKEN_KEY = 'deskmat_gapi_token';
const TOKEN_EXPIRY_KEY = 'deskmat_gapi_token_expiry';

// Initialise the GIS library. Call this once on app mount.
export function initAuth() {
  return new Promise((resolve) => {
    // Check if GIS script is already loaded
    if (window.google?.accounts?.oauth2) {
      tokenClient = _createTokenClient();
      accessToken = _loadStoredToken();
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      tokenClient = _createTokenClient();
      accessToken = _loadStoredToken();
      resolve();
    };
    script.onerror = () => {
      console.error('[Auth] Failed to load Google Identity Services script');
      resolve(); // resolve anyway so app can show an error state
    };
    document.head.appendChild(script);
  });
}

function _createTokenClient() {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: () => {}, // overridden per-request in signIn()
  });
}

// Load a stored token from localStorage, checking expiry
function _loadStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
    if (token && expiry > Date.now()) return token;
  } catch (_) {}
  return null;
}

// Prompt the user to sign in (opens Google's OAuth popup)
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    // Always re-create the token client immediately before requesting a token.
    // Reusing the instance created at initAuth() time can leave params in a
    // stale / unset state, causing the "Params are not set" GIS error.
    try {
      tokenClient = _createTokenClient();
    } catch (e) {
      reject(new Error('Failed to initialise auth client: ' + e.message));
      return;
    }
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      accessToken = response.access_token;
      // GIS tokens last 1 hour; store with expiry buffer
      const expiry = Date.now() + (response.expires_in - 60) * 1000;
      try {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
      } catch (_) {}
      resolve(response);
    };
    // 'select_account' shows the account picker; empty string causes
    // GIS to throw "Params are not set"
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  });
}

export function signOut() {
  if (accessToken) {
    try {
      window.google?.accounts?.oauth2?.revoke(accessToken, () => {});
    } catch (_) {}
    accessToken = null;
  }
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (_) {}
}

export function getToken() {
  return accessToken;
}

export function isSignedIn() {
  return !!accessToken;
}
