// ─── Folder Browser Modal ───
// Opens a folder's contents in an overlay without changing the desktop.
// Supports internal navigation, breadcrumbs, and a full right-click context menu.

import { useState, useEffect, useRef } from 'react';
import { getFileIcon } from './FileIcon';
import { ContextMenu } from './ContextMenu';
import {
  getOpenUrl,
  createFolder,
  createDocument, createSpreadsheet, createPresentation, createTextFile,
} from '../api/drive';

export function FolderModal({
  initialFolderId,
  initialFolderName,
  files,
  onLoadFolder,
  onOpenFile,
  onClose,
  // Operation callbacks — called from the in-modal context menu
  onRename,       // (file) — open rename dialog
  onTrash,        // (ids[]) — delete items
  onMove,         // (ids[]) — open folder picker in move mode
  onCopy,         // (ids[]) — open folder picker in copy mode
  onDuplicate,    // (ids[]) — duplicate items (returns promise)
  onFileCreated,  // (file) — a new file / folder was created inside this folder
  onShowToast,    // (msg)
}) {
  const [stack, setStack]           = useState([{ id: initialFolderId, name: initialFolderName }]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState(new Set());   // selected file ids
  const [contextMenu, setContextMenu] = useState(null);      // {x, y, items}
  const containerRef                = useRef(null);

  const current = stack[stack.length - 1];

  // Load files whenever we navigate to a new folder
  useEffect(() => {
    setLoading(true);
    Promise.resolve(onLoadFolder(current.id)).finally(() => setLoading(false));
  }, [current.id]);

  // Close context menu + clear selection on Escape; close modal on Escape if no menu
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, contextMenu]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const h = () => setContextMenu(null);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [contextMenu]);

  const currentFiles = files
    .filter(f => f.parentId === current.id)
    .sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

  const handleItemClick = (file) => {
    setSelected(new Set([file.id]));
    if (file.type === 'folder') {
      setStack(prev => [...prev, { id: file.id, name: file.name }]);
    } else {
      onOpenFile(file);
    }
  };

  const handleBack = () => {
    setContextMenu(null);
    setSelected(new Set());
    if (stack.length > 1) setStack(prev => prev.slice(0, -1));
    else onClose();
  };

  // ── Context menu builders ─────────────────────────────────────────────────

  const openContextMenu = (e, items) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const buildFileMenu = (file) => {
    const sids  = selected.size > 1 && selected.has(file.id) ? selected : new Set([file.id]);
    const ids   = [...sids];
    const count = ids.length;
    const multi = count > 1;

    const items = [];

    // Open
    items.push({
      label: file.type === 'folder' ? 'Open folder' : 'Open',
      icon: file.type === 'folder' ? '📂' : '↗',
      onClick: () => {
        setContextMenu(null);
        if (file.type === 'folder') {
          setStack(prev => [...prev, { id: file.id, name: file.name }]);
          onLoadFolder(file.id);
        } else {
          window.open(getOpenUrl(file), '_blank');
        }
      },
    });

    items.push({ type: 'divider' });

    // Rename (single only)
    items.push({
      label: 'Rename', icon: '✏️',
      disabled: multi,
      onClick: () => { setContextMenu(null); if (onRename) onRename(file); },
    });

    // Duplicate
    items.push({
      label: multi ? `Duplicate ${count} items` : 'Duplicate', icon: '📋',
      onClick: async () => {
        setContextMenu(null);
        if (onDuplicate) await onDuplicate(ids);
      },
    });

    items.push({ type: 'divider' });

    // Copy to / Move to
    items.push({
      label: 'Copy to…', icon: '📄',
      onClick: () => { setContextMenu(null); if (onCopy) onCopy(ids); },
    });
    items.push({
      label: 'Move to…', icon: '📁',
      onClick: () => { setContextMenu(null); if (onMove) onMove(ids); },
    });

    items.push({ type: 'divider' });

    // Get Drive link (single only)
    if (!multi) {
      items.push({
        label: 'Get Drive link', icon: '🔗',
        onClick: () => {
          const url = getOpenUrl(file);
          navigator.clipboard?.writeText(url)
            .then(() => onShowToast?.('Link copied'))
            .catch(() => onShowToast?.(url));
          setContextMenu(null);
        },
      });
    }

    // Delete
    items.push({
      label: count > 1 ? `Delete ${count} items` : 'Delete', icon: '🗑️',
      onClick: () => {
        setContextMenu(null);
        setSelected(new Set());
        if (onTrash) onTrash(ids);
      },
    });

    return items;
  };

  const buildFolderAreaMenu = () => {
    const folderId = current.id;
    const items = [];

    items.push({
      label: 'New folder here', icon: '📁',
      onClick: async () => {
        setContextMenu(null);
        try {
          const f = await createFolder('New Folder', folderId);
          if (f) {
            onFileCreated?.(f);
            onLoadFolder(folderId); // refresh
            if (onRename) onRename(f);
          }
        } catch { onShowToast?.('Could not create folder'); }
      },
    });

    items.push({
      type: 'submenu', label: 'New file here', icon: '📄',
      children: [
        {
          label: 'Google Doc', icon: '📝',
          onClick: async () => {
            setContextMenu(null);
            try {
              const f = await createDocument('Untitled Document', folderId);
              if (f) { onFileCreated?.(f); onLoadFolder(folderId); if (onRename) onRename(f); }
            } catch { onShowToast?.('Could not create document'); }
          },
        },
        {
          label: 'Google Sheet', icon: '📊',
          onClick: async () => {
            setContextMenu(null);
            try {
              const f = await createSpreadsheet('Untitled Spreadsheet', folderId);
              if (f) { onFileCreated?.(f); onLoadFolder(folderId); if (onRename) onRename(f); }
            } catch { onShowToast?.('Could not create spreadsheet'); }
          },
        },
        {
          label: 'Google Slides', icon: '📽️',
          onClick: async () => {
            setContextMenu(null);
            try {
              const f = await createPresentation('Untitled Presentation', folderId);
              if (f) { onFileCreated?.(f); onLoadFolder(folderId); if (onRename) onRename(f); }
            } catch { onShowToast?.('Could not create presentation'); }
          },
        },
        { type: 'divider' },
        {
          label: 'Text file (.txt)', icon: '📃',
          onClick: async () => {
            setContextMenu(null);
            try {
              const f = await createTextFile('Untitled.txt', folderId);
              if (f) { onFileCreated?.(f); onLoadFolder(folderId); if (onRename) onRename(f); }
            } catch { onShowToast?.('Could not create file'); }
          },
        },
      ],
    });

    return items;
  };

  const handleFileContextMenu = (e, file) => {
    if (!selected.has(file.id)) setSelected(new Set([file.id]));
    openContextMenu(e, buildFileMenu(file));
  };

  const handleContainerContextMenu = (e) => {
    // Only trigger on the list background, not on a row
    if (e.target !== e.currentTarget && e.target.closest('[data-filerow]')) return;
    openContextMenu(e, buildFolderAreaMenu());
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDate = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); } }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 5000,
      }}
    >
      <div
        ref={containerRef}
        onClick={(e) => { e.stopPropagation(); setContextMenu(null); setSelected(new Set()); }}
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', minWidth: 0 }}>
            {stack.map((s, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                {i > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>›</span>}
                <span
                  onClick={i < stack.length - 1 ? () => { setStack(prev => prev.slice(0, i + 1)); setSelected(new Set()); } : undefined}
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
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}
          onContextMenu={handleContainerContextMenu}
        >
          {loading && currentFiles.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
              Loading…
            </div>
          ) : currentFiles.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              This folder is empty — right-click to create a file
            </div>
          ) : (
            currentFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                isSelected={selected.has(file.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (e.ctrlKey || e.metaKey) {
                    setSelected(prev => {
                      const n = new Set(prev);
                      n.has(file.id) ? n.delete(file.id) : n.add(file.id);
                      return n;
                    });
                  } else {
                    handleItemClick(file);
                  }
                }}
                onContextMenu={(e) => { e.stopPropagation(); handleFileContextMenu(e, file); }}
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
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>
            {currentFiles.length} item{currentFiles.length !== 1 ? 's' : ''}
            {loading && ' · Loading…'}
          </span>
          {selected.size > 0 && (
            <span style={{ color: 'rgba(100,160,255,0.6)' }}>
              {selected.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Context menu — rendered outside the modal card so it isn't clipped */}
      {contextMenu && (
        <div onMouseDown={e => e.stopPropagation()}>
          <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} />
        </div>
      )}
    </div>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────

function FileRow({ file, isSelected, onClick, onContextMenu, formatDate, formatSize }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      data-filerow="true"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px',
        background: isSelected
          ? 'rgba(100,160,255,0.18)'
          : hover ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: isSelected ? '1px solid rgba(100,160,255,0.3)' : '1px solid transparent',
        borderRadius: 6,
        margin: '0 8px',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      <div style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getFileIcon(file.type, 28)}
      </div>

      <div style={{
        flex: 1, minWidth: 0,
        color: 'rgba(255,255,255,0.88)', fontSize: 14,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {file.name}
      </div>

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
