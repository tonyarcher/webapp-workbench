const CACHE_NAME = 'grand-slam-baseball-v4';
const scope = new URL(self.registration.scope).pathname;
const scopeRoot = scope === '/' ? '/' : scope;

// Base path for asset URLs, ending in '/'. At the root scope this is '/', so
// paths like `/index.html` are produced explicitly (never protocol-relative
// `//index.html`). Under a subpath like `/baseball/` the scope is preserved.
const assetBase = scopeRoot;

// Cache paths are derived from the service worker's registration scope so the
// worker works both at the app root (dev/tests) and under a subpath like
// `/baseball/` in production.
const ASSETS_TO_CACHE = [
  scopeRoot,
  `${assetBase}index.html`,
  `${assetBase}manifest.json`,
  `${assetBase}icons.svg`,
  `${assetBase}favicon.svg`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, copy);
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => cached || caches.match(`${assetBase}index.html`));
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, copy);
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => cached);
      })
  );
});
