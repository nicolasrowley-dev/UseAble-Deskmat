import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config Sync Engine ───
// In production, this talks to Google Drive appDataFolder.
// For the prototype, it uses localStorage but with the same API shape.
const CONFIG_VERSION = 1;
const SYNC_DEBOUNCE_MS = 2000;

class ConfigSync {
  constructor() {
    this._debounceTimer = null;
    this._lastSyncTime = 0;
    this._listeners = new Set();
    this._dirty = false;
  }

  // Load config — in production this checks Drive first, falls back to localStorage
  async load() {
    try {
      // Production: const remote = await driveAppData.get('desktop-config.json');
      // if (remote && remote.timestamp > local.timestamp) return remote;
      const raw = localStorage.getItem("desktop-config");
      if (raw) {
        const config = JSON.parse(raw);
        if (config.version === CONFIG_VERSION) return config;
      }
    } catch (e) { console.warn("Config load failed:", e); }
    return this.getDefaults();
  }

  // Save config — debounced, writes local immediately, queues cloud sync
  save(config) {
    const stamped = { ...config, version: CONFIG_VERSION, timestamp: Date.now() };
    // Immediate local save
    localStorage.setItem("desktop-config", JSON.stringify(stamped));
    this._dirty = true;

    // Debounced cloud sync
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._syncToCloud(stamped), SYNC_DEBOUNCE_MS);

    this._notifyListeners("saved");
  }

  async _syncToCloud(config) {
    try {
      // Production: await driveAppData.put('desktop-config.json', config);
      this._lastSyncTime = Date.now();
      this._dirty = false;
      this._notifyListeners("synced");
      console.log("[ConfigSync] Synced to cloud at", new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("[ConfigSync] Cloud sync failed:", e);
      this._notifyListeners("error");
    }
  }

  onStatus(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _notifyListeners(status) { this._listeners.forEach(fn => fn(status)); }

  getDefaults() {
    return {
      version: CONFIG_VERSION,
      timestamp: 0,
      positions: {},
      fences: [],
      wallpaper: "meadow",
      customWallpaper: null,
      rootFolderId: null,
    };
  }

  isDirty() { return this._dirty; }
  lastSync() { return this._lastSyncTime; }
}

const configSync = new ConfigSync();

// ─── Touch Helpers ───
const LONG_PRESS_MS = 500;
const TOUCH_MOVE_THRESHOLD = 8; // px before we consider it a drag vs tap

function getClientPos(e) {
  if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

// ─── Data Layer ───
const MOCK_FILES = [
  { id: "1", name: "Holiday Photos 2024", type: "folder", mimeType: "application/vnd.google-apps.folder", parentId: null },
  { id: "2", name: "Budget Spreadsheet.xlsx", type: "spreadsheet", mimeType: "application/vnd.google-apps.spreadsheet", parentId: null },
  { id: "3", name: "Recipe Collection.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "4", name: "Tax Return 2024.pdf", type: "pdf", mimeType: "application/pdf", parentId: null },
  { id: "5", name: "Shopping List.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "6", name: "Family Reunion Plan.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "7", name: "Vacation Ideas.pptx", type: "presentation", mimeType: "application/vnd.google-apps.presentation", parentId: null },
  { id: "8", name: "Garden Project", type: "folder", mimeType: "application/vnd.google-apps.folder", parentId: null },
  { id: "9", name: "Book Club Notes.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "10", name: "Birthday Invite.png", type: "image", mimeType: "image/png", parentId: null },
  { id: "11", name: "Vet Appointment.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "12", name: "Insurance Documents", type: "folder", mimeType: "application/vnd.google-apps.folder", parentId: null },
  { id: "13", name: "Chicken Curry Recipe.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "14", name: "Meeting Notes.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: null },
  { id: "15", name: "Sunset Photo.jpg", type: "image", mimeType: "image/jpeg", parentId: null },
  { id: "16", name: "Beach Day.jpg", type: "image", mimeType: "image/jpeg", parentId: "1" },
  { id: "17", name: "Hotel Booking.pdf", type: "pdf", mimeType: "application/pdf", parentId: "1" },
  { id: "18", name: "Packing List.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: "1" },
  { id: "19", name: "Lawn Plan.docx", type: "document", mimeType: "application/vnd.google-apps.document", parentId: "8" },
  { id: "20", name: "Plant List.xlsx", type: "spreadsheet", mimeType: "application/vnd.google-apps.spreadsheet", parentId: "8" },
  { id: "21", name: "Car Insurance.pdf", type: "pdf", mimeType: "application/pdf", parentId: "12" },
  { id: "22", name: "Home Insurance.pdf", type: "pdf", mimeType: "application/pdf", parentId: "12" },
];

const GRID_SIZE = 100;
const ICON_W = 90;
const ICON_H = 100;
let fenceIdCounter = Date.now();
let fileIdCounter = Date.now();

const snapToGrid = (x, y) => ({ x: Math.round(x / GRID_SIZE) * GRID_SIZE, y: Math.round(y / GRID_SIZE) * GRID_SIZE });

const getFileIcon = (type, size = 44) => {
  const icons = {
    folder: (<svg viewBox="0 0 48 48" width={size} height={size}><path d="M4 8h16l4 4h20v28H4z" fill="#FFB74D" stroke="#F57C00" strokeWidth="1.5"/><path d="M4 16h40v24H4z" fill="#FFB74D" rx="2"/><path d="M4 16h40v4H4z" fill="#FFA726"/></svg>),
    document: (<svg viewBox="0 0 48 48" width={size} height={size}><path d="M10 4h20l10 10v30H10z" fill="#E3F2FD" stroke="#1E88E5" strokeWidth="1.5"/><path d="M30 4v10h10" fill="#BBDEFB" stroke="#1E88E5" strokeWidth="1.5"/><line x1="16" y1="22" x2="34" y2="22" stroke="#64B5F6" strokeWidth="1.5"/><line x1="16" y1="28" x2="34" y2="28" stroke="#64B5F6" strokeWidth="1.5"/><line x1="16" y1="34" x2="28" y2="34" stroke="#64B5F6" strokeWidth="1.5"/></svg>),
    spreadsheet: (<svg viewBox="0 0 48 48" width={size} height={size}><path d="M10 4h20l10 10v30H10z" fill="#E8F5E9" stroke="#43A047" strokeWidth="1.5"/><path d="M30 4v10h10" fill="#C8E6C9" stroke="#43A047" strokeWidth="1.5"/><rect x="15" y="20" width="18" height="4" fill="#66BB6A" rx="0.5"/><rect x="15" y="26" width="18" height="4" fill="#A5D6A7" rx="0.5"/><rect x="15" y="32" width="18" height="4" fill="#66BB6A" rx="0.5"/><line x1="24" y1="20" x2="24" y2="36" stroke="#2E7D32" strokeWidth="0.8"/></svg>),
    presentation: (<svg viewBox="0 0 48 48" width={size} height={size}><path d="M10 4h20l10 10v30H10z" fill="#FFF3E0" stroke="#FB8C00" strokeWidth="1.5"/><path d="M30 4v10h10" fill="#FFE0B2" stroke="#FB8C00" strokeWidth="1.5"/><rect x="15" y="20" width="18" height="14" fill="#FFB74D" rx="2"/><circle cx="24" cy="27" r="3" fill="#FFF3E0"/></svg>),
    pdf: (<svg viewBox="0 0 48 48" width={size} height={size}><path d="M10 4h20l10 10v30H10z" fill="#FFEBEE" stroke="#E53935" strokeWidth="1.5"/><path d="M30 4v10h10" fill="#FFCDD2" stroke="#E53935" strokeWidth="1.5"/><text x="24" y="32" textAnchor="middle" fill="#C62828" fontSize="10" fontWeight="bold" fontFamily="sans-serif">PDF</text></svg>),
    image: (<svg viewBox="0 0 48 48" width={size} height={size}><rect x="8" y="8" width="32" height="32" fill="#F3E5F5" stroke="#8E24AA" strokeWidth="1.5" rx="3"/><circle cx="18" cy="18" r="4" fill="#CE93D8"/><path d="M8 32l8-10 6 6 6-8 12 12H8z" fill="#AB47BC" opacity="0.7"/></svg>),
  };
  return icons[type] || icons.document;
};

const getInitialPositions = (visibleFiles) => {
  const cols = Math.max(1, Math.floor((window.innerWidth - 20) / GRID_SIZE));
  const p = {};
  visibleFiles.forEach((file, i) => { p[file.id] = { x: 10 + (i % cols) * GRID_SIZE, y: 50 + Math.floor(i / cols) * GRID_SIZE }; });
  return p;
};

// ─── Smaller Components ───
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, [onDone]);
  return (<div style={{ position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)", background: "rgba(20,20,30,0.92)", backdropFilter: "blur(16px)", color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 13, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", zIndex: 10000, border: "1px solid rgba(255,255,255,0.1)", animation: "toastIn 0.25s ease-out" }}>{message}<style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style></div>);
}

function SyncIndicator({ status }) {
  const icons = { saved: "💾", synced: "☁️", error: "⚠️", idle: "" };
  const labels = { saved: "Saving…", synced: "Synced", error: "Sync failed", idle: "" };
  if (status === "idle") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, color: status === "error" ? "#ff8a80" : "rgba(255,255,255,0.5)", fontSize: 11, animation: status === "synced" ? "fadeOut 2s forwards" : "none" }}>
      <span style={{ fontSize: 12 }}>{icons[status]}</span>{labels[status]}
      <style>{`@keyframes fadeOut { 0% { opacity:1; } 70% { opacity:1; } 100% { opacity:0; } }`}</style>
    </div>
  );
}

