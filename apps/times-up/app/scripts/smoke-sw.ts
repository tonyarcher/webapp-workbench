// Service-worker smoke: API and authenticated requests must never enter caches.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { assert } from './smoke-assert';

interface SwRequest {
    method: string;
    url: string;
    mode: string;
    headers: { has(name: string): boolean };
}

interface SwFetchEvent {
    request: SwRequest;
    respondWith(response: Promise<Response>): void;
}

type FetchHandler = (event: SwFetchEvent) => void;

const template = await readFile(fileURLToPath(new URL('./sw.template.js', import.meta.url)), 'utf8');
const source = template.replaceAll('__ASSETS__', '[]').replaceAll('__CACHE_HASH__', "'test'");
let fetchHandler: FetchHandler | undefined;
const origin = 'https://reader.example';
let cacheLookups = 0;
runInNewContext(source, {
    URL,
    Response,
    fetch: async () => new Response('network'),
    caches: {
        match: async () => {
            cacheLookups++;
            return undefined;
        },
        open: async () => ({ put: async () => undefined }),
    },
    self: {
        location: { origin },
        registration: { scope: `${origin}/times-up/` },
        clients: { claim: async () => undefined },
        addEventListener: (type: string, handler: FetchHandler) => {
            if (type === 'fetch') fetchHandler = handler;
        },
    },
});
assert(fetchHandler !== undefined, 'service worker installs a fetch handler');
if (!fetchHandler) throw new Error('missing fetch handler');
const handler = fetchHandler;

function route(url: string, authorization = false, method = 'GET'): { responded: boolean; cached: boolean } {
    let responded = false;
    const before = cacheLookups;
    handler({
        request: {
            url,
            method,
            mode: 'cors',
            headers: { has: (name) => authorization && name.toLowerCase() === 'authorization' },
        },
        respondWith: () => {
            responded = true;
        },
    });
    return { responded, cached: cacheLookups > before };
}

const subpathApi = route(`${origin}/times-up/api/articles`);
assert(subpathApi.responded && !subpathApi.cached, 'subpath API requests bypass the cache');
const configuredApi = route(`${origin}/custom/api/articles`);
assert(configuredApi.responded && !configuredApi.cached, 'configured API prefixes bypass the cache');
const identityApi = route(`${origin}/user-api/oauth/authorize`);
assert(identityApi.responded && !identityApi.cached, 'identity API paths bypass the cache');
const authorized = route(`${origin}/times-up/assets/app.js`, true);
assert(authorized.responded && !authorized.cached, 'authorized requests bypass the cache');
const staticAsset = route(`${origin}/times-up/assets/app.js`);
assert(staticAsset.responded && staticAsset.cached, 'static assets remain cacheable');
assert(!route(`${origin}/times-up/api/articles`, false, 'POST').responded, 'non-GET requests are left to the browser');
assert(!route('https://other.example/data').responded, 'cross-origin requests are left to the browser');
