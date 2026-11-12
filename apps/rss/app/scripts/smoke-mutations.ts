// Mutation smoke: mark-before cutoff posting, open/star revert-on-failure,
// and card thumbnail derivation from content.
import { firstImageUrl } from '../src/services/image';
import type { Article } from '../src/types';
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
        assert(
            seen.length === 1 && seen[0]!.url.endsWith('/api/articles/read-before'),
            'mark-before posts read-before',
        );
        assert(seen[0]!.body?.includes('1700000000000') ?? false, 'mark-before posts the cutoff');
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
        // Typed as Article[] so `read` is the `0 | 1` union the real type declares.
        // Without the annotation it widens to `number`, which is not assignable, and
        // an `as const` on the literal makes every later `read === 1` comparison read
        // as impossible. The annotation fixes both.
        const openHost: { items: Article[]; cursor: number; dispatchEvent(): boolean; library: object } = {
            items: [
                {
                    id: 'a:1',
                    feedId: 'a',
                    guid: '1',
                    title: 'A',
                    published: 0,
                    fetchedAt: 0,
                    read: 0,
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
        await openArticleAction(openHost as never, openHost.items[0]!);
        assert(openHost.items[0]!.read === 1, 'successful open leaves the row read');
        fail = true;
        openHost.items[0]!.read = 0;
        await openArticleAction(openHost as never, openHost.items[0]!);
        assert(openHost.items[0]!.read === 0, 'failed open reverts the row to unread');

        const starHost: { items: Article[] } = {
            items: [{ ...openHost.items[0]!, read: 1, starred: false }],
        };
        fail = false;
        await toggleStarAction(starHost as never, starHost.items[0]!);
        assert(starHost.items[0]!.starred === true, 'successful star leaves the star on');
        fail = true;
        starHost.items[0]!.starred = false;
        await toggleStarAction(starHost as never, starHost.items[0]!);
        assert(starHost.items[0]!.starred === false, 'failed star reverts to unstarred');
    } finally {
        readQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- a failed refresh toasts instead of stranding "Refreshing…" ----
{
    const { refreshViewAction } = await import('../src/web-components/article-list/article-list-actions');
    const { clearToasts, onToast } = await import('../src/services/toast');
    const { queryClient: refreshQueryClient } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    shims['fetch'] = async () =>
        new Response(JSON.stringify({ error: 'internal error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    const seen: string[] = [];
    const stop = onToast((notices) => {
        seen.push(...notices.map((n) => n.message));
    });
    const makeHost = () => {
        const active = new Set<string>();
        return {
            host: {
                view: { kind: 'all' },
                jobs: new Map<string, Promise<void>>(),
                setRefreshingKey: (key: string, on: boolean) => {
                    if (on) active.add(key);
                    else active.delete(key);
                },
                feedsFor: () => [],
                libraryFeeds: () => [],
                refreshTick: async () => {},
                isAlive: () => true,
                reset: async () => {
                    resets += 1;
                },
            } as never,
            active,
        };
    };
    let resets = 0;
    try {
        clearToasts();
        const { host, active } = makeHost();
        let ticks = 0;
        (host as { refreshTick: () => Promise<void> }).refreshTick = async () => {
            ticks += 1;
        };
        await refreshViewAction(host, 'all');
        assert(
            seen.some((m) => m.includes('Could not refresh')),
            'a failed refresh surfaces a notice instead of failing silently',
        );
        assert(active.size === 0, 'a failed refresh still clears the refreshing flag');
        assert(resets === 1, 'a failed refresh still reloads the view');
        assert(ticks === 0, 'a failed queue skips the ingest watch');
    } finally {
        stop();
        refreshQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- mashing Refresh on one folder joins its job; another folder runs its own ----
{
    const { ingestDone, refreshViewAction, waitForIngest } =
        await import('../src/web-components/article-list/article-list-actions');
    const { queryClient: elevatorQueryClient } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    let syncCalls = 0;
    const syncBodies: Array<string | null> = [];
    let releaseSync!: () => void;
    const syncGate = new Promise<void>((resolve) => {
        releaseSync = resolve;
    });
    shims['fetch'] = async (url: unknown, init?: { body?: unknown }) => {
        if (String(url).includes('/api/sync')) {
            syncCalls += 1;
            syncBodies.push(typeof init?.body === 'string' ? init.body : null);
            await syncGate;
            return new Response(JSON.stringify({ queued: 2 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ counts: {} }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        const { queryClient: seedClient } = await import('../src/query');
        seedClient.setQueryData(['library'], {
            folders: [{ id: 'f1', title: 'Folder', createdAt: 0 }],
            feeds: [{ id: 'a', title: 'A', url: 'https://a.example', folderIds: ['f1'], unread: 0, addedAt: 0 }],
        });
        let resets = 0;
        const active = new Set<string>();
        const host = {
            view: { kind: 'folder', id: 'f1' },
            jobs: new Map<string, Promise<void>>(),
            setRefreshingKey: (key: string, on: boolean) => {
                if (on) active.add(key);
                else active.delete(key);
            },
            feedsFor: () => [{ id: 'a' }],
            libraryFeeds: () => [],
            refreshTick: async () => {},
            isAlive: () => true,
            reset: async () => {
                resets += 1;
            },
        } as never;
        const first = refreshViewAction(host, 'folder:f1');
        const second = refreshViewAction(host, 'folder:f1');
        releaseSync();
        await Promise.all([first, second]);
        assert(syncCalls === 1, 'mashing Refresh on one folder queues a single sync');
        assert(resets === 2, 'the joined job reloads the view on queue and on completion');
        assert(active.size === 0, 'the elevator job clears its key when the folder finishes');

        // A navigation mid-queue must not re-target the running job: it syncs
        // the pinned folder, waits on the pinned feeds, and skips resets
        // because the new view loads itself.
        seedClient.setQueryData(['library'], {
            folders: [
                { id: 'f1', title: 'Folder', createdAt: 0 },
                { id: 'f2', title: 'Other', createdAt: 0 },
            ],
            feeds: [
                { id: 'a', title: 'A', url: 'https://a.example', folderIds: ['f1'], unread: 0, addedAt: 0 },
                { id: 'b', title: 'B', url: 'https://b.example', folderIds: ['f2'], unread: 0, addedAt: 0 },
            ],
        });
        const moved = {
            view: { kind: 'folder', id: 'f1' } as { kind: 'folder'; id: string },
            jobs: new Map<string, Promise<void>>(),
            setRefreshingKey: (key: string, on: boolean) => {
                if (on) active.add(key);
                else active.delete(key);
            },
            feedsFor: (v: { id: string }) => (v.id === 'f1' ? [{ id: 'a' }] : [{ id: 'b' }]),
            libraryFeeds: () => [],
            refreshTick: async () => {},
            isAlive: () => true,
            reset: async () => {
                resets += 1;
            },
        };
        const callsBefore = syncCalls;
        const resetsBefore = resets;
        const moving = refreshViewAction(moved as never, 'folder:f1');
        moved.view = { kind: 'folder', id: 'f2' };
        await moving;
        assert(syncCalls === callsBefore + 1, 'a navigation mid-queue still queues exactly one sync');
        assert(
            (syncBodies[syncBodies.length - 1] ?? '').includes('"a"') &&
                !(syncBodies[syncBodies.length - 1] ?? '').includes('"b"'),
            'the running job syncs the pinned folder, not the navigated-to one',
        );
        assert(resets === resetsBefore, 'the moved-away job leaves the new view alone');
        assert(!active.has('folder:f1'), 'the moved-away job still clears its own key');

        assert(
            ingestDone([{ id: 'a', lastFetchedAt: 2_000 } as never], ['a', 'gone'], 1_000) === true,
            'ingest counts feeds missing mid-refresh as done',
        );
        assert(
            ingestDone([{ id: 'a', lastFetchedAt: 500 } as never], ['a'], 1_000) === false,
            'ingest waits while a feed still reports a pre-refresh fetch',
        );
        const fading = { feeds: [{ id: 'a', lastFetchedAt: null as number | null }] };
        const watchHost = {
            refreshTick: async () => {
                fading.feeds[0]!.lastFetchedAt = Date.now();
            },
            libraryFeeds: () => fading.feeds,
            isAlive: () => true,
        } as never;
        await waitForIngest(watchHost, ['a'], Date.now() - 1_000, 1, 1_000);
        assert((fading.feeds[0]!.lastFetchedAt ?? 0) > 0, 'the ingest watch resolves when the feed reports back');
        let stuckTicks = 0;
        const stuckHost = {
            refreshTick: async () => {
                stuckTicks += 1;
            },
            libraryFeeds: () => [{ id: 'a', lastFetchedAt: null }],
            isAlive: () => true,
        } as never;
        await waitForIngest(stuckHost, ['a'], Date.now(), 1, 30);
        assert(stuckTicks > 0 && stuckTicks < 20, 'the ingest watch gives up instead of pinning the button');
    } finally {
        elevatorQueryClient.clear();
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
