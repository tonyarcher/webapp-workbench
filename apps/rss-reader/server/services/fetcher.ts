import {FETCH_TIMEOUT_MS, MAX_FEED_BYTES} from '../env.js';

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

export async function fetchFeedText(url: string, cond: FetchCondition = {}): Promise<FetchResult> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http/https URLs are allowed');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const headers: Record<string, string> = {
            'User-Agent': 'rss-reader-server/0.1',
            'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        };
        if (cond.etag) headers['If-None-Match'] = cond.etag;
        if (cond.lastModified) headers['If-Modified-Since'] = cond.lastModified;

        const resp = await fetch(url, {
            signal: controller.signal,
            headers,
            redirect: 'follow',
        });

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

        const text = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));

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
