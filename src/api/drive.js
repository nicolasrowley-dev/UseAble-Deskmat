// ─── Google Drive API v3 Wrapper ───
// All file operations used by the app go through this module.
// Config sync (appDataFolder) is also handled here.

import { CONFIG } from '../config';
import { getToken } from '../auth/google';

const API = CONFIG.DRIVE_API_BASE;

// Core authenticated request helper
async function driveRequest(path, options = {}) {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const isUpload = path.startsWith('https://');
  const url = isUpload ? path : `${API}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Drive API error ${response.status}`;
    try {
      const err = await response.json();
      message = err.error?.message || message;
    } catch (_) {}
    throw new Error(message);
  }

  // Some PATCH responses return 200 with no body
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) return response.json();
  return null;
}

// ─── MIME type mapping ───────────────────────────────────────────────────────

function mimeToType(mimeType) {
  if (!mimeType) return 'document';
  const map = {
    'application/vnd.google-apps.folder': 'folder',
    'application/vnd.google-apps.document': 'document',
    'application/vnd.google-apps.spreadsheet': 'spreadsheet',
    'application/vnd.google-apps.presentation': 'presentation',
    'application/pdf': 'pdf',
  };
  if (map[mimeType]) return map[mimeType];
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  return 'document';
}

// Normalise a raw Drive file object into the shape the app uses
function normaliseFile(f, parentId) {
  return {
    id: f.id,
    name: f.name,
    type: mimeToType(f.mimeType),
    mimeType: f.mimeType,
    parentId: parentId === 'root' ? null : parentId,
    thumbnail: f.thumbnailLink || null,
    webLink: f.webViewLink || null,
    modified: f.modifiedTime || null,
    size: f.size || null,
  };
}

// ─── File listing ────────────────────────────────────────────────────────────

// List all non-trashed files in a folder (up to 200 per call)
export async function listFiles(folderId = 'root') {
  const query = `'${folderId}' in parents and trashed = false`;
  const fields = 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,modifiedTime,size)';
  const params = new URLSearchParams({
    q: query,
    fields,
    orderBy: 'folder,name',
    pageSize: '200',
  });

  const data = await driveRequest(`/files?${params}`);
  return (data.files || []).map(f => normaliseFile(f, folderId));
}

// ─── File operations ─────────────────────────────────────────────────────────

export async function renameFile(fileId, newName) {
  return driveRequest(`/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
}

export async function trashFile(fileId) {
  return driveRequest(`/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

export async function moveFile(fileId, newParentId, oldParentId) {
  const addParents = newParentId === null ? 'root' : newParentId;
  const removeParents = oldParentId === null ? 'root' : oldParentId;
  return driveRequest(
    `/files/${fileId}?addParents=${addParents}&removeParents=${removeParents}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  );
}

export async function copyFile(fileId, newName, parentId) {
  const parents = parentId === null ? ['root'] : [parentId];
  const result = await driveRequest(`/files/${fileId}/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName, parents }),
  });
  return result ? normaliseFile(result, parentId) : null;
}

export async function createFolder(name, parentId = null) {
  const parents = parentId === null ? ['root'] : [parentId];
  const result = await driveRequest('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents,
    }),
  });
  return result ? normaliseFile(result, parentId) : null;
}

export async function createDocument(name, parentId = null) {
  const parents = parentId === null ? ['root'] : [parentId];
  const result = await driveRequest('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.document',
      parents,
    }),
  });
  return result ? normaliseFile(result, parentId) : null;
}

// Return a URL that opens the file in Google Drive / the appropriate editor
export function getOpenUrl(file) {
  if (file.webLink) return file.webLink;
  return `https://drive.google.com/file/d/${file.id}/view`;
}

// ─── Config sync (appDataFolder) ─────────────────────────────────────────────
// Layout config is stored in a hidden, app-specific file the user never sees.
// It doesn't count against Drive quota and auto-follows the Google account.

let _configFileId = null;

async function getConfigFileId() {
  if (_configFileId) return _configFileId;

  const query = `name = '${CONFIG.CONFIG_FILENAME}' and 'appDataFolder' in parents and trashed = false`;
  const params = new URLSearchParams({ q: query, spaces: 'appDataFolder', fields: 'files(id)' });
  const data = await driveRequest(`/files?${params}`);

  if (data.files?.length > 0) {
    _configFileId = data.files[0].id;
    return _configFileId;
  }

  // First run — create the config file
  const created = await driveRequest('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: CONFIG.CONFIG_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }),
  });
  _configFileId = created.id;
  return _configFileId;
}

export async function loadCloudConfig() {
  try {
    const fileId = await getConfigFileId();
    const token = getToken();
    const response = await fetch(`${API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn('[Drive] Failed to load cloud config:', e);
    return null;
  }
}

export async function saveCloudConfig(config) {
  try {
    const fileId = await getConfigFileId();
    const token = getToken();
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      }
    );
    return true;
  } catch (e) {
    console.warn('[Drive] Failed to save cloud config:', e);
    return false;
  }
}
