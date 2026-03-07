# Desktop Files

**A spatial file manager for Google Drive — because some people think in places, not lists.**

---

## The Problem

When someone moves from a Windows or Mac laptop to a Chromebook, they lose something subtle but important: the desktop. Not the wallpaper — the *spatial metaphor*. The ability to put a document in the top-left corner because that's where work things go, and holiday photos bottom-right because that's where personal things live. That mental map of "I know where I put it" that no search box or alphabetical file list can replace.

ChromeOS doesn't have desktop icons. Google Drive is a list. For people with strong visual and spatial memory — and there are a lot of them — this is a genuine usability regression that no amount of folder organisation can fix.

Desktop Files exists to give that back.

---

## What It Does

Desktop Files is a Progressive Web App that connects to Google Drive and presents a single folder's contents as freely-arrangeable icons on a visual canvas — a desktop, in the original sense of the word.

**Core experience:** You see your files as icons. You drag them where you want them. They stay where you put them. That's it. That's the product.

Everything else builds on that foundation.

### Spatial Organisation
Files appear as recognisable icons on a freeform canvas. Drag them anywhere. They snap to a subtle grid to keep things tidy, but the layout is entirely yours. Positions persist across sessions and sync across devices.

### Desktop Fences
Borrowed from the excellent Stardock Fences concept for Windows — create transparent grouping containers on your desktop. Drag files into them. Move the whole group at once. Roll a fence up to its title bar to temporarily hide its contents and declutter. Name your groups whatever makes sense: "Tax Stuff", "Book Club", "Garden Project".

### Folder Navigation
Double-click a folder to go inside it. A breadcrumb trail tracks where you are. Drag files between the desktop and folders, or between folders. The spatial layout is maintained independently for each folder — your desktop arrangement doesn't interfere with how things look inside "Holiday Photos".

### Drag and Drop Into Folders
Drag a file over a folder icon and it highlights. Drop it in. The file moves into that folder in Google Drive. Multi-select works too — grab several files and drop them all at once.

### File Operations
Right-click any file for a context menu with real operations: rename, duplicate, copy to another folder, move to another folder, delete. A built-in folder browser lets you pick destinations without leaving the app. Actions that require Google Drive integration (email, convert to PDF, download) are architecturally ready and waiting to be wired up.

### Cross-Device Sync
Your layout configuration — icon positions, fences, wallpaper choice — is stored in a small JSON file in Google Drive's hidden app data folder. Log in on any device and your desktop looks exactly as you left it. The sync is debounced (saves 2 seconds after your last change) so dragging icons around feels instant.

### Touch Support
Full touch interaction for tablets and touchscreen Chromebooks. Tap to select, drag to move, long-press for the context menu. Touch-drag into folders works with the same green highlight feedback as mouse interaction.

### Installable PWA
Installs from the browser onto the Chromebook shelf (or tablet home screen) as a standalone app. Launches in its own window without browser chrome. Feels native.

---

## Why This Doesn't Exist Yet

There are file managers. There are Google Drive clients. There are even a few icon-grid launchers for Chrome. But none of them offer the specific combination of:

