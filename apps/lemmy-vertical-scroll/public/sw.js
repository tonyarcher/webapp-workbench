/* Service worker: network-first shell caching. API and media requests are
   never intercepted — the app needs a live connection for feed data. */
const VERSION = 'lvs-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(VERSION)
            .then((cache) => cache.addAll(SHELL))
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

self.addEventListener('fetch', (event) => {
    const {request} = event
    if (request.method !== 'GET') return
    const url = new URL(request.url)
    if (url.origin !== self.location.origin) return
    if (url.pathname.startsWith('/api/')) return
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone()
                    void caches.open(VERSION).then((cache) => cache.put(request, copy))
                }
                return response
            })
            .catch(() =>
                caches.match(request).then((hit) => hit ?? caches.match('/index.html')),
            ),
    )
})
