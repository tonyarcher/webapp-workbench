const PROXIES = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?url='];
const FETCH_TIMEOUT_MS = 20_000;
const MAX_FEED_BYTES = 5 * 1024 * 1024;

export class FetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FetchError';
    }
}

/**
 * Accepts only absolute http(s) URLs (blocks javascript:, data:, credentials,
 * and other schemes before anything is sent to a proxy).
 */
export function validateFeedUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    try {
        const u = new URL(trimmed);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            throw new Error('unsupported scheme');
        }
        if (u.username || u.password) {
            throw new Error('credentials not allowed');
        }
        return u.href;
    } catch {
        throw new FetchError('Invalid feed URL — must be an absolute http(s) URL');
    }
}

async function readWithLimit(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) {
        const length = Number(response.headers.get('content-length') ?? 0);
        if (length > maxBytes) throw new FetchError('Feed is too large');
        return response.text();
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let total = 0;
    for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => {});
            throw new FetchError('Feed is too large');
        }
        out += decoder.decode(value, {stream: true});
    }
    return out + decoder.decode();
}

export async function fetchFeedText(rawUrl: string): Promise<string> {
    const url = validateFeedUrl(rawUrl);
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2_000));
        for (const proxy of PROXIES) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            try {
                const res = await fetch(proxy + encodeURIComponent(url), {signal: controller.signal});
                if (!res.ok) {
                    throw new FetchError(`Proxy responded ${res.status}`);
                }
                const text = await readWithLimit(res, MAX_FEED_BYTES);
                if (!text.trim()) throw new FetchError('Empty response');
                return text;
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    lastError = new FetchError('Feed fetch timed out');
                } else {
                    lastError = err;
                }
            } finally {
                clearTimeout(timer);
            }
        }
    }
    throw lastError ?? new FetchError('Could not fetch feed');
}
