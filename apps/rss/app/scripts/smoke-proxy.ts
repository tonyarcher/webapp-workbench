// Proxy smoke: feed URL validation, response size cap, abort-to-timeout mapping.
import { fetchFeedText, FetchError, validateFeedUrl } from '../src/services/proxy';
import { assert } from './smoke-assert';

// ---- proxy: URL validation, size limit, timeout mapping ----
assert(
    validateFeedUrl('https://example.com/feed.xml') === 'https://example.com/feed.xml',
    'validateFeedUrl accepts absolute https',
);
assert(
    validateFeedUrl(' http://example.com/feed ') === 'http://example.com/feed',
    'validateFeedUrl trims and accepts absolute http',
);
const invalidUrls: [string, string][] = [
    ['javascript:alert(1)', 'javascript: scheme'],
    ['data:text/html,x', 'data: scheme'],
    ['ftp://example.com/feed', 'ftp: scheme'],
    ['/relative/path', 'relative path'],
    ['https://user:pass@example.com/', 'embedded credentials'],
];
for (const [url, label] of invalidUrls) {
    let rejected = false;
    try {
        validateFeedUrl(url);
    } catch {
        rejected = true;
    }
    assert(rejected, `validateFeedUrl rejects ${label}`);
}

const g2 = globalThis as unknown as Record<string, unknown>;
const realFetch = g2.fetch;
try {
    g2.fetch = async () => new Response('<rss/>', { status: 200 });
    assert((await fetchFeedText('https://ok.example/feed')) === '<rss/>', 'fetchFeedText returns the proxied body');

    g2.fetch = async () => {
        const chunk = new Uint8Array(1024 * 1024);
        return new Response(
            new ReadableStream({
                start(controller) {
                    for (let i = 0; i < 6; i++) controller.enqueue(chunk);
                    controller.close();
                },
            }),
            { status: 200 },
        );
    };
    let oversized = false;
    try {
        await fetchFeedText('https://ok.example/big', 0);
    } catch (err) {
        oversized = err instanceof FetchError && err.message === 'Feed is too large';
    }
    assert(oversized, 'fetchFeedText rejects oversized responses');

    g2.fetch = async () => {
        throw new DOMException('aborted', 'AbortError');
    };
    let timedOut = false;
    try {
        await fetchFeedText('https://ok.example/slow', 0);
    } catch (err) {
        timedOut = err instanceof FetchError && err.message.includes('timed out');
    }
    assert(timedOut, 'fetchFeedText maps aborts to a timeout FetchError');
} finally {
    g2.fetch = realFetch;
}
