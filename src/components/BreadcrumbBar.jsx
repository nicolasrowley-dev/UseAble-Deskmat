// ─── Breadcrumb Navigation Bar ───
// Shown when inside a subfolder. Displays the full path with clickable segments.

import { useState } from 'react';

export function BreadcrumbBar({ currentFolder, folderHistory, onNavigateBack, onNavigateToBreadcrumb, currentFolderName }) {
  if (currentFolder === null && folderHistory.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 42,
      background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: 6,
      zIndex: 100,
    }}>
      {/* Back button */}
      <div
        onClick={onNavigateBack}
        style={{
          width: 34, height: 34, borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', background: 'rgba(255,255,255,0.06)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8">
          <path d="M10 3L5 8l5 5"/>
        </svg>
      </div>

      {/* Breadcrumb path */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
        <BreadcrumbItem label="Desktop" onClick={() => onNavigateToBreadcrumb(-1)} />

        {folderHistory.map((item, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>›</span>
            <BreadcrumbItem label={item.name || '…'} onClick={() => onNavigateToBreadcrumb(i)} />
          </span>
        ))}

        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>›</span>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, padding: '4px 8px', whiteSpace: 'nowrap' }}>
          {currentFolderName}
        </span>
      </div>
    </div>
  );
}

function BreadcrumbItem({ label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        color: hover ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
        fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 5,
        background: hover ? 'rgba(255,255,255,0.08)' : 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
