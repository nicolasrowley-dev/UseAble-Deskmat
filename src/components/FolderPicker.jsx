// ─── Folder Picker Dialog ───
// Browse the file tree to pick a destination folder for move/copy operations.
// Accepts an async `fetchFolders(folderId)` prop so it can load Drive data on demand.

import { useState, useEffect } from 'react';

export function FolderPickerDialog({ title, files, excludeIds, currentFolderId, onSelect, onCancel, onLoadFolder }) {
  const [browsing, setBrowsing] = useState(null);           // null = root
  const [browseHistory, setBrowseHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // When the user navigates into a folder, fetch its contents if not already cached
  const goInto = async (folderId) => {
    setBrowseHistory(prev => [...prev, browsing]);
    setBrowsing(folderId);

    // Trigger load if this folder's contents aren't in the files array yet
    if (onLoadFolder) {
      setLoading(true);
      await onLoadFolder(folderId);
      setLoading(false);
    }
  };

  const goBack = () => {
    if (!browseHistory.length) return;
    setBrowsing(browseHistory.at(-1));
    setBrowseHistory(prev => prev.slice(0, -1));
  };

  const folders = files.filter(
    f => f.type === 'folder' && f.parentId === browsing && !excludeIds.has(f.id)
  );
  const currentName = browsing
    ? (files.find(f => f.id === browsing)?.name || '…')
    : 'My Drive';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(26,26,38,0.97)', backdropFilter: 'blur(24px)',
          borderRadius: 16, width: 380,
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {browsing !== null && (
              <div
                onClick={goBack}
                style={{ cursor: 'pointer', padding: '3px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.06)' }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                  <path d="M10 3L5 8l5 5"/>
                </svg>
              </div>
            )}
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>{currentName}</span>
          </div>
        </div>

        {/* Folder list */}
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '6px 0' }}>
          <PickerItem
            label={`Place here — ${currentName}`}
            icon="📌"
            isTarget
            disabled={browsing === currentFolderId}
            onClick={() => onSelect(browsing)}
          />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 14px' }} />

          {loading ? (
            <div style={{ padding: '20px 22px', color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>Loading…</div>
          ) : folders.length === 0 ? (
            <div style={{ padding: '20px 22px', color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>No subfolders</div>
          ) : (
            folders.map(f => (
              <PickerItem
                key={f.id}
                label={f.name}
                count={files.filter(x => x.parentId === f.id).length}
                onClick={() => goInto(f.id)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function PickerItem({ label, icon, count, isTarget, disabled, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 22px', display: 'flex', alignItems: 'center', gap: 10,
        cursor: disabled ? 'default' : 'pointer',
        background: hover && !disabled
          ? (isTarget ? 'rgba(74,143,231,0.15)' : 'rgba(255,255,255,0.06)')
          : 'transparent',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon || '📁'}</span>
      <span style={{ flex: 1, color: isTarget ? '#7cb3ff' : 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: isTarget ? 600 : 400 }}>
        {label}
      </span>
      {count !== undefined && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{count}</span>}
      {!isTarget && (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8">
          <path d="M6 3l5 5-5 5"/>
        </svg>
      )}
    </div>
  );
}
