// ─── Dialogs & Overlays ───
// Rename dialog, wallpaper picker, toast notifications, sync indicator.

import { useState, useEffect, useRef } from 'react';

// ─── Toast ───────────────────────────────────────────────────────────────────

export function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', bottom: 70, left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(20,20,30,0.92)', backdropFilter: 'blur(16px)',
      color: '#fff', padding: '10px 24px', borderRadius: 10,
      fontSize: 13, boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
      zIndex: 10000, border: '1px solid rgba(255,255,255,0.1)',
      animation: 'toastIn 0.25s ease-out',
    }}>
      {message}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sync Indicator ──────────────────────────────────────────────────────────

export function SyncIndicator({ status }) {
  const icons  = { saved: '💾', synced: '☁️', error: '⚠️', idle: '' };
  const labels = { saved: 'Saving…', synced: 'Synced', error: 'Sync failed', idle: '' };
  if (status === 'idle') return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      color: status === 'error' ? '#ff8a80' : 'rgba(255,255,255,0.5)',
      fontSize: 11,
      animation: status === 'synced' ? 'syncFadeOut 2s forwards' : 'none',
    }}>
      <span style={{ fontSize: 12 }}>{icons[status]}</span>
      {labels[status]}
      <style>{`@keyframes syncFadeOut { 0% { opacity:1; } 70% { opacity:1; } 100% { opacity:0; } }`}</style>
    </div>
  );
}

// ─── Rename Dialog ───────────────────────────────────────────────────────────

export function RenameDialog({ file, onConfirm, onCancel }) {
  const [value, setValue] = useState(file.name);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== file.name) onConfirm(trimmed);
    else onCancel();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(30,30,42,0.97)', backdropFilter: 'blur(24px)',
          borderRadius: 14, padding: 24, minWidth: 340,
          border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Rename</div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#4a8fe7', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wallpaper Dialog ────────────────────────────────────────────────────────

export const WALLPAPERS = {
  meadow:   { label: 'Meadow',   bg: 'linear-gradient(160deg, #1a472a 0%, #2d5a27 20%, #4a7c3f 40%, #6b9b5e 60%, #89b77a 80%, #a8d4a0 100%)' },
  ocean:    { label: 'Ocean',    bg: 'linear-gradient(160deg, #0a1628 0%, #0d2847 20%, #134a7c 40%, #1a6db5 60%, #4a9fd4 80%, #7ec8e3 100%)' },
  sunset:   { label: 'Sunset',   bg: 'linear-gradient(160deg, #1a0a2e 0%, #3d1155 20%, #6b1d5e 40%, #a12a5e 60%, #d4605a 80%, #f4a460 100%)' },
  slate:    { label: 'Slate',    bg: 'linear-gradient(160deg, #1a1a2e 0%, #2d2d44 20%, #3d3d5c 40%, #4a4a6a 60%, #5a5a7a 80%, #6a6a8a 100%)' },
  dawn:     { label: 'Dawn',     bg: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 20%, #302b63 40%, #4a3f8a 60%, #7b6eb5 80%, #ecd5c8 100%)' },
  forest:   { label: 'Forest',   bg: 'linear-gradient(160deg, #0b1a0f 0%, #1a3a1a 20%, #2d5a2d 35%, #1a4a3a 50%, #0d3a4a 70%, #1a2a3a 100%)' },
  cherry:   { label: 'Cherry',   bg: 'linear-gradient(160deg, #2a0a1a 0%, #5a1a2a 20%, #8a2a3a 40%, #ba4a5a 55%, #da8a8a 75%, #f0c0c0 100%)' },
  midnight: { label: 'Midnight', bg: 'linear-gradient(160deg, #020010 0%, #0a0a2a 25%, #0a1040 50%, #101a50 75%, #1a2a60 100%)' },
};

export function WallpaperDialog({ currentWallpaper, currentCustom, onSelect, onClose }) {
  const [url, setUrl] = useState(currentCustom || '');
  const [tab, setTab] = useState(currentCustom ? 'custom' : 'presets');
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUrl(ev.target.result);
      onSelect({ type: 'custom', value: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(26,26,38,0.97)', backdropFilter: 'blur(24px)',
          borderRadius: 16, padding: 28, width: 420, maxHeight: '80vh', overflowY: 'auto',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Desktop Background</div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
          {[['presets', 'Presets'], ['custom', 'Your Image']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '9px 0', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === key ? 'rgba(74,143,231,0.3)' : 'rgba(255,255,255,0.04)',
                color: tab === key ? '#7cb3ff' : 'rgba(255,255,255,0.5)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'presets' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Object.entries(WALLPAPERS).map(([key, { label, bg }]) => (
              <div
                key={key}
                onClick={() => onSelect({ type: 'preset', value: key })}
                style={{
                  height: 72, borderRadius: 10, background: bg, cursor: 'pointer',
                  border: currentWallpaper === key ? '2.5px solid #7cb3ff' : '2px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'flex-end', padding: 8,
                  transform: currentWallpaper === key ? 'scale(1.02)' : 'none',
                }}
              >
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'custom' && (
          <div>
            <div
              style={{ border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 16 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Tap to upload an image</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={url.startsWith('data:') ? '(uploaded)' : url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                style={{ flex: 1, padding: '9px 12px', fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', outline: 'none' }}
              />
              <button
                onClick={() => { if (url.trim()) onSelect({ type: 'custom', value: url.trim() }); }}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#4a8fe7', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{ marginTop: 20, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
