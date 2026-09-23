// API client smoke: apiUrl joining, migrate payload shape, OPML import/export route.
import { apiUrl } from '../src/services/api';
import { buildMigratePayload } from '../src/services/migrate-export';
import { assert } from './smoke-assert';

// ---- api.ts: apiUrl joins base + path ----

assert(apiUrl('/library').endsWith('/api/library'), 'apiUrl appends path to /api base');
assert(apiUrl('/feeds').endsWith('/api/feeds'), 'apiUrl handles /feeds path');

// ---- migrate-export: buildMigratePayload shape + aff: filtering ----
const migrateFolders = [
    { id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0 },
    { id: 'f2', title: 'News', createdAt: 0, sortOrder: 1 },
];
const migrateFeeds = [
    { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0 },
    { id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: ['f1', 'f2'], unread: 0, addedAt: 0 },
];
const migrateArticles = [
    {
        id: 'a:1',
        feedId: 'a',
        guid: '1',
        title: 'Art 1',
        link: 'https://a.example/1',
        published: 0,
        fetchedAt: 0,
        read: 1 as const,
        starred: true,
        popularity: 1,
        hot: 0,
    },
    {
        id: 'b:2',
        feedId: 'b',
        guid: '2',
        title: 'Art 2',
        link: 'https://b.example/2',
        published: 0,
        fetchedAt: 0,
        read: 0 as const,
        starred: false,
        popularity: 1,
        hot: 0,
    },
];
const metaEntries = [
    { key: 'aff:feed:a', value: 5 },
    { key: 'aff:domain:example.com', value: 3 },
    { key: 'other-key', value: 'ignored' },
];
const payload = buildMigratePayload(migrateFolders, migrateFeeds, migrateArticles, metaEntries);
assert(payload.folders.length === 2, 'migrate payload has 2 folders');
assert(payload.feeds.length === 2, 'migrate payload has 2 feeds');
assert(payload.feeds[0].folderTitles?.join(',') === 'Tech', 'migrate payload maps folderIds to titles');
assert(payload.feeds[1].folderTitles?.join(',') === 'Tech,News', 'migrate payload maps multi-folder feed');
assert(payload.states.length === 2, 'migrate payload has 2 states');
assert(payload.states[0].read === true, 'migrate payload read=1 maps to true');
assert(payload.states[0].starred === true, 'migrate payload starred maps correctly');
assert(payload.states[1].read === false, 'migrate payload read=0 maps to false');
assert(payload.affinity.length === 2, 'migrate payload filters aff: keys only');
assert(
    payload.affinity.every((a) => a.key.startsWith('aff:')),
    'migrate payload affinity keys start with aff:',
);

// ---- OPML import/export route through the server library ----
{
    const { exportOpml, importOpmlXml } = await import('../src/services/api');
    const shims = globalThis as Record<string, unknown>;
    const seen: Array<{ url: string; auth: string | null; body: string | null }> = [];
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = { dispatchEvent: () => false };
    const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
    store?.setItem(
        'rss.auth.tokens',
        JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
    );
    shims['fetch'] = async (url: unknown, init?: { headers?: Record<string, string>; body?: unknown }) => {
        seen.push({
            url: String(url),
            auth: init?.headers?.['Authorization'] ?? null,
            body: typeof init?.body === 'string' ? init.body : null,
        });
        if (
            String(url).endsWith('/api/opml') &&
            (init as { method?: string } | undefined)?.method !== 'GET' &&
            seen.length === 1
        ) {
            return new Response(
                JSON.stringify({
                    addedFeeds: 2,
                    addedFolders: 1,
                    subscribedFeeds: 2,
                    skippedFeeds: 0,
                    folders: [{ id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0 }],
                    feeds: [
                        { id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0 },
                        { id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0 },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }
        return new Response('<opml></opml>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
    };
    try {
        const imported = await importOpmlXml('<opml></opml>');
        assert(imported.addedFeeds === 2 && imported.addedFolders === 1, 'OPML import returns server counts');
        assert(
            imported.feeds.length === 2 && imported.folders.length === 1,
            'OPML import returns names for instant paint',
        );
        assert(imported.feeds[0].folderIds.join(',') === 'f1', 'OPML import returns folder membership');
        assert(seen[0]?.auth === 'Bearer test-access', 'OPML import sends the Bearer token');
        assert(seen[0]?.body?.includes('<opml>') ?? false, 'OPML import posts the xml body');
        const exported = await exportOpml();
        assert(exported.includes('<opml>'), 'OPML export returns server xml');
        assert(seen[1]?.auth === 'Bearer test-access', 'OPML export sends the Bearer token');
    } finally {
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}