function RenameDialog({ file, onConfirm, onCancel }) {
  const [value, setValue] = useState(file.name);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  const handleSubmit = () => { const t = value.trim(); if (t && t !== file.name) onConfirm(t); else onCancel(); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: "rgba(30,30,42,0.97)", backdropFilter: "blur(24px)", borderRadius: 14, padding: 24, minWidth: 340, border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Rename</div>
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
          style={{ width: "100%", padding: "10px 14px", fontSize: 14, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={handleSubmit} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#4a8fe7", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Rename</button>
        </div>
      </div>
    </div>
  );
}

function WallpaperDialog({ currentWallpaper, currentCustom, onSelect, onClose }) {
  const [url, setUrl] = useState(currentCustom || "");
  const [tab, setTab] = useState(currentCustom ? "custom" : "presets");
  const fileInputRef = useRef(null);
  const presets = {
    meadow: { l: "Meadow", bg: "linear-gradient(160deg, #1a472a 0%, #2d5a27 20%, #4a7c3f 40%, #6b9b5e 60%, #89b77a 80%, #a8d4a0 100%)" },
    ocean: { l: "Ocean", bg: "linear-gradient(160deg, #0a1628 0%, #0d2847 20%, #134a7c 40%, #1a6db5 60%, #4a9fd4 80%, #7ec8e3 100%)" },
    sunset: { l: "Sunset", bg: "linear-gradient(160deg, #1a0a2e 0%, #3d1155 20%, #6b1d5e 40%, #a12a5e 60%, #d4605a 80%, #f4a460 100%)" },
    slate: { l: "Slate", bg: "linear-gradient(160deg, #1a1a2e 0%, #2d2d44 20%, #3d3d5c 40%, #4a4a6a 60%, #5a5a7a 80%, #6a6a8a 100%)" },
    dawn: { l: "Dawn", bg: "linear-gradient(160deg, #0f0c29 0%, #1a1040 20%, #302b63 40%, #4a3f8a 60%, #7b6eb5 80%, #ecd5c8 100%)" },
    forest: { l: "Forest", bg: "linear-gradient(160deg, #0b1a0f 0%, #1a3a1a 20%, #2d5a2d 35%, #1a4a3a 50%, #0d3a4a 70%, #1a2a3a 100%)" },
    cherry: { l: "Cherry", bg: "linear-gradient(160deg, #2a0a1a 0%, #5a1a2a 20%, #8a2a3a 40%, #ba4a5a 55%, #da8a8a 75%, #f0c0c0 100%)" },
    midnight: { l: "Midnight", bg: "linear-gradient(160deg, #020010 0%, #0a0a2a 25%, #0a1040 50%, #101a50 75%, #1a2a60 100%)" },
  };
  const handleFileUpload = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setUrl(ev.target.result); onSelect({ type: "custom", value: ev.target.result }); }; r.readAsDataURL(f); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "rgba(26,26,38,0.97)", backdropFilter: "blur(24px)", borderRadius: 16, padding: 28, width: 420, maxHeight: "80vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Desktop Background</div>
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
          {[["presets", "Presets"], ["custom", "Your Image"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "9px 0", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: tab === key ? "rgba(74,143,231,0.3)" : "rgba(255,255,255,0.04)", color: tab === key ? "#7cb3ff" : "rgba(255,255,255,0.5)" }}>{label}</button>
          ))}
        </div>
        {tab === "presets" && (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.entries(presets).map(([key, { l, bg }]) => (
            <div key={key} onClick={() => onSelect({ type: "preset", value: key })} style={{ height: 72, borderRadius: 10, background: bg, cursor: "pointer", border: currentWallpaper === key ? "2.5px solid #7cb3ff" : "2px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "flex-end", padding: 8, transform: currentWallpaper === key ? "scale(1.02)" : "none" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>{l}</span>
            </div>))}
        </div>)}
        {tab === "custom" && (<div>
          <div style={{ border: "2px dashed rgba(255,255,255,0.15)", borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer", marginBottom: 16 }} onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Tap to upload an image</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={url.startsWith("data:") ? "(uploaded)" : url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/photo.jpg" style={{ flex: 1, padding: "9px 12px", fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", outline: "none" }} />
            <button onClick={() => { if (url.trim()) onSelect({ type: "custom", value: url.trim() }); }} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#4a8fe7", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Apply</button>
          </div>
        </div>)}
        <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>Close</button>
      </div>
    </div>
  );
}

function Fence({ fence, fileCount, onDragStart, onTouchDragStart, onToggleRollUp, onRemoveFence, onRenameFence, onResizeStart }) {
  const [titleHover, setTitleHover] = useState(false);
  return (
    <div onMouseDown={(e) => { if (e.target.dataset.resize) return; onDragStart(e, fence.id); }}
      onTouchStart={(e) => { if (e.target.dataset.resize) return; onTouchDragStart(e, fence.id); }}
      style={{ position: "absolute", left: fence.x, top: fence.y, width: fence.w, height: fence.rolledUp ? 36 : fence.h, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", zIndex: 2, transition: "height 0.25s ease", cursor: "move", touchAction: "none" }}>
      <div onMouseEnter={() => setTitleHover(true)} onMouseLeave={() => setTitleHover(false)}
        style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", background: "rgba(255,255,255,0.06)", borderBottom: fence.rolledUp ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 600 }}>{fence.name} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>({fileCount})</span></span>
        <div style={{ display: "flex", gap: 4, opacity: titleHover ? 1 : 0.4, transition: "opacity 0.15s" }}>
          <FBtn label="✎" onClick={(e) => { e.stopPropagation(); onRenameFence(fence.id); }} />
          <FBtn label={fence.rolledUp ? "▼" : "▲"} onClick={(e) => { e.stopPropagation(); onToggleRollUp(fence.id); }} />
          <FBtn label="✕" onClick={(e) => { e.stopPropagation(); onRemoveFence(fence.id); }} />
        </div>
      </div>
      {!fence.rolledUp && (<div data-resize="true" onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, fence.id); }}
        style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, cursor: "se-resize", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}><line x1="9" y1="1" x2="1" y2="9" stroke="white" strokeWidth="1.2"/><line x1="9" y1="5" x2="5" y2="9" stroke="white" strokeWidth="1.2"/></svg>
      </div>)}
    </div>
  );
}
function FBtn({ label, onClick }) { const [h, setH] = useState(false); return <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: 24, height: 24, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", background: h ? "rgba(255,255,255,0.15)" : "transparent", color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer" }}>{label}</div>; }

