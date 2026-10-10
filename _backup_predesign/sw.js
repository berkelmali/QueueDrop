// QueueDrop — Service Worker (PWA)
const CACHE_NAME = 'queuedrop-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/index.css',
  './css/components.css',
  './css/animations.css',
  './js/auth.js',
  './js/parser.js',
  './js/spotify.js',
  './js/ui.js',
  './js/app.js',
  './assets/logo.jpg',
  './manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network First (with cache fallback)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't cache Spotify API requests or auth requests
  if (url.hostname.includes('spotify.com') || url.hostname.includes('accounts.spotify')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network First for local resources, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
