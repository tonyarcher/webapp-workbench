// Excerpt-on-scroll: one narrow request per article, cached, never a body read.
import { cachedArticleExcerpt, clearArticleExcerpts, loadArticleExcerpt } from '../src/services/excerpts';
import { assert } from './smoke-assert';

const shims = globalThis as Record<string, unknown>;
const realFetch = shims['fetch'];
const realWindow = shims['window'];
const calls: string[] = [];
shims['window'] = { dispatchEvent: () => false };
const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
store?.setItem(
    'rss.auth.tokens',
    JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
);
shims['fetch'] = async (url: unknown) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ excerpt: 'visible excerpt' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

try {
    clearArticleExcerpts();
    const first = await loadArticleExcerpt('a:1');
    assert(first === 'visible excerpt', 'a visible row loads its excerpt');
    assert(calls.length === 1, 'the excerpt is requested once');
    assert(calls[0]!.endsWith('/api/articles/a%3A1/excerpt'), 'excerpt reads use the excerpt route');
    assert(!calls[0]!.includes('/body'), 'excerpt reads never request the stored body');
    assert(cachedArticleExcerpt('a:1') === first, 'the loaded excerpt is cached for later paints');

    const second = await loadArticleExcerpt('a:1');
    assert(second === first && calls.length === 1, 'a second row paint reuses the cached excerpt');
} finally {
    shims['fetch'] = realFetch;
    shims['window'] = realWindow;
    clearArticleExcerpts();
}