function ContextMenu({ x, y, items }) {
  const ay = Math.min(y, window.innerHeight - items.length * 34 - 20);
  const ax = Math.min(x, window.innerWidth - 200);
  return (<div style={{ position: "fixed", left: ax, top: ay, background: "rgba(26,26,38,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 10, padding: "5px 0", minWidth: 190, zIndex: 9999, boxShadow: "0 10px 40px rgba(0,0,0,0.55)" }}>
    {items.map((item, i) => {
      if (item.type === "divider") return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 12px" }} />;
      if (item.type === "label") return <div key={i} style={{ padding: "5px 16px", color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.text}</div>;
      return <CMenuItem key={i} {...item} />;
    })}
  </div>);
}
function CMenuItem({ label, icon, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (<div onClick={disabled ? undefined : onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
    style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, color: disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)", fontSize: 13, cursor: disabled ? "default" : "pointer", background: hover && !disabled ? "rgba(255,255,255,0.08)" : "transparent" }}>
    {icon && <span style={{ width: 16, textAlign: "center", fontSize: 14, opacity: 0.7 }}>{icon}</span>}
    <span style={{ flex: 1 }}>{label}</span>
  </div>);
}

function FolderPickerDialog({ title, files, excludeIds, currentFolderId, onSelect, onCancel }) {
  const [browsing, setBrowsing] = useState(null);
  const [browseHistory, setBrowseHistory] = useState([]);
  const folders = files.filter(f => f.type === "folder" && f.parentId === browsing && !excludeIds.has(f.id));
  const currentName = browsing ? files.find(f => f.id === browsing)?.name : "Desktop";
  const goInto = (id) => { setBrowseHistory(p => [...p, browsing]); setBrowsing(id); };
  const goBack = () => { if (!browseHistory.length) return; setBrowsing(browseHistory.at(-1)); setBrowseHistory(p => p.slice(0, -1)); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: "rgba(26,26,38,0.97)", backdropFilter: "blur(24px)", borderRadius: 16, width: 380, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {browsing !== null && <div onClick={goBack} style={{ cursor: "pointer", padding: "3px 6px", borderRadius: 5, background: "rgba(255,255,255,0.06)" }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2"><path d="M10 3L5 8l5 5"/></svg></div>}
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 600 }}>{currentName}</span>
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto", padding: "6px 0" }}>
          <FPickerItem label={`Place here — ${currentName}`} icon="📌" isTarget disabled={browsing === currentFolderId} onClick={() => onSelect(browsing)} />
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 14px" }} />
          {folders.length === 0 ? <div style={{ padding: "20px 22px", color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center" }}>No subfolders</div>
            : folders.map(f => <FPickerItem key={f.id} label={f.name} count={files.filter(x => x.parentId === f.id).length} onClick={() => goInto(f.id)} />)}
        </div>
        <div style={{ padding: "12px 22px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
function FPickerItem({ label, icon, count, isTarget, disabled, onClick }) {
  const [h, setH] = useState(false);
  return (<div onClick={disabled ? undefined : onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ padding: "10px 22px", display: "flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer", background: h && !disabled ? (isTarget ? "rgba(74,143,231,0.15)" : "rgba(255,255,255,0.06)") : "transparent", opacity: disabled ? 0.35 : 1 }}>
    <span style={{ fontSize: 18 }}>{icon || "📁"}</span>
    <span style={{ flex: 1, color: isTarget ? "#7cb3ff" : "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: isTarget ? 600 : 400 }}>{label}</span>
    {count !== undefined && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{count}</span>}
    {!isTarget && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.8"><path d="M6 3l5 5-5 5"/></svg>}
  </div>);
}

// ─── Main App ───
export default function DesktopFiles() {
  const [files, setFiles] = useState(MOCK_FILES);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [positions, setPositions] = useState(() => { try { const s = localStorage.getItem("desktop-config"); return s ? JSON.parse(s).positions || {} : {}; } catch { return {}; } });
  const [fences, setFences] = useState(() => { try { const s = localStorage.getItem("desktop-config"); return s ? JSON.parse(s).fences || [] : []; } catch { return []; } });
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState(new Set());
  const [dragPreview, setDragPreview] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [wallpaper, setWallpaper] = useState(() => { try { const s = localStorage.getItem("desktop-config"); return s ? JSON.parse(s).wallpaper || "meadow" : "meadow"; } catch { return "meadow"; } });
  const [customWallpaper, setCustomWallpaper] = useState(() => { try { const s = localStorage.getItem("desktop-config"); return s ? JSON.parse(s).customWallpaper || "" : ""; } catch { return ""; } });
  const [showWallpaperDialog, setShowWallpaperDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameFenceTarget, setRenameFenceTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [folderPicker, setFolderPicker] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const canvasRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);
  const touchStartedDrag = useRef(false);

  const visibleFiles = files.filter(f => f.parentId === currentFolder);
  const showToast = (msg) => setToast(msg);

  // ─── Config Sync ───
  useEffect(() => { const unsub = configSync.onStatus(setSyncStatus); return unsub; }, []);

  // Save config whenever positions/fences/wallpaper change
  useEffect(() => {
    configSync.save({ positions, fences, wallpaper, customWallpaper });
  }, [positions, fences, wallpaper, customWallpaper]);

  // Ensure visible files have positions
  useEffect(() => {
    const missing = visibleFiles.filter(f => !positions[f.id]);
    if (missing.length === 0) return;
    const occupied = new Set(visibleFiles.filter(f => positions[f.id]).map(f => `${positions[f.id].x},${positions[f.id].y}`));
    const cols = Math.max(1, Math.floor((window.innerWidth - 20) / GRID_SIZE));
    let slot = 0; const np = {};
    missing.forEach(f => {
      let x, y;
      do { x = 10 + (slot % cols) * GRID_SIZE; y = 50 + Math.floor(slot / cols) * GRID_SIZE; slot++; } while (occupied.has(`${x},${y}`));
      np[f.id] = { x, y }; occupied.add(`${x},${y}`);
    });
    setPositions(prev => ({ ...prev, ...np }));
  }, [currentFolder, visibleFiles.length]);

  useEffect(() => { const h = () => setContextMenu(null); window.addEventListener("click", h); return () => window.removeEventListener("click", h); }, []);

  // Prevent default touch behaviors on the canvas to avoid scroll/zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const prevent = (e) => { if (dragging) e.preventDefault(); };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, [dragging]);

  const wallpapers = {
    meadow: "linear-gradient(160deg, #1a472a 0%, #2d5a27 20%, #4a7c3f 40%, #6b9b5e 60%, #89b77a 80%, #a8d4a0 100%)",
    ocean: "linear-gradient(160deg, #0a1628 0%, #0d2847 20%, #134a7c 40%, #1a6db5 60%, #4a9fd4 80%, #7ec8e3 100%)",
    sunset: "linear-gradient(160deg, #1a0a2e 0%, #3d1155 20%, #6b1d5e 40%, #a12a5e 60%, #d4605a 80%, #f4a460 100%)",
    slate: "linear-gradient(160deg, #1a1a2e 0%, #2d2d44 20%, #3d3d5c 40%, #4a4a6a 60%, #5a5a7a 80%, #6a6a8a 100%)",
    dawn: "linear-gradient(160deg, #0f0c29 0%, #1a1040 20%, #302b63 40%, #4a3f8a 60%, #7b6eb5 80%, #ecd5c8 100%)",
    forest: "linear-gradient(160deg, #0b1a0f 0%, #1a3a1a 20%, #2d5a2d 35%, #1a4a3a 50%, #0d3a4a 70%, #1a2a3a 100%)",
    cherry: "linear-gradient(160deg, #2a0a1a 0%, #5a1a2a 20%, #8a2a3a 40%, #ba4a5a 55%, #da8a8a 75%, #f0c0c0 100%)",
    midnight: "linear-gradient(160deg, #020010 0%, #0a0a2a 25%, #0a1040 50%, #101a50 75%, #1a2a60 100%)",
  };
  const getBackground = () => {
    if (wallpaper === "__custom" && customWallpaper) return { backgroundImage: `url(${customWallpaper})`, backgroundSize: "cover", backgroundPosition: "center" };
    return { background: wallpapers[wallpaper] || wallpapers.meadow };
  };

  // ─── Navigation ───
  const navigateIntoFolder = (folderId) => {
    const folder = files.find(f => f.id === folderId);
    if (!folder || folder.type !== "folder") return;
    setFolderHistory(prev => [...prev, { id: currentFolder, name: currentFolder ? files.find(f => f.id === currentFolder)?.name : "Desktop" }]);
    setCurrentFolder(folderId); setSelected(new Set()); setDropTarget(null);
  };
  const navigateBack = () => {
    if (!folderHistory.length) return;
    const prev = folderHistory.at(-1);
    setFolderHistory(h => h.slice(0, -1)); setCurrentFolder(prev.id); setSelected(new Set());
  };
  const navigateToBreadcrumb = (i) => {
    if (i < 0) { setCurrentFolder(null); setFolderHistory([]); }
    else { setCurrentFolder(folderHistory[i].id); setFolderHistory(h => h.slice(0, i)); }
    setSelected(new Set());
  };

  // ─── Unified Pointer Handling (Mouse + Touch) ───
  const startDragFile = useCallback((clientX, clientY, fileId) => {
    const pos = positions[fileId]; if (!pos) return;
    if (!selected.has(fileId)) setSelected(new Set([fileId]));
    setDragging({ type: "file", id: fileId });
    setDragOffset({ x: clientX - pos.x, y: clientY - pos.y });
    setDragPreview(null); setDropTarget(null);
  }, [positions, selected]);

  const startDragFence = useCallback((clientX, clientY, fenceId) => {
    const fence = fences.find(f => f.id === fenceId); if (!fence) return;
    setDragging({ type: "fence", id: fenceId });
    setDragOffset({ x: clientX - fence.x, y: clientY - fence.y });
    setDragPreview(null);
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

  // Touch handlers — long press for context menu, short drag for move
  const handleFileTouchStart = useCallback((e, fileId) => {
    const { x, y } = getClientPos(e);
    touchStartPos.current = { x, y, fileId };
    touchStartedDrag.current = false;

    // Long press timer for context menu
    longPressTimer.current = setTimeout(() => {
      const file = files.find(f => f.id === fileId);
      if (file && !touchStartedDrag.current) {
        // Vibrate for haptic feedback if available
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

    // Check if moved past threshold to start drag
    if (!touchStartedDrag.current) {
      const dist = Math.hypot(x - start.x, y - start.y);
      if (dist > TOUCH_MOVE_THRESHOLD) {
        touchStartedDrag.current = true;
        clearTimeout(longPressTimer.current);
        startDragFile(x, y, start.fileId);
      }
      return;
    }

    // Already dragging
    if (!dragging) return;
    const rawX = x - dragOffset.x;
    const rawY = y - dragOffset.y;
    setDragPreview(snapToGrid(rawX, rawY));
    if (dragging.type === "file") setDropTarget(findFolderUnderCursor(x, y));
  }, [dragging, dragOffset, startDragFile]);

  const handleFileTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!touchStartedDrag.current && touchStartPos.current) {
      // It was a tap — select the file
      const fid = touchStartPos.current.fileId;
      setSelected(new Set([fid]));
    }
    touchStartPos.current = null;
    if (dragging) handlePointerUp();
  }, [dragging]);

  const handleFenceTouchStart = useCallback((e, fenceId) => {
    const { x, y } = getClientPos(e);
    startDragFence(x, y, fenceId);
  }, [startDragFence]);

  // Canvas touch for context menu on empty space
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
    const fence = fences.find(f => f.id === fenceId); if (!fence) return;
    setResizing({ fenceId, startX: e.clientX, startY: e.clientY, startW: fence.w, startH: fence.h });
  }, [fences]);

  const findFolderUnderCursor = useCallback((clientX, clientY) => {
    if (!dragging || dragging.type !== "file") return null;
    const draggedIds = selected.has(dragging.id) && selected.size > 1 ? selected : new Set([dragging.id]);
    for (const file of visibleFiles) {
      if (file.type !== "folder" || draggedIds.has(file.id)) continue;
      const pos = positions[file.id]; if (!pos) continue;
      if (clientX >= pos.x && clientX <= pos.x + ICON_W && clientY >= pos.y && clientY <= pos.y + ICON_H) return file.id;
    }
    return null;
  }, [dragging, selected, visibleFiles, positions]);

  const handlePointerMove = useCallback((e) => {
    const { x: cx, y: cy } = getClientPos(e);
    if (resizing) {
      const dx = cx - resizing.startX; const dy = cy - resizing.startY;
      setFences(prev => prev.map(f => f.id === resizing.fenceId ? { ...f, w: Math.max(200, Math.round((resizing.startW + dx) / GRID_SIZE) * GRID_SIZE), h: Math.max(150, Math.round((resizing.startH + dy) / GRID_SIZE) * GRID_SIZE) } : f));
      return;
    }
    if (!dragging) return;
    setDragPreview(snapToGrid(cx - dragOffset.x, cy - dragOffset.y));
    if (dragging.type === "file") setDropTarget(findFolderUnderCursor(cx, cy));
  }, [dragging, dragOffset, resizing, findFolderUnderCursor]);

  const handlePointerUp = useCallback(() => {
    if (resizing) { setResizing(null); return; }
    if (dragging?.type === "file" && dropTarget) {
      const draggedIds = selected.has(dragging.id) && selected.size > 1 ? [...selected] : [dragging.id];
      const targetFolder = files.find(f => f.id === dropTarget);
      setFiles(prev => prev.map(f => draggedIds.includes(f.id) ? { ...f, parentId: dropTarget } : f));
      setPositions(prev => { const n = { ...prev }; draggedIds.forEach(id => delete n[id]); return n; });
      showToast(`Moved ${draggedIds.length} ${draggedIds.length === 1 ? "item" : "items"} into "${targetFolder?.name}"`);
      setSelected(new Set()); setDragging(null); setDragPreview(null); setDropTarget(null); return;
    }
    if (dragging && dragPreview) {
      if (dragging.type === "file") {
        const dx = dragPreview.x - positions[dragging.id].x; const dy = dragPreview.y - positions[dragging.id].y;
        setPositions(prev => {
          const n = { ...prev }; const items = selected.has(dragging.id) && selected.size > 1 ? selected : new Set([dragging.id]);
          items.forEach(id => { if (n[id]) n[id] = { x: Math.max(0, n[id].x + dx), y: Math.max(0, n[id].y + dy) }; }); return n;
        });
      } else if (dragging.type === "fence") {
        const fence = fences.find(f => f.id === dragging.id);
        if (fence) {
          const dx = dragPreview.x - fence.x; const dy = dragPreview.y - fence.y;
          setFences(prev => prev.map(f => f.id === dragging.id ? { ...f, x: dragPreview.x, y: dragPreview.y } : f));
          setPositions(prev => {
            const n = { ...prev }; Object.entries(n).forEach(([id, pos]) => {
              if (pos.x >= fence.x && pos.x < fence.x + fence.w && pos.y >= fence.y && pos.y < fence.y + fence.h) n[id] = { x: pos.x + dx, y: pos.y + dy };
            }); return n;
          });
        }
      }
    }
    setDragging(null); setDragPreview(null); setDropTarget(null);
  }, [dragging, dragPreview, positions, selected, fences, resizing, dropTarget, files]);

  const handleCanvasClick = (e) => { if (e.target === canvasRef.current || e.target.classList.contains("desktop-canvas")) setSelected(new Set()); };

  // ─── Duplicate / Copy / Move ───
  const duplicateFiles = (fileIds) => {
    const nf = []; const np = {};
    fileIds.forEach(id => {
      const orig = files.find(f => f.id === id); if (!orig) return;
      const newId = `copy-${fileIdCounter++}`;
      nf.push({ ...orig, id: newId, name: `${orig.name} (copy)` });
      const op = positions[id]; if (op) np[newId] = { x: op.x + GRID_SIZE, y: op.y + GRID_SIZE };
    });
    setFiles(prev => [...prev, ...nf]); setPositions(prev => ({ ...prev, ...np })); return nf.length;
  };

  const handleFolderPickerSelect = (targetId) => {
    if (!folderPicker) return;
    const { mode, fileIds } = folderPicker; const count = fileIds.length;
    const targetName = targetId ? files.find(f => f.id === targetId)?.name : "Desktop";
    if (mode === "move") {
      setFiles(prev => prev.map(f => fileIds.includes(f.id) ? { ...f, parentId: targetId } : f));
      setPositions(prev => { const n = { ...prev }; fileIds.forEach(id => delete n[id]); return n; });
      showToast(`Moved ${count} ${count === 1 ? "item" : "items"} to "${targetName}"`);
    } else {
      const nf = []; fileIds.forEach(id => { const o = files.find(f => f.id === id); if (o) nf.push({ ...o, id: `copy-${fileIdCounter++}`, parentId: targetId }); });
      setFiles(prev => [...prev, ...nf]);
      showToast(`Copied ${count} ${count === 1 ? "item" : "items"} to "${targetName}"`);
    }
    setSelected(new Set()); setFolderPicker(null);
  };

  // ─── Context Menus ───
  const handleFileContextMenu = useCallback((e, file) => {
    e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
    if (!selected.has(file.id)) setSelected(new Set([file.id]));
    const sids = selected.size > 1 && selected.has(file.id) ? selected : new Set([file.id]);
    const count = sids.size; const multi = count > 1; const idArr = [...sids];
    const items = [
      { label: "Open", icon: "📂", onClick: () => { if (file.type === "folder") navigateIntoFolder(file.id); else handleDoubleClick(file); setContextMenu(null); } },
    ];
    if (file.type === "folder" && !multi) items.push({ label: "New folder inside…", icon: "📁", onClick: () => { const nid = `folder-${fileIdCounter++}`; setFiles(prev => [...prev, { id: nid, name: "New Folder", type: "folder", mimeType: "application/vnd.google-apps.folder", parentId: file.id }]); showToast(`Created folder inside "${file.name}"`); setContextMenu(null); } });
    items.push({ type: "divider" });
    items.push({ label: "Rename", icon: "✏️", onClick: () => { setRenameTarget(file); setContextMenu(null); }, disabled: multi });
    items.push({ label: multi ? `Duplicate ${count} items` : "Duplicate", icon: "📋", onClick: () => { duplicateFiles(idArr); showToast(`Duplicated`); setContextMenu(null); } });
    items.push({ type: "divider" });
    items.push({ label: "Copy to…", icon: "📄", onClick: () => { setFolderPicker({ mode: "copy", fileIds: idArr }); setContextMenu(null); } });
    items.push({ label: "Move to…", icon: "📁", onClick: () => { setFolderPicker({ mode: "move", fileIds: idArr }); setContextMenu(null); } });
    if (currentFolder !== null) items.push({ label: "Move to Desktop", icon: "🏠", onClick: () => { setFiles(prev => prev.map(f => idArr.includes(f.id) ? { ...f, parentId: null } : f)); setPositions(prev => { const n = { ...prev }; idArr.forEach(id => delete n[id]); return n; }); showToast(`Moved to Desktop`); setSelected(new Set()); setContextMenu(null); } });
    items.push({ type: "divider" });
    items.push({ label: "Email", icon: "✉️", onClick: () => { showToast("Requires Google Drive"); setContextMenu(null); } });
    items.push({ label: "Convert to PDF", icon: "📄", onClick: () => { showToast("Requires Google Drive"); setContextMenu(null); }, disabled: file.type === "pdf" || file.type === "folder" });
    items.push({ label: "Download", icon: "⬇️", onClick: () => { showToast("Requires Google Drive"); setContextMenu(null); } });
    items.push({ type: "divider" });
    items.push({ label: "Get link", icon: "🔗", onClick: () => { showToast("Link copied"); setContextMenu(null); } });
    items.push({ label: "File info", icon: "ℹ️", onClick: () => { const cc = file.type === "folder" ? files.filter(f => f.parentId === file.id).length : 0; showToast(`${file.name} · ${file.mimeType}${file.type === "folder" ? ` · ${cc} items` : ""}`); setContextMenu(null); } });
    items.push({ type: "divider" });
    items.push({ label: count > 1 ? `Delete ${count} items` : "Delete", icon: "🗑️", onClick: () => { setFiles(prev => prev.filter(f => !idArr.includes(f.id))); setPositions(prev => { const n = { ...prev }; idArr.forEach(id => delete n[id]); return n; }); setSelected(new Set()); showToast("Deleted"); setContextMenu(null); } });
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, [selected, files, currentFolder, positions]);

  const handleDesktopContextMenu = useCallback((e) => {
    e.preventDefault();
    const cp = snapToGrid(e.clientX, e.clientY);
    setContextMenu({ x: e.clientX, y: e.clientY, items: [
      { label: "New folder", icon: "📁", onClick: () => { const nid = `folder-${fileIdCounter++}`; const f = { id: nid, name: "New Folder", type: "folder", mimeType: "application/vnd.google-apps.folder", parentId: currentFolder }; setFiles(p => [...p, f]); setPositions(p => ({ ...p, [nid]: cp })); setTimeout(() => setRenameTarget(f), 50); setContextMenu(null); } },
      { label: "New document", icon: "📝", onClick: () => { const nid = `doc-${fileIdCounter++}`; const f = { id: nid, name: "Untitled Document", type: "document", mimeType: "application/vnd.google-apps.document", parentId: currentFolder }; setFiles(p => [...p, f]); setPositions(p => ({ ...p, [nid]: cp })); setTimeout(() => setRenameTarget(f), 50); setContextMenu(null); } },
      { type: "divider" },
      { label: "Auto-arrange", icon: "⊞", onClick: () => { setPositions(p => ({ ...p, ...getInitialPositions(visibleFiles) })); setContextMenu(null); } },
      { type: "divider" },
      { label: "Create fence", icon: "▢", onClick: () => { setFences(p => [...p, { id: `fence-${fenceIdCounter++}`, name: "New Group", x: cp.x, y: cp.y, w: 300, h: 300, rolledUp: false }]); setContextMenu(null); } },
      { type: "divider" },
      { label: "Change wallpaper…", icon: "🖼️", onClick: () => { setShowWallpaperDialog(true); setContextMenu(null); } },
      { type: "divider" },
      { label: "Snap to grid", icon: "⊡", onClick: () => { setPositions(p => { const n = { ...p }; visibleFiles.forEach(f => { if (n[f.id]) n[f.id] = snapToGrid(n[f.id].x, n[f.id].y); }); return n; }); setContextMenu(null); } },
    ] });
  }, [currentFolder, visibleFiles]);

  const handleDoubleClick = (file) => {
    if (file.type === "folder") { navigateIntoFolder(file.id); return; }
    alert(`Opening "${file.name}"…\n\nIn production this opens in Google Drive.`);
  };

  const handleRename = (newName) => { if (!renameTarget) return; setFiles(p => p.map(f => f.id === renameTarget.id ? { ...f, name: newName } : f)); setRenameTarget(null); showToast(`Renamed to "${newName}"`); };

  const getIconPosition = (fileId) => {
    if (dragging?.type === "file") {
      if (dragging.id === fileId && dragPreview) return dragPreview;
      if (selected.has(fileId) && selected.has(dragging.id) && dragPreview) { const dx = dragPreview.x - positions[dragging.id].x; const dy = dragPreview.y - positions[dragging.id].y; return { x: positions[fileId].x + dx, y: positions[fileId].y + dy }; }
    }
    if (dragging?.type === "fence" && dragPreview) {
      const fence = fences.find(f => f.id === dragging.id); if (fence) { const pos = positions[fileId]; if (pos && pos.x >= fence.x && pos.x < fence.x + fence.w && pos.y >= fence.y && pos.y < fence.y + fence.h) return { x: pos.x + (dragPreview.x - fence.x), y: pos.y + (dragPreview.y - fence.y) }; }
    }
    return positions[fileId];
  };
  const getFencePosition = (fence) => dragging?.type === "fence" && dragging.id === fence.id && dragPreview ? { ...fence, x: dragPreview.x, y: dragPreview.y } : fence;
  const currentFolderName = currentFolder ? files.find(f => f.id === currentFolder)?.name : "Desktop";

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", fontFamily: "'Segoe UI', 'Noto Sans', system-ui, sans-serif", userSelect: "none", position: "relative", touchAction: "none", ...getBackground() }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06) 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Breadcrumb */}
      {(currentFolder !== null || folderHistory.length > 0) && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 42, background: "rgba(10,10,20,0.6)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", padding: "0 16px", gap: 6, zIndex: 100 }}>
          <div onClick={navigateBack} style={{ width: 34, height: 34, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(255,255,255,0.06)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8"><path d="M10 3L5 8l5 5"/></svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
            <BreadcrumbItem label="Desktop" onClick={() => navigateToBreadcrumb(-1)} />
            {folderHistory.map((item, i) => (<span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}><span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>›</span><BreadcrumbItem label={item.name || "…"} onClick={() => navigateToBreadcrumb(i)} /></span>))}
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>›</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 600, padding: "4px 8px" }}>{currentFolderName}</span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={canvasRef} className="desktop-canvas" onClick={handleCanvasClick}
        onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
        onTouchMove={handleFileTouchMove} onTouchEnd={(e) => { handleFileTouchEnd(); handlePointerUp(); }}
        onTouchStart={handleCanvasTouchStart}
        onContextMenu={handleDesktopContextMenu}
        style={{ position: "absolute", inset: 0, zIndex: 1, cursor: dragging ? "grabbing" : "default", touchAction: "none" }}>

        {fences.map(fence => {
          const df = getFencePosition(fence);
          const fc = visibleFiles.filter(f => { const p = positions[f.id]; return p && p.x >= fence.x && p.x < fence.x + fence.w && p.y >= fence.y && p.y < fence.y + fence.h; }).length;
          return <Fence key={fence.id} fence={df} fileCount={fc} onDragStart={handleFenceMouseDown} onTouchDragStart={handleFenceTouchStart}
            onToggleRollUp={(id) => setFences(p => p.map(f => f.id === id ? { ...f, rolledUp: !f.rolledUp } : f))}
            onRemoveFence={(id) => setFences(p => p.filter(f => f.id !== id))}
            onRenameFence={(id) => { const f = fences.find(x => x.id === id); if (f) setRenameFenceTarget(f); }}
            onResizeStart={handleResizeStart} />;
        })}

        {visibleFiles.map((file) => {
          const pos = getIconPosition(file.id); if (!pos) return null;
          const inRolled = fences.some(f => f.rolledUp && pos.x >= f.x && pos.x < f.x + f.w && pos.y >= f.y && pos.y < f.y + f.h);
          if (inRolled && !(dragging?.type === "file" && (dragging.id === file.id || (selected.has(file.id) && selected.has(dragging.id))))) return null;
          const isSel = selected.has(file.id);
          const isDrag = dragging?.type === "file" && dragging.id === file.id;
          const isDrop = dropTarget === file.id;
          const isMoving = isDrag || (dragging?.type === "file" && selected.has(file.id) && selected.has(dragging.id));

          return (
            <div key={file.id}
              onMouseDown={(e) => handleFileMouseDown(e, file.id)}
              onTouchStart={(e) => { e.stopPropagation(); handleFileTouchStart(e, file.id); }}
              onContextMenu={(e) => handleFileContextMenu(e, file)}
              onDoubleClick={() => handleDoubleClick(file)}
              style={{
                position: "absolute", left: pos.x, top: pos.y, width: ICON_W, height: ICON_H,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                gap: 3, padding: "6px 4px", borderRadius: 8, touchAction: "none",
                cursor: dragging ? "grabbing" : "pointer",
                background: isDrop ? "rgba(100, 220, 130, 0.35)" : isSel ? "rgba(100, 160, 255, 0.3)" : "transparent",
                border: isDrop ? "2px solid rgba(100, 220, 130, 0.8)" : isSel ? "1.5px solid rgba(100, 160, 255, 0.6)" : "1.5px solid transparent",
                opacity: isMoving ? 0.6 : 1,
                transition: isMoving ? "none" : "background 0.15s, border 0.15s, transform 0.15s",
                transform: isDrop ? "scale(1.1)" : "none",
                zIndex: isDrag ? 1000 : isDrop ? 999 : 3, boxSizing: "border-box",
              }}
              onMouseEnter={(e) => { if (!isSel && !isDrop && !dragging) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={(e) => { if (!isSel && !isDrop) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))", flexShrink: 0, position: "relative" }}>
                {getFileIcon(file.type)}
                {file.type === "folder" && (<div style={{ position: "absolute", top: -4, right: -8, background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.8)", fontSize: 9, fontWeight: 700, borderRadius: 8, padding: "1px 5px", minWidth: 14, textAlign: "center", border: "1px solid rgba(255,255,255,0.15)" }}>
                  {files.filter(f => f.parentId === file.id).length}
                </div>)}
              </div>
              <div style={{ color: "#fff", fontSize: 11, lineHeight: "13px", textAlign: "center", maxWidth: ICON_W - 4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", wordBreak: "break-word", textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.4)", fontWeight: 500 }}>{file.name}</div>
            </div>
          );
        })}

        {dragging?.type === "file" && dropTarget && (
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(10,10,20,0.85)", backdropFilter: "blur(16px)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, border: "1px solid rgba(100,220,130,0.3)", zIndex: 10001, pointerEvents: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>📂</span> Drop into "{files.find(f => f.id === dropTarget)?.name}"
          </div>
        )}
      </div>

      {/* Dialogs */}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} />}
      {renameTarget && <RenameDialog file={renameTarget} onConfirm={handleRename} onCancel={() => setRenameTarget(null)} />}
      {renameFenceTarget && <RenameDialog file={renameFenceTarget} onConfirm={(name) => { setFences(p => p.map(f => f.id === renameFenceTarget.id ? { ...f, name } : f)); setRenameFenceTarget(null); }} onCancel={() => setRenameFenceTarget(null)} />}
      {showWallpaperDialog && <WallpaperDialog currentWallpaper={wallpaper} currentCustom={customWallpaper} onSelect={({ type, value }) => { if (type === "preset") { setWallpaper(value); setCustomWallpaper(""); } else { setWallpaper("__custom"); setCustomWallpaper(value); } setShowWallpaperDialog(false); }} onClose={() => setShowWallpaperDialog(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {folderPicker && <FolderPickerDialog title={folderPicker.mode === "move" ? "Move to…" : "Copy to…"} files={files} excludeIds={new Set(folderPicker.fileIds)} currentFolderId={currentFolder} onSelect={handleFolderPickerSelect} onCancel={() => setFolderPicker(null)} />}

      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 48, background: "rgba(10,10,20,0.7)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 500 }}>Desktop Files</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SyncIndicator status={syncStatus} />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {visibleFiles.length} items{selected.size > 0 ? ` · ${selected.size} selected` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function BreadcrumbItem({ label, onClick }) {
  const [h, setH] = useState(false);
  return (<span onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
    style={{ color: h ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", padding: "4px 8px", borderRadius: 5, background: h ? "rgba(255,255,255,0.08)" : "transparent", whiteSpace: "nowrap" }}>{label}</span>);
}