- **Freeform spatial positioning** (not a grid, not a list, not auto-arranged — *you* decide where things go)
- **Google Drive as the backend** (not a separate storage silo)
- **Persistent layout memory** (positions survive across sessions and devices)
- **Desktop fences** (a feature that millions of Windows users love and can't get anywhere else)
- **Touch-first design** (actually works on a tablet, not just "technically supports touch")

The closest analogue is Stardock Fences, which is Windows-only, desktop-only, and doesn't integrate with cloud storage. Desktop Files brings that concept to the web and ties it directly to the file system people are already using.

---

## Technical Architecture

### Stack
- **React** single-page application
- **Vite** for build tooling
- **Google Drive API v3** for file operations
- **Google Identity Services** for OAuth authentication
- **PWA** with service worker for offline layout caching

### Key Design Decisions

**Local-first, cloud-sync.** Layout changes save to localStorage immediately and sync to Google Drive on a debounced timer. The app feels instant even on slow connections. On startup, it loads the local cache first, then checks if a newer version exists in the cloud.

**appDataFolder for config.** Google Drive provides a hidden, app-specific storage space that the user never sees in their normal Drive. Layout config lives here. It doesn't count against storage quota and automatically follows the Google account across devices.

**ParentId-based file tree.** The internal data model mirrors Google Drive's own structure — each file has a `parentId` pointing to its containing folder. This means the Drive API integration is a thin mapping layer, not a translation.

**Unified pointer handling.** Mouse and touch events share the same state machine. A single `startDrag` / `pointerMove` / `pointerUp` flow handles both input methods, with touch-specific additions for long-press context menus and drag threshold detection.

**Grid snap with freeform intent.** Icons snap to a 100px grid, which prevents visual chaos while preserving the feeling of spatial control. The grid is invisible — it's a guide, not a constraint.

### File Structure (Production)
```
src/
├── App.jsx                  Main desktop canvas
├── config.js                API keys, constants
├── api/
│   └── drive.js             Google Drive API wrapper + config sync
├── auth/
│   └── google.js            OAuth login/logout
├── components/
│   ├── DesktopCanvas.jsx    Canvas with drag/drop/touch
│   ├── FileIcon.jsx         File icon with type-specific SVG
│   ├── Fence.jsx            Desktop fence (grouping container)
│   ├── FolderPicker.jsx     Folder browser dialog
│   ├── ContextMenu.jsx      Right-click / long-press menus
│   └── Dialogs.jsx          Rename, wallpaper picker, etc.
├── hooks/
│   ├── useDragDrop.js       Unified mouse/touch drag logic
│   └── useConfigSync.js     Local + cloud config persistence
public/
├── manifest.json            PWA manifest
├── sw.js                    Service worker
├── icon-192.png             App icon
└── icon-512.png             App icon
```

---

## Roadmap

### Phase 1 — Foundation (Complete)
Working prototype with all core interactions: freeform icon positioning, drag and drop, fences, folder navigation, context menus, touch support, config sync architecture, wallpaper customisation.

### Phase 2 — Google Drive Integration
Connect to real Drive data. OAuth login flow, file listing, create/rename/move/copy/delete operations, folder picker wired to API. Replace mock data with live Drive contents.

### Phase 3 — Polish
Real file thumbnails from Drive API (document previews, photo thumbnails). Smooth animations. Keyboard shortcuts. Search/filter overlay. Sort options (by name, date, type, size). Undo for destructive operations.

### Phase 4 — Extended Features
- **Multiple desktops** — different folder-to-desktop mappings, switchable from the bottom bar
- **Pinned files** — files that appear on every desktop regardless of which folder they live in
- **Smart groups** — auto-populated fences based on file type or modification date ("Recently changed", "All spreadsheets")
- **Shared desktops** — share a layout config with another user so a family or team sees the same spatial arrangement
- **Widget support** — embed live previews, calendar widgets, or notes directly on the desktop
- **File previews** — hover or tap-hold to see a quick preview without opening the file

### Phase 5 — Platform Expansion
- **Android tablet app** — PWA already works, but a native wrapper could add deeper integration
- **Desktop Chrome extension** — new tab page replacement showing your spatial desktop
- **API for third-party storage** — abstract the backend so it works with OneDrive, Dropbox, or local filesystem

---

## Who Is This For?

**Primary audience:** People who moved from Windows/Mac to Chromebook and miss their desktop. People who think spatially. People who organise by visual position rather than by name or folder hierarchy.

**Secondary audience:** Anyone frustrated with Google Drive's list-based interface. Tablet users who want a more tactile way to manage files. Families who share a Chromebook and want personalised desktop layouts tied to their own Google accounts.

**Developer audience:** Anyone interested in spatial interfaces, freeform canvas UIs, Google Drive API integration, PWA development, or touch-first web applications. The codebase is intentionally clean and modular — each feature (fences, drag-drop, config sync, touch handling) is self-contained and well-documented.

---

## Contributing

This project started as a weekend prototype to solve a real problem for one person. If it solves a problem for you too, or if you see potential in the concept, contributions are welcome.

Areas where help would be particularly valuable: Google Drive API integration and testing across different account types, accessibility (keyboard navigation, screen reader support), internationalisation, performance optimisation for folders with hundreds of files, and Android/iOS PWA testing.

---

## Licence

MIT — use it, fork it, build on it.

---

*Desktop Files was born from a simple observation: when someone says "I know where I put it", they don't mean which folder. They mean where on the screen. That spatial intuition is powerful, and it deserves better than a search box.*
