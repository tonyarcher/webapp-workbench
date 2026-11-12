// Mutation smoke: mark-before cutoff posting, open/star revert-on-failure,
// bulk selection actions, mark-on-scroll claiming, and card thumbnail
// derivation from content.
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

// ---- bulk star writes once and teaches every selected title ----
{
    const { bulkStar } = await import('../src/mutations');
    const { queryClient: bulkQueryClient } = await import('../src/query');
    const { loadWordMap } = await import('../src/services/interesting-settings');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void };
    store.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    const seen: Array<{ url: string; body: string | null }> = [];
    shims['fetch'] = async (url: unknown, init?: { body?: unknown }) => {
        seen.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : null });
        return new Response(JSON.stringify({ ok: true, updated: 2 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        const ok = await bulkStar([
            { id: 's1', title: 'Shared Rust Story' },
            { id: 's2', title: 'Other Rust Tale' },
        ]);
        assert(ok === true, 'bulk star resolves true on success');
        const writes = seen.filter((s) => s.url.includes('/api/articles/state'));
        assert(writes.length === 1, 'bulk star writes the whole selection at once');
        assert(loadWordMap()['shared'] === 4 && loadWordMap()['other'] === 4, 'bulk star teaches every selected title');
        assert(loadWordMap()['rust'] === 8, 'bulk star weights shared words twice');
        shims['fetch'] = async () =>
            new Response(JSON.stringify({ error: 'internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        const { bulkStarAction } = await import('../src/web-components/article-list/article-list-selection');
        const selection = ['s1', 's2'];
        const clearSelection = () => {
            selection.length = 0;
        };
        await bulkStarAction({ items: [], selectedIds: selection, clearSelection } as never);
        assert(selection.join(',') === 's1,s2', 'an empty bulk selection writes nothing');
        const failHost = {
            items: [{ id: 's9', title: 'Unreachable Story', read: 0, starred: false }] as Article[],
            selectedIds: ['s9'],
            clearSelection: () => {},
            requestUpdate: () => {},
        };
        await bulkStarAction(failHost as never);
        assert(failHost.items[0]!.starred === false, 'a failed bulk star paints no stars');
        assert(failHost.selectedIds.join(',') === 's9', 'a failed bulk star keeps the selection for retry');
    } finally {
        bulkQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- mark-above claims only the scrolled-past unread rows ----
{
    const { markAboveAction, unreadIdsBefore } =
        await import('../src/web-components/article-list/article-list-selection');
    const { queryClient: aboveQueryClient } = await import('../src/query');
    const items = [
        { id: 'a', read: 0 },
        { id: 'b', read: 1 },
        { id: 'c', read: 0 },
    ] as Article[];
    assert(unreadIdsBefore(items, 0).length === 0, 'nothing scrolled past claims nothing');
    assert(unreadIdsBefore(items, 2).join(',') === 'a', 'mark-above skips already-read rows');
    assert(unreadIdsBefore(items, 9).join(',') === 'a,c', 'mark-above clamps to the loaded list');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    const dispatched: string[] = [];
    shims['window'] = {
        dispatchEvent: (e: Event) => {
            dispatched.push((e as CustomEvent<string>).detail);
            return false;
        },
    };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    shims['fetch'] = async () =>
        new Response(JSON.stringify({ ok: true, updated: 2 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    try {
        const host = { items, lastAutoMark: 0 };
        const mark = await markAboveAction(host as never, 3);
        assert(mark === 3, 'mark-above advances past the visible rows');
        assert(dispatched.join(',') === 'a,c', 'mark-above repaints exactly the claimed rows');
        const repeat = await markAboveAction(host as never, 2);
        assert(repeat === 3, 'mark-above never moves the mark backwards');
        shims['fetch'] = async () =>
            new Response(JSON.stringify({ error: 'internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        const before = dispatched.length;
        const failedMark = await markAboveAction({ items, lastAutoMark: 0 } as never, 3);
        assert(failedMark === 0, 'a failed write does not advance the mark');
        assert(dispatched.length === before, 'a failed write paints nothing and stays retryable');
    } finally {
        aboveQueryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- selection anchors start where the reader last touched ----
{
    const { clearSelectionAction, selectRangeAction, setAnchor, toggleSelectAction } =
        await import('../src/web-components/article-list/article-list-selection');
    const list = [
        { id: 'a', read: 0 },
        { id: 'b', read: 0 },
        { id: 'c', read: 0 },
        { id: 'd', read: 0 },
    ] as Article[];
    const host = { items: list, selectedIds: [] as string[], selectAnchor: -1, cursor: -1 };
    selectRangeAction(host as never, 2);
    assert(host.selectedIds.join(',') === 'c', 'shift-click with no anchor selects only the clicked row');
    setAnchor(host as never, 0);
    host.selectedIds = [];
    selectRangeAction(host as never, 2);
    assert(host.selectedIds.join(',') === 'a,b,c', 'shift-click extends from the clicked anchor');
    host.selectedIds = [];
    setAnchor(host as never, 3);
    selectRangeAction(host as never, 1);
    assert(host.selectedIds.join(',') === 'b,c,d', 'shift-click extends downwards too');
    toggleSelectAction(host as never, 2);
    assert(host.selectedIds.join(',') === 'b,d', 'the select key toggles one row off');
    clearSelectionAction(host as never);
    assert(host.selectedIds.length === 0 && host.selectAnchor === -1, 'clearing resets the anchor');
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
                refreshJobs: new Map<string, Promise<void>>(),
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
            refreshJobs: new Map<string, Promise<void>>(),
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
            refreshJobs: new Map<string, Promise<void>>(),
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
