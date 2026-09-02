import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {Agent, type Dispatcher} from 'undici';
import {FETCH_TIMEOUT_MS, MAX_FEED_BYTES} from '../env.js';

// ---- SSRF guard ----

const MAX_REDIRECTS = 5;

function firstOctetPrivate(p0: number): boolean {
    return p0 === 0 || p0 === 10 || p0 === 127;
}

function isCgnat(p: number[]): boolean {
    return p[0] === 100 && p[1] >= 64 && p[1] <= 127;
}

function isLinkLocal(p: number[]): boolean {
    return p[0] === 169 && p[1] === 254;
}

function isPrivate172(p: number[]): boolean {
    return p[0] === 172 && p[1] >= 16 && p[1] <= 31;
}

function isPrivate192(p: number[]): boolean {
    return p[0] === 192 && p[1] === 168;
}

function isPrivateIpv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (firstOctetPrivate(parts[0])) return true;
    if (isCgnat(parts)) return true;
    if (isLinkLocal(parts)) return true;
    if (isPrivate172(parts)) return true;
    return isPrivate192(parts);
}

function isPrivateIpv6Lower(lower: string): boolean {
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb');
}

export function isPrivateIp(ip: string): boolean {
    const lower = ip.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const mapped = lower.slice(7);
        return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
    }
    if (isIP(ip) === 4) return isPrivateIpv4(ip);
    return isPrivateIpv6Lower(lower);
}

/**
 * Resolves the hostname and rejects private/loopback/link-local targets.
 * The API is anonymous, so without this it is an open SSRF proxy into the
 * Docker network (postgres, metadata endpoints, etc.). Re-run on every
 * redirect hop — a public URL can 302 into the intranet.
 */
function assertProtocol(url: URL): void {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http/https URLs are allowed');
}

function assertNoCreds(url: URL): void {
    if (url.username || url.password) throw new Error('URLs with credentials are not allowed');
}

async function assertDns(hostname: string): Promise<void> {
    try {
        const records = await lookup(hostname, {all: true, verbatim: true});
        if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) throw new Error('Refusing to fetch a private address');
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('Refusing')) throw err;
        throw new Error(`Could not resolve feed host: ${hostname}`);
    }
}

async function assertPublicHost(url: URL): Promise<void> {
    assertProtocol(url);
    assertNoCreds(url);
    if (process.env.RSS_ALLOW_LOCAL_FETCH === '1') return;
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error('Refusing to fetch a private address');
        return;
    }
    await assertDns(hostname);
}

// ---- conditional GET ----

export interface FetchResult {
    status: 200 | 304;
    text?: string;
    etag?: string;
    lastModified?: string;
}

export interface FetchCondition {
    etag?: string;
    lastModified?: string;
}

function buildHeaders(cond: FetchCondition): Record<string, string> {
    const h: Record<string, string> = {
        'User-Agent': 'rss-reader-server/0.1',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    };
    if (cond.etag) h['If-None-Match'] = cond.etag;
    if (cond.lastModified) h['If-Modified-Since'] = cond.lastModified;
    return h;
}

let ssrfDispatcher: Dispatcher | null = null;

function getSsrfDispatcher(): Dispatcher {
    if (ssrfDispatcher) return ssrfDispatcher;
    ssrfDispatcher = new Agent({
        connect: {
            lookup(hostname, options, cb) {
                lookup(hostname, {...options, all: true})
                    .then((records) => {
                        const list = Array.isArray(records) ? records : [records];
                        if (list.length === 0) {
                            return cb(new Error(`Could not resolve feed host: ${hostname}`), '', 4);
                        }
                        if (process.env.RSS_ALLOW_LOCAL_FETCH !== '1' && list.some((r) => isPrivateIp(r.address))) {
                            return cb(new Error('Refusing to fetch a private address'), '', 4);
                        }
                        cb(null, list);
                    })
                    .catch((err: NodeJS.ErrnoException) => cb(err, '', 4));
            },
        },
    });
    return ssrfDispatcher;
}

async function fetchWithRedirects(start: URL, headers: Record<string, string>, signal: AbortSignal): Promise<Response> {
    let current = start;
    for (let hop = 0; ; hop++) {
        const resp = await fetch(current, {
            signal,
            headers,
            redirect: 'manual',
            dispatcher: getSsrfDispatcher(),
        } as RequestInit);
        const location = resp.headers.get('location');
        if (resp.status >= 300 && resp.status < 400 && location) {
            if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects');
            current = new URL(location, current);
            await assertPublicHost(current);
            continue;
        }
        return resp;
    }
}

async function readBody(resp: Response): Promise<string> {
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('No response body');
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > MAX_FEED_BYTES) {
            reader.cancel();
            throw new Error('feed too large');
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
}

function result304(resp: Response): FetchResult {
    return {status: 304, etag: resp.headers.get('etag') ?? undefined, lastModified: resp.headers.get('last-modified') ?? undefined};
}

export async function fetchFeedText(rawUrl: string, cond: FetchCondition = {}): Promise<FetchResult> {
    const current = new URL(rawUrl);
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const headers = buildHeaders(cond);
        const resp = await fetchWithRedirects(current, headers, controller.signal);
        clearTimeout(timer);
        if (resp.status === 304) return result304(resp);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await readBody(resp);
        return {status: 200, text, etag: resp.headers.get('etag') ?? undefined, lastModified: resp.headers.get('last-modified') ?? undefined};
    } catch (err) {
        clearTimeout(timer);
        if (err instanceof DOMException && err.name === 'AbortError') throw new Error('Request timed out');
        throw err;
    }
}
