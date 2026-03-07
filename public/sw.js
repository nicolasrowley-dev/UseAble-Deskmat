// ─── UseAble Deskmat Service Worker ───
// Cache-first for static assets, network-first for Google API calls.
// This gives the app its offline capability and enables PWA install.

const CACHE_NAME = 'deskmat-v1';
const STATIC_ASSETS = [
  '/UseAble-Deskmat/',
  '/UseAble-Deskmat/index.html',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for APIs, cache-first for app shell
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Always go to network for Google APIs (auth, Drive)
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (app shell, assets)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/UseAble-Deskmat/index.html'))
  );
});
