/* AstroLogs — Service Worker v1.1 */
const CACHE = 'astrologs-v1';
const STATIC = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for APIs, cache-first for static
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Always go network for ISS/external APIs
  if (url.includes('wheretheiss.at') || url.includes('open-notify.org') || url.includes('wikimedia')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', {headers: {'Content-Type': 'application/json'}})));
    return;
  }
  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(response => {
      if (response && response.status === 200 && e.request.method === 'GET') {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return response;
    }))
  );
});
