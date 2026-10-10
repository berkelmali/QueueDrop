// QueueDrop — Service Worker (PWA)
const CACHE_NAME = 'queuedrop-v4';

// Geliştirmede önbellek kapalı.
// Sebep: loopback'te çalışırken service worker eski JS'i servis edebiliyor;
// düzeltilmiş bir dosya tarayıcıya hiç ulaşmıyor ve saatlerce artık var
// olmayan bir hata aranıyor. PWA önbelleği yalnız gerçek dağıtımda devrede.
const IS_DEV = ['127.0.0.1', 'localhost', '[::1]', '::1'].indexOf(self.location.hostname) !== -1;
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/tokens.css',
  './css/index.css',
  './css/components.css',
  './css/animations.css',
  './js/auth.js',
  './js/parser.js',
  './js/spotify.js',
  './js/ui.js',
  './js/app.js',
  './js/enhance.js',
  './assets/logo.jpg',
  './manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  if (!IS_DEV) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
  }
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      // Geliştirmede hepsini sil; üretimde yalnız eski sürümleri.
      keys.filter(key => IS_DEV || key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// Fetch: Network First (with cache fallback)
self.addEventListener('fetch', (event) => {
  // Geliştirmede araya hiç girme: tarayıcı her zaman sunucudan alsın.
  if (IS_DEV) return;

  const url = new URL(event.request.url);

  if (url.hostname.includes('spotify.com') || url.hostname.includes('accounts.spotify')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      }))
  );
});
