// ─── UseAble Deskmat — Main Application ───
// Spatial file manager for Google Drive.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initAuth, signIn, signOut, isSignedIn } from './auth/google';
import {
  listFiles, renameFile, trashFile, moveFile, copyFile,
  createFolder, createDocument, createSpreadsheet, createPresentation,
  getOpenUrl, countChildren,
} from './api/drive';
import { configSync } from './hooks/useConfigSync';
import { getFileIcon } from './components/FileIcon';
import { Fence } from './components/Fence';
import { ContextMenu } from './components/ContextMenu';
import { Toast, SyncIndicator, RenameDialog, WallpaperDialog, WALLPAPERS } from './components/Dialogs';
import { FolderPickerDialog } from './components/FolderPicker';
import { FolderModal } from './components/FolderModal';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRID_SIZE = 100;
const GRID_ORIGIN_X = 10;   // left margin — must match getInitialPositions
const GRID_ORIGIN_Y = 10;   // top margin — must match getInitialPositions
const ICON_W = 90;
const ICON_H = 100;
const LONG_PRESS_MS = 500;
const TOUCH_MOVE_THRESHOLD = 8;

let fenceIdCounter = Date.now();

// ─── Utilities ───────────────────────────────────────────────────────────────

const snapToGrid = (x, y) => ({
  x: GRID_ORIGIN_X + Math.round((x - GRID_ORIGIN_X) / GRID_SIZE) * GRID_SIZE,
  y: GRID_ORIGIN_Y + Math.round((y - GRID_ORIGIN_Y) / GRID_SIZE) * GRID_SIZE,
});

function getClientPos(e) {
  if (e.touches?.length > 0)        return { x: e.touches[0].clientX,        y: e.touches[0].clientY };
  if (e.changedTouches?.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// Arrange files on the desktop, respecting fence membership
function getAutoArrangePositions(sortedFiles, fences) {
  const newPositions = {};
  const allFenceMembers = new Set(fences.flatMap(f => f.members || []));

  // Arrange fence members within their respective fences
  for (const fence of fences) {
    const members = (fence.members || [])
      .map(id => sortedFiles.find(f => f.id === id))
      .filter(Boolean);
    const innerCols = Math.max(1, Math.floor((fence.w - 20) / GRID_SIZE));
    members.forEach((file, i) => {
      newPositions[file.id] = {
        x: fence.x + 10 + (i % innerCols) * GRID_SIZE,
        y: fence.y + 34 + Math.floor(i / innerCols) * GRID_SIZE, // 34px = fence title bar
      };
    });
  }

  // Arrange non-fence files on the desktop (skipping fence areas)
  const desktopFiles = sortedFiles.filter(f => !allFenceMembers.has(f.id));
  const cols = Math.max(1, Math.floor((window.innerWidth - GRID_ORIGIN_X * 2) / GRID_SIZE));
  const occupied = new Set(Object.values(newPositions).map(p => `${p.x},${p.y}`));
  let slot = 0;

  desktopFiles.forEach(file => {
    let x, y;
    do {
      x = GRID_ORIGIN_X + (slot % cols) * GRID_SIZE;
      y = GRID_ORIGIN_Y + Math.floor(slot / cols) * GRID_SIZE;
      slot++;
    } while (
      occupied.has(`${x},${y}`) ||
      fences.some(f => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h)
    );
    newPositions[file.id] = { x, y };
    occupied.add(`${x},${y}`);
  });

  return newPositions;
}

// Normalise positions loaded from config: snap all to grid
function normalisePositions(positions) {
  const out = {};
  for (const [id, pos] of Object.entries(positions || {})) {
    out[id] = snapToGrid(pos.x ?? GRID_ORIGIN_X, pos.y ?? GRID_ORIGIN_Y);
  }
  return out;
}

// Sort a file array by key
function sortFiles(files, sortBy) {
  if (sortBy === 'manual') return files;
  return [...files].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'type') return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    if (sortBy === 'date') return new Date(b.modified || 0) - new Date(a.modified || 0);
    return 0;
  });
}

// ─── Settings Dialog ──────────────────────────────────────────────────────────

