// Query smoke: staged library fetch (folders -> names -> counts), optimistic
// reorder/move, and badge-count throttling.
import { assert } from './smoke-assert';

// ---- library fetch paints folders, then names, then badges ----
{
    const { queryClient, libraryKey, fetchLibrary, bustCounts } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    const realSet = queryClient.setQueryData.bind(queryClient) as (...a: never[]) => unknown;
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    const order: string[] = [];
    const paints: Array<{ folders: number; unread: Array<[string, number]> }> = [];
    queryClient.setQueryData(libraryKey, {
        folders: [],
        feeds: [
            { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 5, addedAt: 0 },
            { id: 'z', title: 'Z', url: 'https://z.example/rss', folderIds: [], unread: 9, addedAt: 0 },
        ],
    });
    (queryClient as { setQueryData: (...a: never[]) => unknown }).setQueryData = (...a: never[]) => {
        const out = realSet(...a);
        const cur = queryClient.getQueryData(libraryKey) as {
            folders: unknown[];
            feeds: Array<{ id: string; unread: number }>;
        };
        paints.push({ folders: cur.folders.length, unread: cur.feeds.map((f) => [f.id, f.unread]) });
        return out;
    };
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/counts')) {
            order.push('counts');
            return new Response(JSON.stringify({ counts: { a: 7 } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (path.endsWith('/api/library/feeds')) {
            order.push('feeds');
            return new Response(
                JSON.stringify({
                    feeds: [
                        { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0 },
                        { id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0 },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }
        order.push('folders');
        return new Response(JSON.stringify({ folders: [{ id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0 }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        const merged = await fetchLibrary();
        assert(order.join(',') === 'folders,feeds,counts', 'library fetches folders before names before counts');
        assert(paints.length === 3, 'library paints three stages');
        assert(paints[0].folders === 1 && paints[0].unread.length === 2, 'folders paint before feed names');
        assert(
            JSON.stringify(paints[1].unread) ===
                JSON.stringify([
                    ['a', 5],
                    ['b', 0],
                ]),
            'names keep seen badges without flashing to zero',
        );
        assert(merged.feeds[0].unread === 7, 'library merges counts into badges');
        const cached = queryClient.getQueryData(libraryKey) as { feeds: Array<{ unread: number }> };
        assert(cached.feeds[0].unread === 7, 'merged library survives in cache');

        shims['fetch'] = async (url: unknown) => {
            if (String(url).endsWith('/api/library/counts')) {
                return new Response(JSON.stringify({ error: 'internal error' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (String(url).endsWith('/api/library/feeds')) {
                return new Response(
                    JSON.stringify({
                        feeds: [
                            { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0 },
                            { id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0 },
                        ],
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } },
                );
            }
            return new Response(JSON.stringify({ folders: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };
        const fallback = await (async () => {
            bustCounts();
            return fetchLibrary();
        })();
        assert(fallback.feeds.length === 2 && fallback.feeds[0].unread === 7, 'counts failure keeps seen badges');

        shims['fetch'] = async (url: unknown) => {
            if (String(url).endsWith('/api/library/folders')) {
                return new Response(JSON.stringify({ folders: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({ error: 'internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        };
        queryClient.clear();
        const rejects: boolean[] = [];
        for (let i = 0; i < 2; i++) {
            try {
                await fetchLibrary();
                rejects.push(false);
            } catch {
                rejects.push(true);
            }
        }
        assert(rejects.join(',') === 'true,true', 'cold feeds failure rejects on first try and retry so Retry shows');

        queryClient.setQueryData(libraryKey, {
            folders: [],
            feeds: [{ id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 4, addedAt: 0 }],
        });
        const warm = await fetchLibrary();
        assert(warm.feeds.length === 1 && warm.feeds[0].unread === 4, 'warm feeds failure keeps painted feeds');

        shims['fetch'] = async () =>
            new Response(JSON.stringify({ error: 'internal error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        const warmFolders = await fetchLibrary();
        assert(
            warmFolders.feeds.length === 1 && warmFolders.feeds[0].unread === 4,
            'warm folders failure keeps painted library',
        );
    } finally {
        (queryClient as { setQueryData: (...a: never[]) => unknown }).setQueryData = realSet;
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- folder reorder paints optimistically ----
{
    const { queryClient, libraryKey } = await import('../src/query');
    const { moveFeed, reorderFolders } = await import('../src/mutations');
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
        queryClient.setQueryData(libraryKey, {
            folders: [
                { id: 'f1', title: 'A', createdAt: 0, sortOrder: 0 },
                { id: 'f2', title: 'B', createdAt: 1, sortOrder: 1 },
            ],
            feeds: [{ id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0 }],
        });
        await reorderFolders(['f2', 'f1']);
        const ordered = queryClient.getQueryData(libraryKey) as { folders: Array<{ id: string }> };
        assert(ordered.folders.map((f) => f.id).join(',') === 'f2,f1', 'reorder paints the new order immediately');
        assert(seen[0]?.url.endsWith('/api/folders/reorder') ?? false, 'reorder posts the order');
        assert(seen[0]?.body?.includes('"f2","f1"') ?? false, 'reorder posts ids in drop order');

        await moveFeed('a', 'f2');
        const moved = queryClient.getQueryData(libraryKey) as { feeds: Array<{ folderIds: string[] }> };
        assert(moved.feeds[0].folderIds.join(',') === 'f2', 'feed move paints the new folder immediately');
        assert(seen[1]?.url.endsWith('/api/feeds/a/folders') ?? false, 'feed move posts membership');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- badge counts throttle to one aggregate per window ----
{
    const { queryClient, fetchLibrary, bustCounts } = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    let countsCalls = 0;
    shims['fetch'] = async (url: unknown) => {
        if (String(url).endsWith('/api/library/counts')) {
            countsCalls += 1;
            return new Response(JSON.stringify({ counts: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (String(url).endsWith('/api/library/feeds')) {
            return new Response(JSON.stringify({ feeds: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ folders: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    try {
        bustCounts();
        await fetchLibrary();
        await fetchLibrary();
        assert(countsCalls === 1, 'background refetches reuse fresh counts');
        bustCounts();
        await fetchLibrary();
        assert(countsCalls === 2, 'read mutations bust counts for exact badges');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}
