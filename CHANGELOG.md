# Changelog

All notable changes to UseAble Deskmat are documented here.

---

## [Unreleased] — 2026-03-08

### Fixed
- **GIS "Params are not set" error** — The Google Identity Services token client is now re-created immediately before each `requestAccessToken` call, preventing stale params from a previously initialised client instance from causing the sign-in popup to fail.
- **Rubber-band selection instantly unselecting** — A `click` event fires on the canvas immediately after `mouseup`, causing `handleCanvasClick` to wipe the freshly-built selection. A ref guard now suppresses that click when it follows the end of a rubber-band drag.

### Added
- **Create fence from selection** — When multiple files are selected, right-clicking now shows "Create fence from N files". A new fence is created whose bounds exactly wrap the selected files, and those files become its members immediately.
- **Move files into new folder** — When multiple files are selected, right-clicking shows "Move N files into new folder…". A new Drive folder is created at the desktop root, the selected files are moved into it, and a rename dialog opens so you can name the folder straight away.

---

## [Phase 3] — 2026-03-08 (`de41d5b`)

### Added
- **Folder browser modal** — Double-clicking a folder (or right-click → "Open folder") now opens a clean overlay modal showing the folder's contents as a sorted list. You can navigate into sub-folders within the same modal with a breadcrumb trail and back button. The desktop view never navigates.
- **True fence membership** — Each fence now maintains an explicit `members` list (array of file IDs). Files dragged inside a fence's boundary are added as members; files dragged out are removed. Right-clicking a fenced file shows "Remove from fence". Auto-arrange places fence members neatly within the fence and positions non-members on the open desktop.
- **Drag-to-select (rubber-band)** — Clicking and dragging on any empty area of the desktop draws a selection box. All file icons that overlap the box are selected live as you drag. Ctrl/Cmd+click still toggles individual files.
- **Sort by Name / Type / Date** — Right-click → "Sort by" section with Name, Type, Date modified, and Manual options. Choosing a named sort immediately triggers an auto-arrange in that order and persists the preference to cloud config. Manual mode preserves free-form placement.
- **Settings panel** — A ⚙️ gear button in the bottom bar (and right-click → "Settings…") opens a settings panel where you can pick any Google Drive folder as the desktop root. The desktop reloads showing just that folder's contents. A "Reset to My Drive root" button restores the default.
- **Folder child-count badges** — Folder icons now show accurate child counts from a background API fetch for folders that haven't been opened yet. Shows `?` while fetching, then switches to the real number. Previously the badge always showed `0` until the folder was opened.
- **New file format picker** — Right-click "New file" now shows three separate options: Google Doc, Google Sheet, and Google Slides — replacing the single ambiguous "New document" option.
- **Drive API** — Added `createSpreadsheet`, `createPresentation`, and `countChildren` to `src/api/drive.js`.

### Fixed
- **Snap reliability on load** — All icon positions loaded from cloud/local config are now run through `snapToGrid` during app initialisation. This prevents saved positions from being "between" grid cells after a session restore, which was causing misalignment on load.
- **Auto-arrange** — Now uses a shared `getAutoArrangePositions` function that respects fence membership and avoids placing desktop files inside fence bounds.

---

## [Fix: GIS auth prompt] — 2026-03-07 (`f27a668`)

### Fixed
- **"Params are not set" GIS error** — Google Identity Services throws this error when `requestAccessToken` is called with `prompt: ''` (empty string). Changed to `prompt: 'select_account'` so the account picker appears correctly and the error is avoided.

---

## [Fix: Grid snap unification] — 2026-03-07 (`efffa93`)

### Fixed
- **Drag snap and auto-arrange misalignment** — Manual drag snapping was using `0, 100, 200…` while `getInitialPositions` placed icons at `10, 110, 210…` (offset by the left/top margins). Introduced `GRID_ORIGIN_X = 10` and `GRID_ORIGIN_Y = 10` constants shared by `snapToGrid`, `getInitialPositions`, and the missing-positions `useEffect`, so all three systems always align to the same grid.

---

## [Fix: PWA icons] — 2026-03-07 (`434036a`)

### Fixed
- **Missing PWA icons (404)** — `public/icon-192.png` and `public/icon-512.png` were referenced in `manifest.json` but not included in the repository. Generated programmatically with PIL (green background + orange folder shape) and committed.

---

## [Fix: Google Client ID] — 2026-03-07 (`0c6d73d`)

### Fixed
- **OAuth `invalid_client` error** — Wired in the real Google OAuth Client ID (`752970574118-rpj1tej575v110okdg61cc05phrp3h1r.apps.googleusercontent.com`) into `src/config.js`, replacing the placeholder.
- **Google Drive scopes missing** — The Google Auth Platform "Data access" section was empty; the Drive scopes (`drive`, `drive.appdata`) were added there, resolving the subsequent 403 errors on file listing.

---

## [Fix: package-lock.json] — 2026-03-07 (`91972a3`)

### Fixed
- **GitHub Actions `npm ci` failure** — The deployment workflow uses `npm ci`, which requires a `package-lock.json`. Added the lockfile to the repository.

---

## [Initial Commit] — 2026-03-07 (`da58051`)

### Added
Full initial build of the UseAble Deskmat PWA, ported from the `desktop-files-v4.jsx` single-file prototype into a structured React/Vite project.

**Architecture**
- React 18 SPA with Vite 5 build tooling
- Google Drive API v3 for all file operations (list, move, copy, rename, trash, create)
- Google Identity Services (GIS) OAuth2 implicit/token flow — no backend required
- Progressive Web App — `manifest.json`, service worker, installable on Chromebook shelf
- Drive `appDataFolder` for hidden layout config sync (positions, fences, wallpaper)
- Local-first, cloud-sync architecture: instant `localStorage` write + 2-second debounced Drive save
- GitHub Actions deployment to GitHub Pages

**Features**
- Spatial desktop: files rendered as draggable icons at freeform positions on a canvas
- Grid snap: all positions snap to a 100px grid with 10px origin margins
- Desktop Fences: draggable, resizable, roll-up grouping containers
- Multi-select with Ctrl/Cmd+click; drag multiple files together
- Drag-and-drop into folders (with drop-target highlight and tooltip)
- Folder navigation with breadcrumb bar
- Right-click and long-press context menus (rename, duplicate, move, copy, delete, link, info)
- Wallpaper selector: 8 preset gradients + custom URL/base64 upload
- Auto-arrange: reflows all visible files onto the grid
- Snap to grid: corrects any off-grid positions
- New folder and new document creation from desktop context menu
- Folder/move picker with lazy-loaded Drive folder tree
- Sync indicator in bottom bar (idle / saving / saved / error)
- Sign in with Google; sign-out; session restore from `localStorage`
- Ambient radial highlight overlay and glass-morphism UI throughout
- Touch support: long-press for context menu, drag threshold detection, vibration feedback
