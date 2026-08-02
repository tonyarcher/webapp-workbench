// Service worker template — do not edit dist/sw.js (it's generated).
// `npm run build` rewrites dist/sw.js via scripts/write-sw.mjs, embedding the
// hashed bundle list (__ASSETS__) and a content-derived cache name
// (__CACHE_HASH__) so updated builds always get fresh caches without manual
// version bumps.
//
// Strategy: precache the app shell and every hashed build asset on install
// (fresh installs work fully offline on the first relaunch), cache-first for
// same-origin static assets, network-first for navigations with an offline
// fallback to the cached index.html.
const ASSETS = __ASSETS__;
const CACHE = 'rss-reader-' + __CACHE_HASH__;
const CACHE_PREFIX = 'rss-reader-';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(async (cache) => {
            await Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})));
        }),
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (event) => {
    const {request} = event;
    if (request.method !== 'GET') return;
    if (new URL(request.url).origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Only cache successful navigations so a server error can't
                    // overwrite the offline fallback.
                    if (response.ok) {
                        const copy = response.clone();
                        void caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
                    }
                    return response;
                })
                .catch(() => caches.match('/index.html')),
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((hit) => {
            if (hit) return hit;
            return fetch(request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    void caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        }),
    );
});
