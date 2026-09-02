/* Service worker: network-first shell. Never cache API traffic.
   VERSION is stamped per build by scripts/stamp-sw.mjs. */
const VERSION = 'rs-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest']
const INDEX_FALLBACK = new URL('./index.html', self.registration.scope).href
const API_PREFIX = new URL('./api/', self.registration.scope).pathname
const MAX_RUNTIME_ENTRIES = 300

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(VERSION)
            .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    )
})

async function trimRuntimeCache(cache) {
    const keys = await cache.keys()
    if (keys.length > MAX_RUNTIME_ENTRIES) {
        await Promise.all(keys.slice(0, keys.length - MAX_RUNTIME_ENTRIES).map((request) => cache.delete(request)))
    }
}

self.addEventListener('fetch', (event) => {
    const {request} = event
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return
    if (url.pathname.startsWith(API_PREFIX) || url.pathname.startsWith('/api/')) return
    event.respondWith(
        fetch(request)
            .then(async (response) => {
                if (response.ok) {
                    const copy = response.clone()
                    const cache = await caches.open(VERSION)
                    await cache.put(request, copy)
                    await trimRuntimeCache(cache)
                }
                return response
            })
            .catch(() =>
                caches.match(request).then((hit) => hit ?? caches.match(INDEX_FALLBACK)),
            ),
    )
})
