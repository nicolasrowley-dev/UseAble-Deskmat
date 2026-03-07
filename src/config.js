// ─── App Configuration ───
// Before deploying, replace GOOGLE_CLIENT_ID with your OAuth Client ID
// from Google Cloud Console → APIs & Services → Credentials
// See: project prototype files/setup-guide.md → Part 1 for full instructions

export const CONFIG = {
  // ⚠️  Replace this with your actual Client ID from Google Cloud Console
  GOOGLE_CLIENT_ID: 'YOUR-CLIENT-ID-HERE.apps.googleusercontent.com',

  // Google Drive API
  DRIVE_API_BASE: 'https://www.googleapis.com/drive/v3',

  // OAuth scopes required by the app
  // - drive: full access (needed for move/copy between folders)
  // - drive.appdata: hidden config storage for layout sync
  SCOPES: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.appdata',
  ].join(' '),

  // Config sync settings
  SYNC_DEBOUNCE_MS: 2000,   // ms after last change before saving to Drive
  CONFIG_FILENAME: 'deskmat-config.json',
};
