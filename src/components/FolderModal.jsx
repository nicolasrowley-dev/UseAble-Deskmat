// ─── Folder Browser Modal ───
// Opens a folder's contents in an overlay without changing the desktop.
// Supports internal navigation into sub-folders.

import { useState, useEffect } from 'react';
import { getFileIcon } from './FileIcon';

export function FolderModal({ initialFolderId, initialFolderName, files, onLoadFolder, onOpenFile, onClose }) {
  // Navigation stack within the modal: [{id, name}]
  const [stack, setStack] = useState([{ id: initialFolderId, name: initialFolderName }]);
  const [loading, setLoading] = useState(false);

  const current = stack[stack.length - 1];

  // Load files whenever we navigate to a new folder
  useEffect(() => {
    setLoading(true);
    Promise.resolve(onLoadFolder(current.id)).finally(() => setLoading(false));
  }, [current.id]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const currentFiles = files
    .filter(f => f.parentId === current.id)
    .sort((a, b) => {
      // Folders first, then alphabetical
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

  const handleItemClick = (file) => {
    if (file.type === 'folder') {
      setStack(prev => [...prev, { id: file.id, name: file.name }]);
    } else {
      onOpenFile(file);
    }
  };

  const handleBack = () => {
    if (stack.length > 1) setStack(prev => prev.slice(0, -1));
    else onClose();
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 5000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 92vw)',
          maxHeight: '80vh',
          background: 'rgba(20,20,32,0.97)',
          backdropFilter: 'blur(32px)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Back button */}
          <button
            onClick={handleBack}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: 'none', background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}
          >
            ←
          </button>

          {/* Breadcrumb */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 4,
            overflow: 'hidden', minWidth: 0,
          }}>
            {stack.map((s, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>›</span>}
                <span
                  onClick={i < stack.length - 1 ? () => setStack(prev => prev.slice(0, i + 1)) : undefined}
                  style={{
                    color: i === stack.length - 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                    fontSize: 14, fontWeight: i === stack.length - 1 ? 600 : 400,
                    cursor: i < stack.length - 1 ? 'pointer' : 'default',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {s.name}
                </span>
              </span>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 7,
              border: 'none', background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── File list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {loading && currentFiles.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              Loading…
            </div>
          ) : currentFiles.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              This folder is empty
            </div>
          ) : (
            currentFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                onClick={() => handleItemClick(file)}
                formatDate={formatDate}
                formatSize={formatSize}
              />
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.25)',
          fontSize: 11,
          flexShrink: 0,
        }}>
          {currentFiles.length} item{currentFiles.length !== 1 ? 's' : ''}
          {loading && ' · Loading…'}
        </div>
      </div>
    </div>
  );
}

function FileRow({ file, onClick, formatDate, formatSize }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        background: hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getFileIcon(file.type, 28)}
      </div>

      {/* Name */}
      <div style={{
        flex: 1, minWidth: 0,
        color: 'rgba(255,255,255,0.88)', fontSize: 14,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {file.name}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {file.modified && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            {formatDate(file.modified)}
          </span>
        )}
        {file.size && (
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, minWidth: 48, textAlign: 'right' }}>
            {formatSize(file.size)}
          </span>
        )}
        {file.type === 'folder' && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>›</span>
        )}
      </div>
    </div>
  );
}
