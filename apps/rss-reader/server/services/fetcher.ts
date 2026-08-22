import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {FETCH_TIMEOUT_MS, MAX_FEED_BYTES} from '../env.js';

// ---- SSRF guard ----

const MAX_REDIRECTS = 5;

function isPrivateIp(ip: string): boolean {
    // IPv4-mapped IPv6 literals (::ffff:127.0.0.1) connect as plain IPv4 —
    // normalize before checking, and treat any other ::ffff: form (hex
    // notation like ::ffff:7f00:1) as private outright.
    const lower = ip.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const mapped = lower.slice(7);
        return isIP(mapped) === 4 ? isPrivateIp(mapped) : true;
    }
    if (isIP(ip) === 4) {
        const parts = ip.split('.').map(Number);
        // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16,
        // 100.64/10 (CGNAT — cloud metadata ranges live here)
        return (
            parts[0] === 0 ||
            parts[0] === 10 ||
            parts[0] === 127 ||
            (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
            (parts[0] === 169 && parts[1] === 254) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
        );
    }
    // ::1, fc00::/7 (ULA), fe80::/10 (link-local), unspecified
    return (
        lower === '::1' ||
        lower === '::' ||
        lower.startsWith('fc') ||
        lower.startsWith('fd') ||
        lower.startsWith('fe8') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb')
    );
}

/**
 * Resolves the hostname and rejects private/loopback/link-local targets.
 * The API is anonymous, so without this it is an open SSRF proxy into the
 * Docker network (postgres, metadata endpoints, etc.). Re-run on every
 * redirect hop — a public URL can 302 into the intranet.
 */
async function assertPublicHost(url: URL): Promise<void> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http/https URLs are allowed');
    }
    if (url.username || url.password) {
        throw new Error('URLs with credentials are not allowed');
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error('Refusing to fetch a private address');
        return;
    }
    try {
        const records = await lookup(hostname, {all: true, verbatim: true});
        if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
            throw new Error('Refusing to fetch a private address');
        }
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('Refusing')) throw err;
        throw new Error(`Could not resolve feed host: ${hostname}`);
    }
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

export async function fetchFeedText(rawUrl: string, cond: FetchCondition = {}): Promise<FetchResult> {
    let current = new URL(rawUrl);
    await assertPublicHost(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const headers: Record<string, string> = {
            'User-Agent': 'rss-reader-server/0.1',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        };
        if (cond.etag) headers['If-None-Match'] = cond.etag;
        if (cond.lastModified) headers['If-Modified-Since'] = cond.lastModified;

        // Redirects handled manually so each hop re-runs the SSRF check.
        let resp: Response;
        for (let hop = 0; ; hop++) {
            resp = await fetch(current, {signal: controller.signal, headers, redirect: 'manual'});
            const location = resp.headers.get('location');
            if (resp.status >= 300 && resp.status < 400 && location) {
                if (hop >= MAX_REDIRECTS) throw new Error('Too many redirects');
                current = new URL(location, current);
                await assertPublicHost(current);
                continue;
            }
            break;
        }

        clearTimeout(timer);

        if (resp.status === 304) {
            return {
                status: 304,
                etag: resp.headers.get('etag') ?? undefined,
                lastModified: resp.headers.get('last-modified') ?? undefined,
            };
        }

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        // Stream-read with byte cap
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

        const text = Buffer.concat(chunks).toString('utf8');

        return {
            status: 200,
            text,
            etag: resp.headers.get('etag') ?? undefined,
            lastModified: resp.headers.get('last-modified') ?? undefined,
        };
    } catch (err) {
        clearTimeout(timer);
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw err;
    }
}
