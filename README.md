# UseAble Deskmat

A spatial file manager for Google Drive — because some people think in places, not lists.

**Live app:** https://nicolasrowley-dev.github.io/UseAble-Deskmat/

---

## What it does

Presents your Google Drive files as freely-arrangeable icons on a visual canvas. Drag them where you want. They stay there. Positions sync across devices via a hidden config file in your Drive.

Key features: freeform spatial layout · Desktop Fences (named, collapsible groups) · folder navigation with per-folder layouts · full touch support · installable PWA · cross-device sync via Drive appDataFolder.

---

## Before you deploy — one required step

You need a Google Cloud OAuth Client ID. This is free and takes about 10 minutes.

See **`project prototype files/setup-guide.md`** → Part 1 for the full walkthrough. Once you have a Client ID, paste it into:

```
src/config.js  →  GOOGLE_CLIENT_ID: 'YOUR-CLIENT-ID-HERE.apps.googleusercontent.com'
```

Also add these to your OAuth client's authorised origins in Google Cloud Console:
- `http://localhost:5173` (local dev)
- `https://nicolasrowley-dev.github.io` (production)

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173/UseAble-Deskmat/
```

---

## Deploy

Push to `main`. GitHub Actions builds and deploys automatically.

First-time setup: Go to your repo → Settings → Pages → Source → GitHub Actions.

---

## Project structure

```
src/
├── App.jsx                Main desktop (auth + Drive wiring)
├── config.js              Client ID + constants
├── api/drive.js           Google Drive API wrapper
├── auth/google.js         OAuth sign-in / sign-out
├── hooks/useConfigSync.js Layout persistence (localStorage + Drive)
└── components/
    ├── BreadcrumbBar.jsx  Folder navigation bar
    ├── ContextMenu.jsx    Right-click / long-press menus
    ├── Dialogs.jsx        Rename, wallpaper, toast, sync indicator
    ├── Fence.jsx          Desktop fence (grouping container)
    ├── FileIcon.jsx       SVG icons per file type
    └── FolderPicker.jsx   Move/copy destination picker
public/
├── manifest.json          PWA manifest
└── sw.js                  Service worker
```

---

## Roadmap

- **Phase 1** ✅ Prototype — all UI interactions working with mock data
- **Phase 2** ✅ Drive integration — real files, auth, all operations wired to Drive API
- **Phase 3** Polish — real thumbnails, animations, keyboard shortcuts, search
- **Phase 4** Extended — multiple desktops, pinned files, smart groups, widgets
- **Phase 5** Platform expansion — Android wrapper, Chrome new tab extension
