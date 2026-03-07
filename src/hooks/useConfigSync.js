// ─── Config Sync Hook ───
// Local-first, cloud-sync architecture:
//   1. Reads from localStorage instantly on load
//   2. After auth, checks Drive for a newer cloud copy
//   3. On every change, saves to localStorage immediately
//   4. Debounces Drive saves (2s after last change) so dragging feels instant

import { loadCloudConfig, saveCloudConfig } from '../api/drive';
import { CONFIG } from '../config';

const CONFIG_VERSION = 1;
const LS_KEY = 'deskmat-config';

class ConfigSync {
  constructor() {
    this._debounceTimer = null;
    this._lastSyncTime = 0;
    this._listeners = new Set();
    this._dirty = false;
    this._driveEnabled = false;
  }

  // Call this after the user signs in to unlock Drive sync
  enableDrive() {
    this._driveEnabled = true;
  }

  disableDrive() {
    this._driveEnabled = false;
  }

  // Load config — Drive-first if enabled, localStorage fallback
  async load() {
    try {
      const rawLocal = localStorage.getItem(LS_KEY);
      const local = rawLocal ? JSON.parse(rawLocal) : null;

      if (this._driveEnabled) {
        const remote = await loadCloudConfig();
        if (remote && remote.version === CONFIG_VERSION) {
          const localTs = local?.timestamp || 0;
          if (remote.timestamp > localTs) {
            // Cloud is newer — update local cache
            localStorage.setItem(LS_KEY, JSON.stringify(remote));
            return remote;
          }
        }
      }

      if (local && local.version === CONFIG_VERSION) return local;
    } catch (e) {
      console.warn('[ConfigSync] Load failed:', e);
    }

    return this._defaults();
  }

  // Save immediately to localStorage, debounce to Drive
  save(config) {
    const stamped = { ...config, version: CONFIG_VERSION, timestamp: Date.now() };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(stamped));
    } catch (_) {}
    this._dirty = true;
    this._notify('saved');

    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(
      () => this._syncToCloud(stamped),
      CONFIG.SYNC_DEBOUNCE_MS
    );
  }

  async _syncToCloud(config) {
    if (!this._driveEnabled) {
      this._notify('synced');
      return;
    }
    try {
      await saveCloudConfig(config);
      this._lastSyncTime = Date.now();
      this._dirty = false;
      this._notify('synced');
    } catch (e) {
      console.warn('[ConfigSync] Cloud sync failed:', e);
      this._notify('error');
    }
  }

  onStatus(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify(status) {
    this._listeners.forEach(fn => fn(status));
  }

  _defaults() {
    return {
      version: CONFIG_VERSION,
      timestamp: 0,
      positions: {},
      fences: [],
      wallpaper: 'meadow',
      customWallpaper: null,
    };
  }

  isDirty() { return this._dirty; }
  lastSync() { return this._lastSyncTime; }
}

// Singleton — one instance shared across the app
export const configSync = new ConfigSync();