function SettingsDialog({ rootFolderId, rootFolderName, onChangeRoot, onClearRoot, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(26,26,38,0.97)', backdropFilter: 'blur(24px)',
          borderRadius: 16, padding: 28, width: 400,
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 24 }}>Settings</div>

        {/* Desktop root folder */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Desktop Folder
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>📁</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rootFolderName || 'My Drive (root)'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                Files in this folder appear on the desktop
              </div>
            </div>
            <button
              onClick={onChangeRoot}
              style={{
                padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer', fontSize: 12, flexShrink: 0,
              }}
            >
              Change…
            </button>
          </div>
          {rootFolderId && (
            <button
              onClick={onClearRoot}
              style={{
                marginTop: 8, width: '100%', padding: '8px', borderRadius: 7,
                border: '1px solid rgba(255,100,100,0.2)', background: 'transparent',
                color: 'rgba(255,120,120,0.7)', cursor: 'pointer', fontSize: 12,
              }}
            >
              Reset to My Drive root
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13,
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onSignIn, isLoading }) {
  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #1a472a 0%, #2d5a27 20%, #4a7c3f 40%, #6b9b5e 60%, #89b77a 80%, #a8d4a0 100%)',
      fontFamily: "'Segoe UI', 'Noto Sans', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'rgba(10,20,15,0.65)', backdropFilter: 'blur(32px)',
        borderRadius: 20, padding: '48px 56px', textAlign: 'center', maxWidth: 400,
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 24px',
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 32 32" width="36" height="36" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
            <rect x="2" y="8" width="28" height="20" rx="3"/>
            <path d="M2 14h28"/>
            <path d="M8 4h8l4 4H8z" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.9)"/>
          </svg>
        </div>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.5px' }}>
          UseAble Deskmat
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: '0 0 36px', lineHeight: 1.5 }}>
          Your Google Drive files — arranged exactly where you want them.
        </p>
        <button
          onClick={onSignIn}
          disabled={isLoading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            width: '100%', padding: '14px 24px', borderRadius: 12,
            background: isLoading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
            color: '#1a472a', border: 'none', cursor: isLoading ? 'default' : 'pointer',
            fontSize: 15, fontWeight: 700, transition: 'all 0.2s',
          }}
        >
          {isLoading ? (
            <>
              <span style={{ fontSize: 18, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Connecting…</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#FBBC05" d="M24 44c5.2 0 9.8-1.9 13.3-5l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.4 36.1 16.2 44 24 44z"/>
                <path fill="#EA4335" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l.1-.1 6.2 5.2c-.4.4 6.6-4.8 6.6-15-.1-1.2-.2-2.4-.4-3.4z"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 20, lineHeight: 1.5 }}>
          We only access files in your Drive and a private config file for your layout.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Main Desktop App ─────────────────────────────────────────────────────────

export default function App() {
  // ── Auth & loading ───────────────────────────────────────────────────────
  const [isLoading, setIsLoading]           = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError]           = useState(null);

  // ── File tree ────────────────────────────────────────────────────────────
  // All loaded Drive files across all visited folders
  const [files, setFiles]                   = useState([]);
  const [loadedFolders, setLoadedFolders]   = useState(new Set());
  const [filesLoading, setFilesLoading]     = useState(false);
  const [folderCounts, setFolderCounts]     = useState({});  // folderId → child count

  // ── Desktop root folder ──────────────────────────────────────────────────
  // null = Drive root; set to a specific folder ID via Settings
  const [rootFolderId, setRootFolderId]     = useState(null);
  const [rootFolderName, setRootFolderName] = useState('');

  // ── Layout (persisted via configSync) ────────────────────────────────────
  const [positions, setPositions]           = useState({});
  const [fences, setFences]                 = useState([]);
  const [wallpaper, setWallpaper]           = useState('meadow');
  const [customWallpaper, setCustomWallpaper] = useState('');
  const [sortBy, setSortBy]                 = useState('manual'); // 'manual' | 'name' | 'type' | 'date'

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const [dragging, setDragging]             = useState(null);
  const [dragOffset, setDragOffset]         = useState({ x: 0, y: 0 });
  const [selected, setSelected]             = useState(new Set());
  const [dragPreview, setDragPreview]       = useState(null);
  const [dropTarget, setDropTarget]         = useState(null);
  const [resizing, setResizing]             = useState(null);

  // ── Rubber-band selection ─────────────────────────────────────────────────
  const [selectionBox, setSelectionBox]     = useState(null); // {startX,startY,endX,endY}

  // ── UI state ─────────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu]       = useState(null);
  const [showWallpaperDialog, setShowWallpaperDialog] = useState(false);
  const [renameTarget, setRenameTarget]     = useState(null);
  const [renameFenceTarget, setRenameFenceTarget] = useState(null);
  const [toast, setToast]                   = useState(null);
  const [folderPicker, setFolderPicker]     = useState(null);
  const [syncStatus, setSyncStatus]         = useState('idle');
  const [folderModal, setFolderModal]       = useState(null); // {folderId, name}
  const [showSettings, setShowSettings]     = useState(false);
  const [settingsPickingRoot, setSettingsPickingRoot] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const canvasRef          = useRef(null);
  const longPressTimer     = useRef(null);
  const touchStartPos      = useRef(null);
  const touchStartedDrag   = useRef(false);
  const countFetchingRef   = useRef(new Set());
  const positionsRef       = useRef(positions);
  const visibleFilesRef    = useRef([]);
  const selectionBoxRef    = useRef(null);

  // Desktop root = rootFolderId when set, else Drive root (parentId null for root files)
  // Drive API uses 'root' as folderId; normaliseFile maps 'root' parentId → null
  const desktopParentId = rootFolderId ?? null;
  const visibleFiles = files.filter(f => f.parentId === desktopParentId);

  // Sorted visible files (used for auto-arrange and listing order)
  const sortedVisibleFiles = useMemo(() => sortFiles(visibleFiles, sortBy), [visibleFiles, sortBy]);

  // Keep refs up-to-date for use in event handlers without stale closures
  positionsRef.current    = positions;
  visibleFilesRef.current = visibleFiles;
  selectionBoxRef.current = selectionBox;

  const showToast = (msg) => setToast(msg);

  // ─── Initialisation ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = configSync.onStatus(setSyncStatus);
    return unsub;
  }, []);

  useEffect(() => {
    initAuth().then(async () => {
      if (isSignedIn()) {
        setIsAuthenticated(true);
        configSync.enableDrive();
        const config = await configSync.load();
        applyConfig(config);
        await loadFolderFiles(config.rootFolderId ?? null);
      }
      setIsLoading(false);
    });
  }, []);

  // Apply a loaded config object to all state
  function applyConfig(config) {
    setPositions(normalisePositions(config.positions || {}));
    setFences((config.fences || []).map(f => ({ members: [], ...f })));
    setWallpaper(config.wallpaper || 'meadow');
    setCustomWallpaper(config.customWallpaper || '');
    setSortBy(config.sortBy || 'manual');
    setRootFolderId(config.rootFolderId ?? null);
    setRootFolderName(config.rootFolderName ?? '');
  }

  // ─── Drive data loading ─────────────────────────────────────────────────────

  const loadFolderFiles = useCallback(async (folderId) => {
    const key = folderId ?? 'root';
    if (loadedFolders.has(key)) return;

    setFilesLoading(true);
    try {
      const driveFiles = await listFiles(folderId === null ? 'root' : folderId);
      setFiles(prev => {
        const filtered = prev.filter(f => f.parentId !== (folderId ?? null));
        return [...filtered, ...driveFiles];
      });
      setLoadedFolders(prev => new Set([...prev, key]));
    } catch (e) {
      console.error('[App] Failed to load folder:', e);
      showToast('Could not load files — check your connection');
    } finally {
      setFilesLoading(false);
    }
  }, [loadedFolders]);

  // ─── Config persistence ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthenticated) return;
    configSync.save({ positions, fences, wallpaper, customWallpaper, sortBy, rootFolderId, rootFolderName });
  }, [positions, fences, wallpaper, customWallpaper, sortBy, rootFolderId, rootFolderName, isAuthenticated]);

  // Assign grid positions to any newly visible files that don't have one yet
  useEffect(() => {
    const missing = visibleFiles.filter(f => !positions[f.id]);
    if (missing.length === 0) return;
    const allFenceMembers = new Set(fences.flatMap(f => f.members || []));
    const occupied = new Set(
      visibleFiles.filter(f => positions[f.id]).map(f => `${positions[f.id].x},${positions[f.id].y}`)
    );
    const cols = Math.max(1, Math.floor((window.innerWidth - GRID_ORIGIN_X * 2) / GRID_SIZE));
    let slot = 0;
    const np = {};
    missing.forEach(f => {
      if (allFenceMembers.has(f.id)) {
        // Will be placed by auto-arrange inside a fence; put off-screen for now
        np[f.id] = { x: -GRID_SIZE, y: -GRID_SIZE };
        return;
      }
      let x, y;
      do {
        x = GRID_ORIGIN_X + (slot % cols) * GRID_SIZE;
        y = GRID_ORIGIN_Y + Math.floor(slot / cols) * GRID_SIZE;
        slot++;
      } while (
        occupied.has(`${x},${y}`) ||
        fences.some(fence => x >= fence.x && x < fence.x + fence.w && y >= fence.y && y < fence.y + fence.h)
      );
      np[f.id] = { x, y };
      occupied.add(`${x},${y}`);
    });
    setPositions(prev => ({ ...prev, ...np }));
  }, [desktopParentId, visibleFiles.length]);

  // Background folder child-count fetching for unloaded folders
  useEffect(() => {
    if (!isAuthenticated) return;
    const folderFiles = visibleFiles.filter(f => f.type === 'folder');
    folderFiles.forEach(f => {
      const key = f.id;
      if (loadedFolders.has(key) || folderCounts[key] !== undefined || countFetchingRef.current.has(key)) return;
      countFetchingRef.current.add(key);
      countChildren(f.id).then(count => {
        if (count !== null) setFolderCounts(prev => ({ ...prev, [f.id]: count }));
        countFetchingRef.current.delete(key);
      }).catch(() => countFetchingRef.current.delete(key));
    });
  }, [visibleFiles, loadedFolders, folderCounts, isAuthenticated]);

  // Close context menu on any click
  useEffect(() => {
    const h = () => setContextMenu(null);
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  // Prevent default touch scroll/zoom while dragging
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e) => { if (dragging) e.preventDefault(); };
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, [dragging]);

  // ─── Auth handlers ─────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      await signIn();
      setIsAuthenticated(true);
      configSync.enableDrive();
      const config = await configSync.load();
      applyConfig(config);
      await loadFolderFiles(config.rootFolderId ?? null);
    } catch (e) {
      console.error('[Auth] Sign in failed:', e);
      setAuthError('Sign in was cancelled or failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    configSync.disableDrive();
    setIsAuthenticated(false);
    setFiles([]);
    setLoadedFolders(new Set());
    setPositions({});
    setFences([]);
    setFolderCounts({});
  };

  // ─── Background ────────────────────────────────────────────────────────────

  const getBackground = () => {
    if (wallpaper === '__custom' && customWallpaper) {
      return { backgroundImage: `url(${customWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    return { background: WALLPAPERS[wallpaper]?.bg || WALLPAPERS.meadow.bg };
  };

  // ─── Desktop root folder change ────────────────────────────────────────────

  const handleRootFolderSelect = async (targetId) => {
    setSettingsPickingRoot(false);
    if (targetId === null || targetId === undefined) return; // cancelled
    const folder = files.find(f => f.id === targetId);
    const name = folder?.name || 'Selected Folder';
    setRootFolderId(targetId);
    setRootFolderName(name);
    setPositions({});
    setFences([]);
    setFolderCounts({});
    countFetchingRef.current.clear();
    setFiles([]);
    setLoadedFolders(new Set());
    await loadFolderFiles(targetId);
  };

  const handleClearRoot = () => {
    setRootFolderId(null);
    setRootFolderName('');
    setPositions({});
    setFences([]);
    setFolderCounts({});
    countFetchingRef.current.clear();
    setFiles([]);
    setLoadedFolders(new Set());
    loadFolderFiles(null);
  };

  // ─── Drag & drop ───────────────────────────────────────────────────────────

  const startDragFile = useCallback((clientX, clientY, fileId) => {
    const pos = positionsRef.current[fileId];
    if (!pos) return;
    if (!selected.has(fileId)) setSelected(new Set([fileId]));
    setDragging({ type: 'file', id: fileId });
    setDragOffset({ x: clientX - pos.x, y: clientY - pos.y });
    setDragPreview(null);
    setDropTarget(null);
    setSelectionBox(null);
  }, [selected]);

  const startDragFence = useCallback((clientX, clientY, fenceId) => {
    const fence = fences.find(f => f.id === fenceId);
    if (!fence) return;
    setDragging({ type: 'fence', id: fenceId });
    setDragOffset({ x: clientX - fence.x, y: clientY - fence.y });
    setDragPreview(null);
    setSelectionBox(null);
  }, [fences]);

  // Mouse handlers
  const handleFileMouseDown = useCallback((e, fileId) => {
    e.preventDefault(); e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      setSelected(prev => { const n = new Set(prev); if (n.has(fileId)) n.delete(fileId); else n.add(fileId); return n; });
      return;
    }
    startDragFile(e.clientX, e.clientY, fileId);
  }, [startDragFile]);

  const handleFenceMouseDown = useCallback((e, fenceId) => {
    e.preventDefault(); e.stopPropagation();
    startDragFence(e.clientX, e.clientY, fenceId);
  }, [startDragFence]);

  // Rubber-band: start on empty canvas click
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (dragging) return;
    const { x, y } = getClientPos(e);
    setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
    setSelected(new Set());
  }, [dragging]);

  // Touch handlers
  const handleFileTouchStart = useCallback((e, fileId) => {
    const { x, y } = getClientPos(e);
    touchStartPos.current = { x, y, fileId };
    touchStartedDrag.current = false;
    longPressTimer.current = setTimeout(() => {
      const file = files.find(f => f.id === fileId);
      if (file && !touchStartedDrag.current) {
        if (navigator.vibrate) navigator.vibrate(30);
        handleFileContextMenu({ preventDefault: () => {}, stopPropagation: () => {}, clientX: x, clientY: y }, file);
      }
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  }, [files]);

  const handleFileTouchMove = useCallback((e) => {
    const { x, y } = getClientPos(e);
    const start = touchStartPos.current;
    if (!start) return;
    if (!touchStartedDrag.current) {
      const dist = Math.hypot(x - start.x, y - start.y);
      if (dist > TOUCH_MOVE_THRESHOLD) {
        touchStartedDrag.current = true;
        clearTimeout(longPressTimer.current);
        startDragFile(x, y, start.fileId);
      }
      return;
    }
    if (!dragging) return;
    setDragPreview(snapToGrid(x - dragOffset.x, y - dragOffset.y));
    if (dragging.type === 'file') setDropTarget(findFolderUnderCursor(x, y));
  }, [dragging, dragOffset, startDragFile]);

  const handleFileTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!touchStartedDrag.current && touchStartPos.current) {
      setSelected(new Set([touchStartPos.current.fileId]));
    }
    touchStartPos.current = null;
    if (dragging) handlePointerUp();
  }, [dragging]);

  const handleFenceTouchStart = useCallback((e, fenceId) => {
    const { x, y } = getClientPos(e);
    startDragFence(x, y, fenceId);
  }, [startDragFence]);

  const handleCanvasTouchStart = useCallback((e) => {
    const { x, y } = getClientPos(e);
    touchStartPos.current = { x, y, fileId: null };
    longPressTimer.current = setTimeout(() => {
      if (!touchStartedDrag.current) {
        if (navigator.vibrate) navigator.vibrate(30);
        handleDesktopContextMenu({ preventDefault: () => {}, clientX: x, clientY: y });
      }
    }, LONG_PRESS_MS);
  }, []);

  const handleCanvasTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    touchStartPos.current = null;
  }, []);

  const handleResizeStart = useCallback((e, fenceId) => {
    const fence = fences.find(f => f.id === fenceId);
    if (!fence) return;
    setResizing({ fenceId, startX: e.clientX, startY: e.clientY, startW: fence.w, startH: fence.h });
  }, [fences]);

  const findFolderUnderCursor = useCallback((clientX, clientY) => {
    if (!dragging || dragging.type !== 'file') return null;
    const draggedIds = selected.has(dragging.id) && selected.size > 1 ? selected : new Set([dragging.id]);
    const curPos = positionsRef.current;
    for (const file of visibleFilesRef.current) {
      if (file.type !== 'folder' || draggedIds.has(file.id)) continue;
      const pos = curPos[file.id];
      if (!pos) continue;
      if (clientX >= pos.x && clientX <= pos.x + ICON_W && clientY >= pos.y && clientY <= pos.y + ICON_H) return file.id;
    }
    return null;
  }, [dragging, selected]);

  const handlePointerMove = useCallback((e) => {
    const { x: cx, y: cy } = getClientPos(e);

    if (resizing) {
      const dx = cx - resizing.startX, dy = cy - resizing.startY;
      setFences(prev => prev.map(f =>
        f.id === resizing.fenceId
          ? { ...f, w: Math.max(200, Math.round((resizing.startW + dx) / GRID_SIZE) * GRID_SIZE), h: Math.max(150, Math.round((resizing.startH + dy) / GRID_SIZE) * GRID_SIZE) }
          : f
      ));
      return;
    }

    // Rubber-band selection
    if (selectionBoxRef.current) {
      const box = { ...selectionBoxRef.current, endX: cx, endY: cy };
      setSelectionBox(box);
      const minX = Math.min(box.startX, cx);
      const maxX = Math.max(box.startX, cx);
      const minY = Math.min(box.startY, cy);
      const maxY = Math.max(box.startY, cy);
      const curPos = positionsRef.current;
      const inBox = visibleFilesRef.current.filter(f => {
        const pos = curPos[f.id];
        if (!pos) return false;
        return pos.x + ICON_W > minX && pos.x < maxX && pos.y + ICON_H > minY && pos.y < maxY;
      });
      setSelected(new Set(inBox.map(f => f.id)));
      return;
    }

    if (!dragging) return;
    setDragPreview(snapToGrid(cx - dragOffset.x, cy - dragOffset.y));
    if (dragging.type === 'file') setDropTarget(findFolderUnderCursor(cx, cy));
  }, [dragging, dragOffset, resizing, findFolderUnderCursor]);

  const handlePointerUp = useCallback(async () => {
    // End rubber-band selection
    if (selectionBoxRef.current) {
      setSelectionBox(null);
      return;
    }

    if (resizing) { setResizing(null); return; }

    if (dragging?.type === 'file' && dropTarget) {
      const draggedIds = selected.has(dragging.id) && selected.size > 1 ? [...selected] : [dragging.id];
      const targetFolder = files.find(f => f.id === dropTarget);
      setFiles(prev => prev.map(f => draggedIds.includes(f.id) ? { ...f, parentId: dropTarget } : f));
      setPositions(prev => { const n = { ...prev }; draggedIds.forEach(id => delete n[id]); return n; });
      // Remove dropped files from fence membership
      setFences(prev => prev.map(f => ({ ...f, members: (f.members || []).filter(id => !draggedIds.includes(id)) })));
      showToast(`Moving ${draggedIds.length} ${draggedIds.length === 1 ? 'item' : 'items'} into "${targetFolder?.name}"…`);
      setSelected(new Set()); setDragging(null); setDragPreview(null); setDropTarget(null);
      try {
        await Promise.all(draggedIds.map(id => {
          const f = files.find(x => x.id === id);
          return moveFile(id, dropTarget, f?.parentId ?? null);
        }));
      } catch (e) { showToast('Move failed — please try again'); }
      return;
    }

    if (dragging && dragPreview) {
      if (dragging.type === 'file') {
        const dx = dragPreview.x - positionsRef.current[dragging.id].x;
        const dy = dragPreview.y - positionsRef.current[dragging.id].y;
        const draggedIds = selected.has(dragging.id) && selected.size > 1 ? [...selected] : [dragging.id];

        // Update positions
        setPositions(prev => {
          const n = { ...prev };
          const items = new Set(draggedIds);
          items.forEach(id => { if (n[id]) n[id] = { x: Math.max(0, n[id].x + dx), y: Math.max(0, n[id].y + dy) }; });
          return n;
        });

        // Update fence membership based on new drop position
        const newPos = snapToGrid(
          (positionsRef.current[dragging.id]?.x ?? 0) + dx,
          (positionsRef.current[dragging.id]?.y ?? 0) + dy
        );
        setFences(prev => prev.map(f => {
          let members = [...(f.members || [])].filter(id => !draggedIds.includes(id));
          const insideFence = newPos.x >= f.x && newPos.x < f.x + f.w && newPos.y >= f.y && newPos.y < f.y + f.h;
          if (insideFence) members = [...new Set([...members, ...draggedIds])];
          return { ...f, members };
        }));

      } else if (dragging.type === 'fence') {
        const fence = fences.find(f => f.id === dragging.id);
        if (fence) {
          const dx = dragPreview.x - fence.x, dy = dragPreview.y - fence.y;
          setFences(prev => prev.map(f => f.id === dragging.id ? { ...f, x: dragPreview.x, y: dragPreview.y } : f));
          setPositions(prev => {
            const n = { ...prev };
            const members = new Set(fence.members || []);
            Object.entries(n).forEach(([id, pos]) => {
              // Move all files that are members of this fence
              if (members.has(id)) n[id] = { x: pos.x + dx, y: pos.y + dy };
              // Also move non-member files that happen to be inside the fence bounds (backward compat)
              else if (pos.x >= fence.x && pos.x < fence.x + fence.w && pos.y >= fence.y && pos.y < fence.y + fence.h)
                n[id] = { x: pos.x + dx, y: pos.y + dy };
            });
            return n;
          });
        }
      }
    }
    setDragging(null); setDragPreview(null); setDropTarget(null);
  }, [dragging, dragPreview, positions, selected, fences, resizing, dropTarget, files]);

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('desktop-canvas')) setSelected(new Set());
  };

  // ─── File operations ────────────────────────────────────────────────────────

  const handleDuplicate = async (fileIds) => {
    const newFiles = [], newPositions = {};
    for (const id of fileIds) {
      const orig = files.find(f => f.id === id);
      if (!orig) continue;
      const newName = `${orig.name} (copy)`;
      try {
        const copied = await copyFile(id, newName, orig.parentId);
        if (copied) {
          newFiles.push(copied);
          const op = positions[id];
          if (op) newPositions[copied.id] = { x: op.x + GRID_SIZE, y: op.y + GRID_SIZE };
        }
      } catch (e) { console.warn('[App] Copy failed:', e); }
    }
    if (newFiles.length) {
      setFiles(prev => [...prev, ...newFiles]);
      setPositions(prev => ({ ...prev, ...newPositions }));
    }
    return newFiles.length;
  };

  const handleFolderPickerSelect = async (targetId) => {
    if (!folderPicker) return;
    const { mode, fileIds } = folderPicker;
    const count = fileIds.length;
    const targetName = targetId ? (files.find(f => f.id === targetId)?.name || 'folder') : 'Desktop';

    if (mode === 'move') {
      setFiles(prev => prev.map(f => fileIds.includes(f.id) ? { ...f, parentId: targetId } : f));
      setPositions(prev => { const n = { ...prev }; fileIds.forEach(id => delete n[id]); return n; });
      setFences(prev => prev.map(f => ({ ...f, members: (f.members || []).filter(id => !fileIds.includes(id)) })));
      showToast(`Moving ${count} ${count === 1 ? 'item' : 'items'} to "${targetName}"…`);
      try {
        await Promise.all(fileIds.map(id => {
          const f = files.find(x => x.id === id);
          return moveFile(id, targetId, f?.parentId ?? null);
        }));
      } catch (e) { showToast('Move failed — please try again'); }
    } else {
      showToast(`Copying to "${targetName}"…`);
      const newFiles = [];
      for (const id of fileIds) {
        const orig = files.find(f => f.id === id);
        if (!orig) continue;
        try {
          const copied = await copyFile(id, orig.name, targetId);
          if (copied) newFiles.push(copied);
        } catch (e) { console.warn('[App] Copy failed:', e); }
      }
      if (newFiles.length) setFiles(prev => [...prev, ...newFiles]);
      showToast(`Copied ${newFiles.length} ${newFiles.length === 1 ? 'item' : 'items'}`);
    }
    setSelected(new Set());
    setFolderPicker(null);
  };

  // Open folder in modal (replaces navigateIntoFolder for double-click/context)
  const openFolderModal = useCallback((file) => {
    loadFolderFiles(file.id);
    setFolderModal({ folderId: file.id, name: file.name });
  }, [loadFolderFiles]);

  // ─── New file creation ──────────────────────────────────────────────────────

  const handleCreateFile = async (createFn, defaultName, pos) => {
    setContextMenu(null);
    try {
      const newFile = await createFn(defaultName, desktopParentId);
      if (newFile) {
        setFiles(prev => [...prev, newFile]);
        setPositions(prev => ({ ...prev, [newFile.id]: pos }));
        setTimeout(() => setRenameTarget(newFile), 50);
      }
    } catch (e) { showToast('Could not create file'); }
  };

  // ─── Context menus ─────────────────────────────────────────────────────────

  const handleFileContextMenu = useCallback((e, file) => {
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (!selected.has(file.id)) setSelected(new Set([file.id]));
    const sids = selected.size > 1 && selected.has(file.id) ? selected : new Set([file.id]);
    const count = sids.size;
    const multi = count > 1;
    const idArr = [...sids];

    const items = [
      {
        label: file.type === 'folder' ? 'Open folder' : 'Open', icon: '📂',
        onClick: () => {
          if (file.type === 'folder') openFolderModal(file);
          else window.open(getOpenUrl(file), '_blank');
          setContextMenu(null);
        },
      },
    ];

    if (file.type === 'folder' && !multi) {
      items.push({
        label: 'New folder inside…', icon: '📁',
        onClick: async () => {
          setContextMenu(null);
          try {
            const newFolder = await createFolder('New Folder', file.id);
            if (newFolder) {
              setFiles(prev => [...prev, newFolder]);
              showToast(`Created folder inside "${file.name}"`);
            }
          } catch (e) { showToast('Could not create folder'); }
        },
      });
    }

    // Fence membership management
    const fenceContaining = fences.find(f => (f.members || []).includes(file.id));
    if (fenceContaining && !multi) {
      items.push({
        label: `Remove from "${fenceContaining.name}"`, icon: '⬜',
        onClick: () => {
          setFences(prev => prev.map(f => f.id === fenceContaining.id ? { ...f, members: (f.members || []).filter(id => id !== file.id) } : f));
          setContextMenu(null);
        },
      });
    }

    items.push({ type: 'divider' });
    items.push({
      label: 'Rename', icon: '✏️',
      onClick: () => { setRenameTarget(file); setContextMenu(null); },
      disabled: multi,
    });
    items.push({
      label: multi ? `Duplicate ${count} items` : 'Duplicate', icon: '📋',
      onClick: async () => {
        setContextMenu(null);
        const n = await handleDuplicate(idArr);
        showToast(`Duplicated ${n} item${n === 1 ? '' : 's'}`);
      },
    });
    items.push({ type: 'divider' });
    items.push({
      label: 'Copy to…', icon: '📄',
      onClick: () => { setFolderPicker({ mode: 'copy', fileIds: idArr }); setContextMenu(null); },
    });
    items.push({
      label: 'Move to…', icon: '📁',
      onClick: () => { setFolderPicker({ mode: 'move', fileIds: idArr }); setContextMenu(null); },
    });
    items.push({ type: 'divider' });
    items.push({
      label: 'Get Drive link', icon: '🔗',
      onClick: () => {
        const url = getOpenUrl(file);
        navigator.clipboard?.writeText(url).then(() => showToast('Link copied')).catch(() => showToast(url));
        setContextMenu(null);
      },
    });
    items.push({
      label: 'File info', icon: 'ℹ️',
      onClick: () => {
        const childCount = file.type === 'folder'
          ? (loadedFolders.has(file.id) ? files.filter(f => f.parentId === file.id).length : (folderCounts[file.id] ?? '?'))
          : null;
        const parts = [file.name];
        if (file.modified) parts.push(new Date(file.modified).toLocaleDateString());
        if (childCount !== null) parts.push(`${childCount} items`);
        showToast(parts.join(' · '));
        setContextMenu(null);
      },
    });
    items.push({ type: 'divider' });
    items.push({
      label: count > 1 ? `Delete ${count} items` : 'Delete', icon: '🗑️',
      onClick: async () => {
        setFiles(prev => prev.filter(f => !idArr.includes(f.id)));
        setPositions(prev => { const n = { ...prev }; idArr.forEach(id => delete n[id]); return n; });
        setFences(prev => prev.map(f => ({ ...f, members: (f.members || []).filter(id => !idArr.includes(id)) })));
        setSelected(new Set()); showToast('Deleted'); setContextMenu(null);
        try { await Promise.all(idArr.map(id => trashFile(id))); }
        catch (e) { showToast('Delete failed — please try again'); }
      },
    });

    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [selected, files, fences, folderCounts, loadedFolders, openFolderModal]);

  const handleDesktopContextMenu = useCallback((e) => {
    e.preventDefault();
    const cp = snapToGrid(e.clientX, e.clientY);

    setContextMenu({ x: e.clientX, y: e.clientY, items: [
      {
        label: 'New folder', icon: '📁',
        onClick: async () => handleCreateFile(createFolder, 'New Folder', cp),
      },
      { type: 'label', text: 'New file' },
      {
        label: 'Google Doc', icon: '📝',
        onClick: () => handleCreateFile(createDocument, 'Untitled Document', cp),
      },
      {
        label: 'Google Sheet', icon: '📊',
        onClick: () => handleCreateFile(createSpreadsheet, 'Untitled Spreadsheet', cp),
      },
      {
        label: 'Google Slides', icon: '📽️',
        onClick: () => handleCreateFile(createPresentation, 'Untitled Presentation', cp),
      },
      { type: 'divider' },
      {
        label: 'Auto-arrange', icon: '⊞',
        onClick: () => {
          setPositions(p => ({ ...p, ...getAutoArrangePositions(sortedVisibleFiles, fences) }));
          setContextMenu(null);
        },
      },
      { type: 'label', text: 'Sort by' },
      {
        label: `Name ${sortBy === 'name' ? '✓' : ''}`, icon: '🔤',
        onClick: () => {
          const sorted = sortFiles(visibleFiles, 'name');
          setSortBy('name');
          setPositions(p => ({ ...p, ...getAutoArrangePositions(sorted, fences) }));
          setContextMenu(null);
        },
      },
      {
        label: `Type ${sortBy === 'type' ? '✓' : ''}`, icon: '📂',
        onClick: () => {
          const sorted = sortFiles(visibleFiles, 'type');
          setSortBy('type');
          setPositions(p => ({ ...p, ...getAutoArrangePositions(sorted, fences) }));
          setContextMenu(null);
        },
      },
      {
        label: `Date modified ${sortBy === 'date' ? '✓' : ''}`, icon: '📅',
        onClick: () => {
          const sorted = sortFiles(visibleFiles, 'date');
          setSortBy('date');
          setPositions(p => ({ ...p, ...getAutoArrangePositions(sorted, fences) }));
          setContextMenu(null);
        },
      },
      {
        label: `Manual ${sortBy === 'manual' ? '✓' : ''}`, icon: '✋',
        onClick: () => { setSortBy('manual'); setContextMenu(null); },
      },
      { type: 'divider' },
      {
        label: 'Create fence', icon: '▢',
        onClick: () => {
          setFences(p => [...p, { id: `fence-${fenceIdCounter++}`, name: 'New Group', x: cp.x, y: cp.y, w: 300, h: 300, rolledUp: false, members: [] }]);
          setContextMenu(null);
        },
      },
      { type: 'divider' },
      {
        label: 'Snap to grid', icon: '⊡',
        onClick: () => {
          setPositions(p => { const n = { ...p }; visibleFiles.forEach(f => { if (n[f.id]) n[f.id] = snapToGrid(n[f.id].x, n[f.id].y); }); return n; });
          setContextMenu(null);
        },
      },
      {
        label: 'Change wallpaper…', icon: '🖼️',
        onClick: () => { setShowWallpaperDialog(true); setContextMenu(null); },
      },
      { type: 'divider' },
      {
        label: 'Settings…', icon: '⚙️',
        onClick: () => { setShowSettings(true); setContextMenu(null); },
      },
      {
        label: 'Sign out', icon: '👤',
        onClick: () => { handleSignOut(); setContextMenu(null); },
      },
    ]});
  }, [visibleFiles, sortedVisibleFiles, fences, sortBy]);

  const handleDoubleClick = (file) => {
    if (file.type === 'folder') { openFolderModal(file); return; }
    window.open(getOpenUrl(file), '_blank');
  };

  const handleRename = async (newName) => {
    if (!renameTarget) return;
    const id = renameTarget.id;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    setRenameTarget(null);
    showToast(`Renamed to "${newName}"`);
    try { await renameFile(id, newName); }
    catch (e) { showToast('Rename failed — please try again'); }
  };

  // ─── Render helpers ─────────────────────────────────────────────────────────

  const getIconPosition = (fileId) => {
    if (dragging?.type === 'file') {
      if (dragging.id === fileId && dragPreview) return dragPreview;
      if (selected.has(fileId) && selected.has(dragging.id) && dragPreview) {
        const dx = dragPreview.x - positions[dragging.id].x, dy = dragPreview.y - positions[dragging.id].y;
        return { x: positions[fileId].x + dx, y: positions[fileId].y + dy };
      }
    }
    if (dragging?.type === 'fence' && dragPreview) {
      const fence = fences.find(f => f.id === dragging.id);
      if (fence) {
        const pos = positions[fileId];
        if (pos && pos.x >= fence.x && pos.x < fence.x + fence.w && pos.y >= fence.y && pos.y < fence.y + fence.h)
          return { x: pos.x + (dragPreview.x - fence.x), y: pos.y + (dragPreview.y - fence.y) };
      }
    }
    return positions[fileId];
  };

  const getFencePosition = (fence) =>
    dragging?.type === 'fence' && dragging.id === fence.id && dragPreview
      ? { ...fence, x: dragPreview.x, y: dragPreview.y }
      : fence;

  // Compute folder badge count
  const getFolderCount = (fileId) => {
    if (loadedFolders.has(fileId)) return files.filter(f => f.parentId === fileId).length;
    if (folderCounts[fileId] !== undefined) return folderCounts[fileId];
    return '?';
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'linear-gradient(160deg, #1a472a 0%, #2d5a27 20%, #4a7c3f 40%, #6b9b5e 60%, #89b77a 80%, #a8d4a0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onSignIn={handleSignIn} isLoading={isLoading} error={authError} />;
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      fontFamily: "'Segoe UI', 'Noto Sans', system-ui, sans-serif",
      userSelect: 'none', position: 'relative', touchAction: 'none',
      ...getBackground(),
    }}>
      {/* Ambient radial highlight */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Files loading spinner */}
      {filesLoading && (
        <div style={{ position: 'fixed', top: 8, right: 16, color: 'rgba(255,255,255,0.5)', fontSize: 12, zIndex: 200 }}>
          Loading files…
        </div>
      )}

      {/* Desktop canvas */}
      <div
        ref={canvasRef}
        className="desktop-canvas"
        onClick={handleCanvasClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={handleFileTouchMove}
        onTouchEnd={() => { handleFileTouchEnd(); handlePointerUp(); }}
        onTouchStart={handleCanvasTouchStart}
        onContextMenu={handleDesktopContextMenu}
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          cursor: dragging ? 'grabbing' : selectionBox ? 'crosshair' : 'default',
          touchAction: 'none',
        }}
      >
        {/* Fences */}
        {fences.map(fence => {
          const df = getFencePosition(fence);
          const memberCount = (fence.members || []).filter(id => visibleFiles.some(f => f.id === id)).length;
          return (
            <Fence
              key={fence.id}
              fence={df}
              fileCount={memberCount}
              onDragStart={handleFenceMouseDown}
              onTouchDragStart={handleFenceTouchStart}
              onToggleRollUp={(id) => setFences(p => p.map(f => f.id === id ? { ...f, rolledUp: !f.rolledUp } : f))}
              onRemoveFence={(id) => setFences(p => p.filter(f => f.id !== id))}
              onRenameFence={(id) => { const f = fences.find(x => x.id === id); if (f) setRenameFenceTarget(f); }}
              onResizeStart={handleResizeStart}
            />
          );
        })}

        {/* File icons */}
        {visibleFiles.map((file) => {
          const pos = getIconPosition(file.id);
          if (!pos) return null;

          const inRolled = fences.some(f =>
            f.rolledUp && pos.x >= f.x && pos.x < f.x + f.w && pos.y >= f.y && pos.y < f.y + f.h
          );
          if (inRolled && !(dragging?.type === 'file' && (dragging.id === file.id || (selected.has(file.id) && selected.has(dragging.id))))) return null;

          const isSel    = selected.has(file.id);
          const isDrag   = dragging?.type === 'file' && dragging.id === file.id;
          const isDrop   = dropTarget === file.id;
          const isMoving = isDrag || (dragging?.type === 'file' && selected.has(file.id) && selected.has(dragging.id));

          return (
            <div
              key={file.id}
              onMouseDown={(e) => handleFileMouseDown(e, file.id)}
              onTouchStart={(e) => { e.stopPropagation(); handleFileTouchStart(e, file.id); }}
              onContextMenu={(e) => handleFileContextMenu(e, file)}
              onDoubleClick={() => handleDoubleClick(file)}
              style={{
                position: 'absolute', left: pos.x, top: pos.y,
                width: ICON_W, height: ICON_H,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                gap: 3, padding: '6px 4px', borderRadius: 8, touchAction: 'none',
                cursor: dragging ? 'grabbing' : 'pointer',
                background: isDrop ? 'rgba(100,220,130,0.35)' : isSel ? 'rgba(100,160,255,0.3)' : 'transparent',
                border: isDrop ? '2px solid rgba(100,220,130,0.8)' : isSel ? '1.5px solid rgba(100,160,255,0.6)' : '1.5px solid transparent',
                opacity: isMoving ? 0.6 : 1,
                transition: isMoving ? 'none' : 'background 0.15s, border 0.15s, transform 0.15s',
                transform: isDrop ? 'scale(1.1)' : 'none',
                zIndex: isDrag ? 1000 : isDrop ? 999 : 3,
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => { if (!isSel && !isDrop && !dragging) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { if (!isSel && !isDrop) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', flexShrink: 0, position: 'relative' }}>
                {getFileIcon(file.type)}
                {file.type === 'folder' && (
                  <div style={{
                    position: 'absolute', top: -4, right: -8,
                    background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)',
                    fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 5px',
                    minWidth: 14, textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)',
                  }}>
                    {getFolderCount(file.id)}
                  </div>
                )}
              </div>
              <div style={{
                color: '#fff', fontSize: 11, lineHeight: '13px', textAlign: 'center',
                maxWidth: ICON_W - 4, overflow: 'hidden', textOverflow: 'ellipsis',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
                textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)',
                fontWeight: 500,
              }}>
                {file.name}
              </div>
            </div>
          );
        })}

        {/* Rubber-band selection box */}
        {selectionBox && Math.abs(selectionBox.endX - selectionBox.startX) > 4 && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
              background: 'rgba(100,160,255,0.1)',
              border: '1.5px solid rgba(100,160,255,0.55)',
              borderRadius: 3,
              pointerEvents: 'none',
              zIndex: 500,
            }}
          />
        )}

        {/* Drop-into-folder tooltip */}
        {dragging?.type === 'file' && dropTarget && (
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(16px)',
            color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13,
            border: '1px solid rgba(100,220,130,0.3)', zIndex: 10001, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>📂</span>
            Drop into "{files.find(f => f.id === dropTarget)?.name}"
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} />}
      {renameTarget && <RenameDialog file={renameTarget} onConfirm={handleRename} onCancel={() => setRenameTarget(null)} />}
      {renameFenceTarget && (
        <RenameDialog
          file={renameFenceTarget}
          onConfirm={(name) => { setFences(p => p.map(f => f.id === renameFenceTarget.id ? { ...f, name } : f)); setRenameFenceTarget(null); }}
          onCancel={() => setRenameFenceTarget(null)}
        />
      )}
      {showWallpaperDialog && (
        <WallpaperDialog
          currentWallpaper={wallpaper}
          currentCustom={customWallpaper}
          onSelect={({ type, value }) => {
            if (type === 'preset') { setWallpaper(value); setCustomWallpaper(''); }
            else { setWallpaper('__custom'); setCustomWallpaper(value); }
            setShowWallpaperDialog(false);
          }}
          onClose={() => setShowWallpaperDialog(false)}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      {/* Folder browser modal */}
      {folderModal && (
        <FolderModal
          initialFolderId={folderModal.folderId}
          initialFolderName={folderModal.name}
          files={files}
          onLoadFolder={loadFolderFiles}
          onOpenFile={(file) => window.open(getOpenUrl(file), '_blank')}
          onClose={() => setFolderModal(null)}
        />
      )}

      {/* Move/copy folder picker */}
      {folderPicker && (
        <FolderPickerDialog
          title={folderPicker.mode === 'move' ? 'Move to…' : 'Copy to…'}
          files={files}
          excludeIds={new Set(folderPicker.fileIds)}
          currentFolderId={desktopParentId}
          onSelect={handleFolderPickerSelect}
          onCancel={() => setFolderPicker(null)}
          onLoadFolder={loadFolderFiles}
        />
      )}

      {/* Settings dialog */}
      {showSettings && (
        <SettingsDialog
          rootFolderId={rootFolderId}
          rootFolderName={rootFolderName}
          onChangeRoot={() => { setShowSettings(false); setSettingsPickingRoot(true); }}
          onClearRoot={() => { handleClearRoot(); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Root folder picker (launched from Settings) */}
      {settingsPickingRoot && (
        <FolderPickerDialog
          title="Choose Desktop Folder"
          files={files}
          excludeIds={new Set()}
          currentFolderId={null}
          onSelect={(targetId) => handleRootFolderSelect(targetId)}
          onCancel={() => setSettingsPickingRoot(false)}
          onLoadFolder={loadFolderFiles}
        />
      )}

      {/* ── Bottom bar ──────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 48,
        background: 'rgba(10,10,20,0.7)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500 }}>
            Deskmat{rootFolderName ? ` · ${rootFolderName}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <SyncIndicator status={syncStatus} />
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            {visibleFiles.length} items{selected.size > 0 ? ` · ${selected.size} selected` : ''}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
              fontSize: 14,
            }}
          >
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
}
