// Keeps the app working offline.
const CACHE = 'kay-tracker-v3';
const ASSETS = ['./', './index.html', './styles.css', './pass.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates show at once; the cached copy is used when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || (url.origin !== location.origin && e.request.url !== 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js')) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || Response.error())));
});
