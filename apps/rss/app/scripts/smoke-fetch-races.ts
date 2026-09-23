// Fetch-race smoke: superseded counts/feeds paints, busted cold-fetch restart,
// and last-starter-wins overlap resolution.
import { assert } from './smoke-assert';

// ---- superseded counts fetch cannot overwrite post-mark badges ----
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
    const libBody = JSON.stringify({
        folders: [],
        feeds: [{ id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0 }],
    });
    let resolveStale!: (v: Response) => void;
    let firstCounts = true;
    let countsCalls = 0;
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/counts')) {
            countsCalls += 1;
            if (firstCounts) {
                firstCounts = false;
                return new Promise<Response>((resolve) => {
                    resolveStale = resolve;
                });
            }
            return new Response(JSON.stringify({ counts: { a: 4 } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(path.endsWith('/api/library/feeds') ? libBody : JSON.stringify({ folders: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
    const json = (counts: Record<string, number>) =>
        new Response(JSON.stringify({ counts }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    try {
        bustCounts();
        const pendingA = fetchLibrary();
        for (let i = 0; i < 20 && countsCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(countsCalls === 1, 'stale fetch reaches the counts gate');
        bustCounts();
        const mergedB = await fetchLibrary();
        assert(mergedB.feeds[0].unread === 4, 'post-mark refetch paints exact badges');
        resolveStale(json({ a: 5 }));
        await pendingA;
        const cached = queryClient.getQueryData(['library']) as { feeds: Array<{ unread: number }> };
        assert(cached.feeds[0].unread === 4, 'late superseded fetch cannot overwrite badges');
        bustCounts();
        await fetchLibrary();
        assert(countsCalls === 3, 'dropped fetch does not re-arm the throttle');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- superseded feeds fetch cannot overwrite post-mark badges ----
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
    const feedA = JSON.stringify({
        feeds: [{ id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0 }],
    });
    let resolveStaleFeeds!: (v: Response) => void;
    let firstFeeds = true;
    let feedsCalls = 0;
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/feeds')) {
            feedsCalls += 1;
            if (firstFeeds) {
                firstFeeds = false;
                return new Promise<Response>((resolve) => {
                    resolveStaleFeeds = resolve;
                });
            }
            return new Response(feedA, { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (path.endsWith('/api/library/counts')) {
            return new Response(JSON.stringify({ counts: { a: 4 } }), {
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
        queryClient.setQueryData(['library'], {
            folders: [],
            feeds: [{ id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 5, addedAt: 0 }],
        });
        bustCounts();
        const pendingA = fetchLibrary();
        for (let i = 0; i < 20 && feedsCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(feedsCalls === 1, 'stale fetch reaches the feeds gate');
        bustCounts();
        const mergedB = await fetchLibrary();
        assert(mergedB.feeds[0].unread === 4, 'post-mark refetch paints exact badges');
        resolveStaleFeeds(new Response(feedA, { status: 200, headers: { 'Content-Type': 'application/json' } }));
        await pendingA;
        const cached = queryClient.getQueryData(['library']) as { feeds: Array<{ unread: number }> };
        assert(cached.feeds[0].unread === 4, 'late superseded feeds paint cannot overwrite badges');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- busted cold fetch restarts instead of stranding ----
{
    const { queryClient, libraryKey, fetchLibrary, bustCounts, invalidateLibrary, QueryController } =
        await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    let resolveParkedFolders!: (v: Response) => void;
    let firstFolders = true;
    let foldersCalls = 0;
    const jsonHeaders = { status: 200, headers: { 'Content-Type': 'application/json' } };
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/folders')) {
            foldersCalls += 1;
            if (firstFolders) {
                firstFolders = false;
                return new Promise<Response>((resolve) => {
                    resolveParkedFolders = resolve;
                });
            }
            return new Response(
                JSON.stringify({ folders: [{ id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0 }] }),
                jsonHeaders,
            );
        }
        if (path.endsWith('/api/library/feeds')) {
            return new Response(
                JSON.stringify({
                    feeds: [
                        { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0 },
                    ],
                }),
                jsonHeaders,
            );
        }
        return new Response(JSON.stringify({ counts: { a: 9 } }), jsonHeaders);
    };
    const host = { addController(_: unknown) {}, requestUpdate() {} };
    const ctl = new QueryController(host as never, () => ({ queryKey: libraryKey, queryFn: () => fetchLibrary() }));
    const wired = ctl as unknown as { hostConnected(): void; hostDisconnected(): void };
    try {
        queryClient.clear();
        bustCounts();
        wired.hostConnected();
        for (let i = 0; i < 50 && foldersCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(foldersCalls === 1, 'observer starts the cold fetch');
        bustCounts();
        await invalidateLibrary();
        resolveParkedFolders(new Response(JSON.stringify({ folders: [] }), jsonHeaders));
        for (let i = 0; i < 200; i++) {
            const cur = queryClient.getQueryData(libraryKey) as { feeds: Array<{ unread: number }> } | undefined;
            if (cur && cur.feeds.length === 1 && cur.feeds[0].unread === 9) break;
            await new Promise((r) => setTimeout(r, 0));
        }
        const cached = queryClient.getQueryData(libraryKey) as { feeds: Array<{ unread: number }> };
        assert(
            cached.feeds.length === 1 && cached.feeds[0].unread === 9,
            'busted cold fetch restarts and paints exact badges',
        );
    } finally {
        wired.hostDisconnected();
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- overlapping fetches resolve last-starter-wins ----
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
    const feedAs = (title: string) =>
        JSON.stringify({
            feeds: [{ id: 'a', title, url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0 }],
        });
    let resolveStaleFeeds!: (v: Response) => void;
    let firstFeeds = true;
    const jsonHeaders = { status: 200, headers: { 'Content-Type': 'application/json' } };
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/feeds')) {
            if (firstFeeds) {
                firstFeeds = false;
                return new Promise<Response>((resolve) => {
                    resolveStaleFeeds = resolve;
                });
            }
            return new Response(feedAs('B-new'), jsonHeaders);
        }
        if (path.endsWith('/api/library/counts')) {
            return new Response(JSON.stringify({ counts: {} }), jsonHeaders);
        }
        return new Response(JSON.stringify({ folders: [] }), jsonHeaders);
    };
    try {
        queryClient.clear();
        bustCounts();
        const pendingA = fetchLibrary();
        for (let i = 0; i < 20 && firstFeeds; i++) await new Promise((r) => setTimeout(r, 0));
        const mergedB = await fetchLibrary();
        assert(mergedB.feeds[0].title === 'B-new', 'newer fetch paints');
        resolveStaleFeeds(new Response(feedAs('A-stale'), jsonHeaders));
        await pendingA;
        const cached = queryClient.getQueryData(['library']) as { feeds: Array<{ title: string }> };
        assert(cached.feeds[0].title === 'B-new', 'older overlapping fetch paints nothing');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}
