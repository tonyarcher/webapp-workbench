// Mutation smoke: mark-before cutoff posting, open/star revert-on-failure,
// and card thumbnail derivation from content.
import { firstImageUrl } from '../src/services/parser';
import { assert } from './smoke-assert';

// ---- mark-before posts the cutoff and resets the view ----
{
    const { markBeforeAction } = await import('../src/web-components/article-list/article-list-actions');
    const { queryClient: markQueryClient } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    const seen: Array<{ url: string; body: string | null }> = [];
    shims['fetch'] = async (url: unknown, init?: { body?: unknown }) => {
        seen.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : null });
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        let resets = 0;
        const host = {
            view: { kind: 'all' },
            hideRead: false,
            reset: async () => {
                resets += 1;
            },
            folderFeeds: () => [],
        };
        await markBeforeAction(host as never, 1_700_000_000_000);
        assert(seen.length === 1 && seen[0].url.endsWith('/api/articles/read-before'), 'mark-before posts read-before');
        assert(seen[0].body?.includes('1700000000000') ?? false, 'mark-before posts the cutoff');
        assert(host.hideRead === true && resets === 1, 'mark-before hides read and resets the view');
    } finally {
        markQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- markArticleRead reports success so opens can revert ----
{
    const { markArticleRead } = await import('../src/mutations');
    const { queryClient: readQueryClient } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    let fail = false;
    shims['fetch'] = async () => {
        if (fail) {
            return new Response(JSON.stringify({ error: 'internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ ok: true, updated: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        assert((await markArticleRead('a:1')) === true, 'markArticleRead resolves true on success');
        fail = true;
        assert((await markArticleRead('a:2')) === false, 'markArticleRead resolves false when the write fails');

        const { openArticleAction, toggleStarAction } =
            await import('../src/web-components/article-list/article-list-actions');
        const openHost = {
            items: [
                {
                    id: 'a:1',
                    feedId: 'a',
                    guid: '1',
                    title: 'A',
                    published: 0,
                    fetchedAt: 0,
                    read: 0 as const,
                    starred: false,
                    popularity: 1,
                    hot: 0,
                },
            ],
            cursor: -1,
            dispatchEvent() {
                return false;
            },
            library: {},
        };
        fail = false;
        await openArticleAction(openHost as never, openHost.items[0]);
        assert(openHost.items[0].read === 1, 'successful open leaves the row read');
        fail = true;
        openHost.items[0].read = 0;
        await openArticleAction(openHost as never, openHost.items[0]);
        assert(openHost.items[0].read === 0, 'failed open reverts the row to unread');

        const starHost = { items: [{ ...openHost.items[0], read: 1 as const, starred: false }] };
        fail = false;
        await toggleStarAction(starHost as never, starHost.items[0]);
        assert(starHost.items[0].starred === true, 'successful star leaves the star on');
        fail = true;
        starHost.items[0].starred = false;
        await toggleStarAction(starHost as never, starHost.items[0]);
        assert(starHost.items[0].starred === false, 'failed star reverts to unstarred');
    } finally {
        readQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- image derivation (thumbnail without a dedicated column) ----
assert(
    firstImageUrl('<p>hi</p><img src="https://img.example/a.jpg">') === 'https://img.example/a.jpg',
    'firstImageUrl finds image in article content for card thumbnail',
);
assert(firstImageUrl('<p>no img</p>') === undefined, 'firstImageUrl returns undefined when content has no image');
assert(firstImageUrl(undefined) === undefined, 'firstImageUrl handles undefined content');
// Browser cards derive the thumbnail from content at render time, not
// from a persisted Article.image column.
const contentWithEnclosure = '<img src="https://media.example/thumb.jpg" alt="">' + '<p>Body</p>';
assert(
    firstImageUrl(contentWithEnclosure) === 'https://media.example/thumb.jpg',
    'firstImageUrl finds prepended enclosure image',
);
