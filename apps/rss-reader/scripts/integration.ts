// integration.ts — full integration tests for the Postgres-backed API server
// Run: tsx scripts/integration.ts
// Embeds a real Postgres, boots the server in-process, and drives it with fetch().

import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createHash} from 'node:crypto';
import {rm, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const srv = createServer();
        srv.listen(0, '127.0.0.1', () => {
            const addr = srv.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms);
        p.then(
            (v) => {
                clearTimeout(t);
                resolve(v);
            },
            (e) => {
                clearTimeout(t);
                reject(e);
            },
        );
    });
}

function makeArticleId(feedId: string, guid: string): string {
    return createHash('sha256').update(feedId + '\n' + guid).digest('hex');
}

async function waitFor<T>(
    fn: () => Promise<T>,
    predicate: (val: T) => boolean,
    label: string,
    timeoutMs = 5_000,
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T;
    while (true) {
        last = await fn();
        if (predicate(last)) return last;
        if (Date.now() > deadline) {
            throw new Error(`Timeout waiting for: ${label}`);
        }
        await new Promise((r) => setTimeout(r, 100));
    }
}

// ---- embedded postgres ----

let EmbeddedPostgresCtor: typeof import('embedded-postgres').default;
try {
    const mod = await import('embedded-postgres');
    EmbeddedPostgresCtor = mod.default;
} catch (err) {
    console.error('FATAL: embedded-postgres import failed. Install with: npm install');
    console.error(err);
    process.exit(1);
}

const PG_PORT = await freePort();
const DATA_DIR = fileURLToPath(new URL('../.tmp/integration-pg', import.meta.url));

try {
    await rm(DATA_DIR, {recursive: true, force: true});
} catch (err) {
    throw new Error(
        `Could not remove leftover ${DATA_DIR}. Kill leftover postgres.exe from a previous run and retry. ${err}`,
    );
}
await mkdir(DATA_DIR, {recursive: true});

const pg = new EmbeddedPostgresCtor({
    databaseDir: DATA_DIR,
    user: 'rss',
    password: 'rss',
    port: PG_PORT,
    persistent: false,
});

const REAL_FETCH = globalThis.fetch;

interface MockRequest {
    url: string;
    headers: Record<string, string>;
    status: number;
}

const mockRequestLog: MockRequest[] = [];

const SHARED_LINK = 'https://news.example.com/breaking';
const FEED_A_ITEMS = 12;
const FEED_A_URL = 'https://fixture-a.example/feed-a.xml';
const FEED_B_URL = 'https://fixture-b.example/feed-b.xml';
const FEED_DEAD_URL = 'https://fixture-dead.example/dead.xml';

function buildFeedA(): string {
    const items = [];
    for (let i = 0; i < FEED_A_ITEMS; i++) {
        const guid = `a-guid-${i}`;
        const link = i === 0 ? SHARED_LINK : `https://feed-a.example/item-${i}`;
        const pubDate = new Date(Date.now() - i * 60_000).toUTCString();
        const desc = i === 0
            ? `<p><img src="https://img.example/lead.jpg" alt="lead"/></p><p>Body text.</p>`
            : `<p>Item ${i} content</p>`;
        const extra = i === 2 ? '\n    <media:content url="https://media.example/clip.mp4" medium="video"/>' : '';
        items.push(`
    <item>
      <title>Feed A Item ${i}</title>
      <link>${link}</link>
      <guid>${guid}</guid>
      <pubDate>${pubDate}</pubDate>
      <slash:comments>${3 * (i + 1)}</slash:comments>
      <description><![CDATA[${desc}]]></description>${extra}
    </item>`);
    }
    return `<?xml version="1.0"?>
<rss version="2.0" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Feed A</title>
  <link>https://feed-a.example</link>${items.join('\n')}
</channel>
</rss>`;
}

function buildFeedB(): string {
    return `<?xml version="1.0"?>
<rss version="2.0" xmlns:slash="http://purl.org/rss/1.0/modules/slash/">
<channel>
  <title>Feed B</title>
  <link>https://feed-b.example</link>
  <item>
    <title>Feed B shared story</title>
    <link>${SHARED_LINK}</link>
    <guid>b-shared</guid>
    <pubDate>${new Date(Date.now() - 30_000).toUTCString()}</pubDate>
    <slash:comments>7</slash:comments>
    <description><p>Shared article from feed B</p></description>
  </item>
</channel>
</rss>`;
}

const feedAXml = buildFeedA();
const feedBXml = buildFeedB();

interface Session {
    cookie?: string;
}

function uid(session: Session): string {
    const id = session.cookie?.match(/rss_uid=([^;]+)/)?.[1];
    assert(!!id, 'session has rss_uid');
    return id;
}

let pgStarted = false;
let mockServer: ReturnType<typeof createServer> | undefined;
let closeSrv: (() => Promise<void>) | undefined;

try {
    await withTimeout(pg.initialise(), 60_000, 'embedded-postgres initialise');
    await withTimeout(pg.start(), 60_000, 'embedded-postgres start');
    pgStarted = true;

    try {
        await pg.createDatabase('rss_test');
    } catch {
        // database may already exist on re-runs; that's fine
    }

    const DATABASE_URL = `postgres://rss:rss@127.0.0.1:${PG_PORT}/rss_test`;

    process.env.DATABASE_URL = DATABASE_URL;
    process.env.PORT = '0';
    process.env.POLL_TICK_MS = '3600000';
    process.env.RSS_ALLOW_LOCAL_FETCH = '1';

    let feedADelayMs = 0;

    mockServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = `http://mock${req.url}`;
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k] = v;
        }

        let status = 404;
        if (req.url === '/feed-a.xml') {
            const reply = () => {
                res.writeHead(200, {'Content-Type': 'application/xml'});
                res.end(feedAXml);
                mockRequestLog.push({url, headers, status: 200});
            };
            if (feedADelayMs > 0) {
                setTimeout(reply, feedADelayMs);
            } else {
                reply();
            }
            return;
        } else if (req.url === '/feed-b.xml') {
            const ifNoneMatch = req.headers['if-none-match'];
            if (ifNoneMatch === '"v1"') {
                status = 304;
                res.writeHead(304);
                res.end();
            } else {
                status = 200;
                res.writeHead(200, {
                    'Content-Type': 'application/xml',
                    'ETag': '"v1"',
                });
                res.end(feedBXml);
            }
        } else if (req.url === '/dead.xml') {
            status = 403;
            res.writeHead(403);
            res.end('Forbidden');
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
        mockRequestLog.push({url, headers, status});
    });

    const MOCK_PORT = await freePort();
    await new Promise<void>((resolve, reject) => {
        mockServer!.once('error', reject);
        mockServer!.listen(MOCK_PORT, '127.0.0.1', () => resolve());
    });

    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.startsWith('http://mock') || url.startsWith('http://127.0.0.1')) {
            return REAL_FETCH.call(globalThis, input, init);
        }
        if (url.includes('feed-a.xml')) {
            return REAL_FETCH.call(globalThis, `http://127.0.0.1:${MOCK_PORT}/feed-a.xml`, init);
        }
        if (url.includes('feed-b.xml')) {
            return REAL_FETCH.call(globalThis, `http://127.0.0.1:${MOCK_PORT}/feed-b.xml`, init);
        }
        if (url.includes('dead.xml')) {
            return REAL_FETCH.call(globalThis, `http://127.0.0.1:${MOCK_PORT}/dead.xml`, init);
        }
        return REAL_FETCH.call(globalThis, input, init);
    };

    const {MAX_ARTICLES_PER_FEED} = await import('../server/env.ts');
    const {startServer} = await import('../server/app.ts');
    const started = await startServer(0, '127.0.0.1');
    closeSrv = () => started.close();
    const BASE = `http://127.0.0.1:${started.port}`;
    const {getPool} = await import('../server/db.ts');

    async function api(
        session: Session,
        method: string,
        path: string,
        body?: unknown,
    ): Promise<{status: number; data: unknown}> {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (session.cookie) headers['Cookie'] = session.cookie;
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        const resp = await fetch(`${BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const setCookies = typeof resp.headers.getSetCookie === 'function'
            ? resp.headers.getSetCookie()
            : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie')!] : []);
        for (const c of setCookies) {
            const match = c.match(/rss_uid=([^;]+)/);
            if (match) session.cookie = `rss_uid=${match[1]}`;
        }
        const text = await resp.text();
        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
        return {status: resp.status, data};
    }

    async function syncRow(feedId: string): Promise<{last_fetched_at: Date | null; last_error: string | null}> {
        const {rows} = await getPool().query<{last_fetched_at: Date | null; last_error: string | null}>(
            'SELECT last_fetched_at, last_error FROM feed_sync WHERE feed_id = $1',
            [feedId],
        );
        return rows[0] ?? {last_fetched_at: null, last_error: null};
    }

    const sessionA: Session = {};
    const sessionB: Session = {};
    let feedAId = '';
    let feedBId = '';

    // ==============================================================
    // Scenario 1: healthz + cookie isolation
    // ==============================================================

    {
        const h = await api(sessionA, 'GET', '/healthz');
        assert(h.status === 200, 'healthz returns 200');
        assert(!sessionA.cookie, 'healthz does not set rss_uid');

        const {rows: beforeUsers} = await getPool().query<{n: string}>('SELECT COUNT(*)::text AS n FROM users');
        assert(Number(beforeUsers[0]?.n ?? 1) === 0, 'healthz does not create users');

        const libA = await api(sessionA, 'GET', '/library');
        assert(libA.status === 200, 'session A library creates a user');
        const libB = await api(sessionB, 'GET', '/library');
        assert(libB.status === 200, 'session B library creates a user');

        const uidA = uid(sessionA);
        const uidB = uid(sessionB);
        assert(uidA !== uidB, 'two sessions get DIFFERENT rss_uid cookies');
    }

    // ==============================================================
    // Scenario 2: add feeds, library, thumbnail extraction
    // ==============================================================

    {
        mockRequestLog.length = 0;

        const addA = await api(sessionA, 'POST', '/feeds', {url: FEED_A_URL});
        assert(addA.status === 200, 'POST /feeds A returns 200');
        feedAId = (addA.data as {id: string}).id;

        const addB = await api(sessionA, 'POST', '/feeds', {url: FEED_B_URL});
        assert(addB.status === 200, 'POST /feeds B returns 200');
        feedBId = (addB.data as {id: string}).id;

        const lib = await api(sessionA, 'GET', '/library');
        assert(lib.status === 200, 'GET /library returns 200');
        const libData = lib.data as {feeds: Array<{id: string; unread: number}>};
        assert(libData.feeds.length >= 2, 'library shows both feeds');

        const feedALib = libData.feeds.find((f) => f.id === feedAId);
        assert(!!feedALib, 'feed A in library');
        assert((feedALib.unread ?? 0) > 0, 'feed A has unread > 0');

        const feedBLib = libData.feeds.find((f) => f.id === feedBId);
        assert(!!feedBLib, 'feed B in library');
        assert((feedBLib.unread ?? 0) > 0, 'feed B has unread > 0');

        const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=100`);
        const artsData = arts.data as {items: Array<{guid: string; image?: string}>};
        const descImgItem = artsData.items.find((a) => a.guid === 'a-guid-0');
        assert(!!descImgItem, 'description-img item found');
        assert(!!descImgItem.image, 'image extracted from description HTML (thumbnail regression)');
    }

    // ==============================================================
    // Scenario 3: scope=all ownership — only session A's articles
    // ==============================================================

    {
        const addBA = await api(sessionB, 'POST', '/feeds', {url: FEED_A_URL});
        assert(addBA.status === 200, 'session B adds feed A copy');

        const allA = await api(sessionA, 'GET', '/articles?scope=all&limit=1000');
        const allDataA = allA.data as {items: Array<{feedId: string; id: string}>};

        const libB = await api(sessionB, 'GET', '/library');
        const libBData = libB.data as {feeds: Array<{id: string}>};
        const bFeedIds = new Set(libBData.feeds.map((f) => f.id));

        for (const item of allDataA.items) {
            assert(!bFeedIds.has(item.feedId), `cross-user leak regression: article ${item.id} does not belong to session B`);
        }
    }

    // ==============================================================
    // Scenario 4: article state updates (read, starred, unstar)
    // ==============================================================

    {
        const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const artsData = arts.data as {items: Array<{id: string; read: number; starred: boolean}>};
        assert(artsData.items.length > 0, 'articles exist for state test');
        const targetId = artsData.items[0].id;

        const readResult = await api(sessionA, 'POST', '/articles/state', {
            updates: [{id: targetId, read: true}],
        });
        const readData = readResult.data as {updated: number};
        assert(readData.updated === 1, 'mark read returns updated:1');

        const checkRead = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const checkReadData = checkRead.data as {items: Array<{id: string; read: number}>};
        const readArticle = checkReadData.items.find((a) => a.id === targetId);
        assert(!!readArticle, 'article found after read update');
        assert(readArticle.read === 1, 'read:1 persists (NOT NULL regression)');

        const starResult = await api(sessionA, 'POST', '/articles/state', {
            updates: [{id: targetId, starred: true}],
        });
        const starData = starResult.data as {updated: number};
        assert(starData.updated === 1, 'star returns updated:1');

        const checkStar = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const checkStarData = checkStar.data as {items: Array<{id: string; starred: boolean}>};
        const starred = checkStarData.items.find((a) => a.id === targetId);
        assert(!!starred?.starred, 'starred:true persists');

        const unstarResult = await api(sessionA, 'POST', '/articles/state', {
            updates: [{id: targetId, starred: false}],
        });
        const unstarData = unstarResult.data as {updated: number};
        assert(unstarData.updated === 1, 'unstar returns updated:1');

        const checkUnstar = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const checkUnstarData = checkUnstar.data as {items: Array<{id: string; starred: boolean}>};
        const unstarred = checkUnstarData.items.find((a) => a.id === targetId);
        assert(!unstarred?.starred, 'starred:false unstar persists');
    }

    // ==============================================================
    // Scenario 5: foreign write rejected
    // ==============================================================

    {
        const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const artsData = arts.data as {items: Array<{id: string; read: number}>};
        assert(artsData.items.length >= 2, 'need at least 2 articles for foreign-write test');
        const aArticleId = artsData.items[1].id;

        const foreign = await api(sessionB, 'POST', '/articles/state', {
            updates: [{id: aArticleId, read: true}],
        });
        const foreignData = foreign.data as {updated: number};
        assert(foreignData.updated === 0, 'foreign write rejected: updated:0');

        const check = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
        const checkData = check.data as {items: Array<{id: string; read: number}>};
        const unchanged = checkData.items.find((a) => a.id === aArticleId);
        assert(!!unchanged, 'session A article still listed after foreign write');
        assert(unchanged.read === 0, 'session A article state unchanged after foreign write');
    }

    // ==============================================================
    // Scenario 6: syndication popularity >= 4
    // ==============================================================

    {
        const artsA = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=100`);
        const dataA = artsA.data as {items: Array<{normLink?: string; popularity: number}>};
        const sharedA = dataA.items.find((a) => a.normLink === 'news.example.com/breaking');
        assert(!!sharedA, 'shared article found in feed A');
        assert(sharedA.popularity >= 4, `syndication popularity >= 4 in feed A (got ${sharedA.popularity})`);

        const artsB = await api(sessionA, 'GET', `/articles?scope=feed:${feedBId}&limit=100`);
        const dataB = artsB.data as {items: Array<{normLink?: string; popularity: number}>};
        const sharedB = dataB.items.find((a) => a.normLink === 'news.example.com/breaking');
        assert(!!sharedB, 'shared article found in feed B');
        assert(sharedB.popularity >= 4, `syndication popularity >= 4 in feed B (got ${sharedB.popularity})`);
    }

    // ==============================================================
    // Scenario 7: keyset pagination, newest sort, no dupes
    // ==============================================================

    {
        const allIds: string[] = [];
        let cursor: string | undefined;
        let pages = 0;
        while (pages < 20) {
            const qs = new URLSearchParams({
                scope: 'all',
                sort: 'newest',
                limit: '5',
            });
            if (cursor) qs.set('cursor', cursor);
            const resp = await api(sessionA, 'GET', `/articles?${qs}`);
            const data = resp.data as {items: Array<{id: string}>; nextCursor?: string};
            allIds.push(...data.items.map((a) => a.id));
            if (!data.nextCursor || data.items.length === 0) break;
            cursor = data.nextCursor;
            pages++;
        }
        assert(allIds.length >= FEED_A_ITEMS + 1, `pagination collected >= ${FEED_A_ITEMS + 1} articles (got ${allIds.length})`);
        assert(new Set(allIds).size === allIds.length, 'pagination has no duplicate ids');
        const allResp = await api(sessionA, 'GET', '/articles?scope=all&limit=100');
        const allData = allResp.data as {items: Array<{id: string; published: number}>};
        for (let i = 1; i < allData.items.length; i++) {
            assert(
                allData.items[i - 1].published >= allData.items[i].published,
                `newest sort: item ${i - 1} >= item ${i} by published`,
            );
        }
    }

    // ==============================================================
    // Scenario 8: unread-only filter + mark-all-read
    // ==============================================================

    {
        const unreadBefore = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&unreadOnly=1&limit=100`);
        const unreadDataBefore = unreadBefore.data as {items: unknown[]};
        assert(unreadDataBefore.items.length > 0, 'has unread articles before mark-all-read');

        await api(sessionA, 'POST', '/articles/read-all', {feedId: feedAId});

        const unreadAfter = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&unreadOnly=1&limit=100`);
        const unreadDataAfter = unreadAfter.data as {items: unknown[]};
        assert(unreadDataAfter.items.length === 0, 'unreadOnly page empty after mark-all-read');

        const libAfter = await api(sessionA, 'GET', '/library');
        const libDataAfter = libAfter.data as {feeds: Array<{id: string; unread: number}>};
        const feedAfter = libDataAfter.feeds.find((f) => f.id === feedAId);
        assert(!!feedAfter, 'feed A still in library after mark-all-read');
        assert(feedAfter.unread === 0, 'library unread 0 for feed after mark-all-read');
    }

    // ==============================================================
    // Scenario 9: conditional GET (ETag 304 path)
    // ==============================================================

    {
        // Add-feed already stored etag="v1". One forced resync must send
        // If-None-Match and receive 304 — not match an earlier unconditioned GET.
        mockRequestLog.length = 0;

        await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedBId]}});

        await waitFor(
            () => syncRow(feedBId),
            (row) => row.last_fetched_at !== null,
            'feed_sync.last_fetched_at advances after 304 resync',
        );

        const bRequests = mockRequestLog.filter((r) => r.url.includes('feed-b.xml'));
        assert(bRequests.length >= 1, 'feed B was fetched during forced resync');
        const last = bRequests[bRequests.length - 1];
        assert(last.headers['if-none-match'] === '"v1"', 'If-None-Match sent on the resync request');
        assert(last.status === 304, 'resync received 304 (conditional GET)');

        const after = await syncRow(feedBId);
        assert(after.last_error === null, '304 is not recorded as last_error');
    }

    // ==============================================================
    // Scenario 9b: overlapping syncs both complete (poller re-kick)
    // ==============================================================

    {
        // Hold feed A's fetch so tick#1 is in-flight when B is queued.
        // Without the drain loop, B would sit until the next interval.
        feedADelayMs = 400;
        try {
            const syncA = api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedAId]}});
            await new Promise((r) => setTimeout(r, 80));
            const syncB = api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedBId]}});
            await Promise.all([syncA, syncB]);

            await waitFor(
                async () => {
                    const a = await syncRow(feedAId);
                    const b = await syncRow(feedBId);
                    return {a: a.last_fetched_at, b: b.last_fetched_at};
                },
                (v) => v.a !== null && v.b !== null,
                'overlapping syncs both set last_fetched_at (poller re-kick)',
            );
            const a = await syncRow(feedAId);
            const b = await syncRow(feedBId);
            assert(a.last_fetched_at !== null && b.last_fetched_at !== null, 'overlapping syncs both completed (poller re-kick)');
        } finally {
            feedADelayMs = 0;
        }
    }

    // ==============================================================
    // Scenario 10: dead feed backoff — handler AND poller
    // ==============================================================

    {
        const addDead = await api(sessionA, 'POST', '/feeds', {url: FEED_DEAD_URL});
        assert(addDead.status === 200, 'POST /feeds dead returns 200');
        const deadFeedId = (addDead.data as {id: string}).id;

        const afterAdd = await syncRow(deadFeedId);
        assert(afterAdd.last_error !== null, 'dead feed has non-null last_error (add-feed backoff)');
        assert(afterAdd.last_fetched_at !== null, 'dead feed has non-null last_fetched_at (add-feed backoff)');

        // Force the poller path: sync NULLs last_fetched_at then queueFeeds.
        await api(sessionA, 'POST', '/sync', {scope: {feedIds: [deadFeedId]}});
        const afterPoll = await waitFor(
            () => syncRow(deadFeedId),
            (row) => row.last_fetched_at !== null && row.last_error !== null,
            'poller backoff after forced resync of dead feed',
        );
        assert(afterPoll.last_error !== null, 'dead feed last_error still set after poller catch');
        assert(afterPoll.last_fetched_at !== null, 'poller catch set last_fetched_at (no NULL starvation)');
    }

    // ==============================================================
    // Scenario 11: prune protects starred articles
    // ==============================================================

    {
        const pool = getPool();
        const extra = MAX_ARTICLES_PER_FEED + 10;
        for (let i = 0; i < extra; i++) {
            const guid = `prune-${i}`;
            const articleId = makeArticleId(feedAId, guid);
            await pool.query(
                `INSERT INTO articles (id, feed_id, guid, title, published_at, fetched_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    articleId,
                    feedAId,
                    guid,
                    `Prune test ${i}`,
                    new Date(Date.now() - (extra - i) * 60_000),
                    new Date(),
                ],
            );
        }

        const starId = makeArticleId(feedAId, 'prune-0');
        await api(sessionA, 'POST', '/articles/state', {
            updates: [{id: starId, starred: true}],
        });

        await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedAId]}});
        await waitFor(
            () => syncRow(feedAId),
            (row) => row.last_fetched_at !== null,
            'feed_sync advances after prune resync',
        );

        const {rows: starCheck} = await pool.query<{cnt: string}>(
            'SELECT COUNT(*) AS cnt FROM articles WHERE id = $1',
            [starId],
        );
        assert(Number(starCheck[0].cnt) === 1, 'starred article survived prune');

        const {rows: countCheck} = await pool.query<{cnt: string}>(
            'SELECT COUNT(*) AS cnt FROM articles WHERE feed_id = $1',
            [feedAId],
        );
        // 12 fixture + (MAX+10) inserts = MAX+22; newest MAX kept + 1 starred
        // outside the window = MAX+1.
        assert(
            Number(countCheck[0].cnt) === MAX_ARTICLES_PER_FEED + 1,
            `prune keeps exactly MAX+1 (got ${countCheck[0].cnt}, starred article exempt)`,
        );
    }

    // ==============================================================
    // Scenario 12: pending state lifecycle
    // ==============================================================

    {
        const pool = getPool();
        const pendingGuid = 'future-guid-xyz';
        const migrateResult = await api(sessionA, 'POST', '/migrate/library', {
            feeds: [{url: FEED_A_URL, title: 'Existing Feed'}],
            states: [{feedUrl: FEED_A_URL, guid: pendingGuid, read: true, starred: false}],
        });
        assert(migrateResult.status === 200, 'migrate/library returns 200');

        const {rows: pending} = await pool.query<{id: number}>(
            'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
            [feedAId, pendingGuid],
        );
        assert(pending.length === 1, 'pending state row created for future guid');

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            if (url.includes('feed-a.xml')) {
                const augmented = feedAXml.replace(
                    '</channel>',
                    `    <item>
      <title>Future Item</title>
      <link>https://feed-a.example/future</link>
      <guid>${pendingGuid}</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <description><p>This was the pending item</p></description>
    </item>\n  </channel>`,
                );
                return new Response(augmented, {
                    status: 200,
                    headers: {'Content-Type': 'application/xml'},
                });
            }
            return originalFetch.call(globalThis, input, init);
        };

        try {
            await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedAId]}});
            await waitFor(
                () => syncRow(feedAId),
                (row) => row.last_fetched_at !== null,
                'feed_sync advances after pending lifecycle resync',
            );

            const {rows: pendingAfter} = await pool.query<{id: number}>(
                'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
                [feedAId, pendingGuid],
            );
            assert(pendingAfter.length === 0, 'pending state consumed after article appears');

            const articleId = makeArticleId(feedAId, pendingGuid);
            const {rows: stateRow} = await pool.query<{read: boolean}>(
                'SELECT read FROM article_state WHERE user_id = $1 AND article_id = $2',
                [uid(sessionA), articleId],
            );
            assert(stateRow.length === 1, 'article_state created for pending guid');
            assert(stateRow[0].read === true, 'pending state applied: read=true');
        } finally {
            globalThis.fetch = originalFetch;
        }

        const unmatchedGuid = 'unmatched-never-arrives';
        await pool.query(
            `INSERT INTO pending_article_state (user_id, feed_id, guid, read, starred, created_at)
             VALUES ($1, $2, $3, false, false, now() - interval '49 hours')`,
            [uid(sessionA), feedAId, unmatchedGuid],
        );

        await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedAId]}});
        await waitFor(
            () => syncRow(feedAId),
            (row) => row.last_fetched_at !== null,
            'feed_sync advances after unmatched pending cleanup',
        );

        const {rows: oldPending} = await pool.query<{id: number}>(
            'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
            [feedAId, unmatchedGuid],
        );
        assert(oldPending.length === 0, 'unmatched pending row >48h deleted after ingest');
    }

    // ==============================================================
    // Scenario 13: OPML round trip
    // ==============================================================

    {
        const opmlResp = await api(sessionA, 'GET', '/opml');
        assert(opmlResp.status === 200, 'GET /opml returns 200');
        assert(typeof opmlResp.data === 'string', 'GET /opml returns XML string');
        const opml = opmlResp.data;
        assert(opml.includes('<opml'), 'OPML contains <opml> element');
        assert(opml.includes('Feed A') || opml.includes('feed-a'), 'OPML contains feed title');

        const importPayload = {
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Imported Tech" title="Imported Tech">
      <outline type="rss" text="Imported Feed X" title="Imported Feed X" xmlUrl="https://imported-x.example/rss"/>
    </outline>
    <outline type="rss" text="Imported Standalone" title="Imported Standalone" xmlUrl="https://imported-standalone.example/rss"/>
  </body>
</opml>`,
        };

        const importResp = await api(sessionA, 'POST', '/opml', importPayload);
        assert(importResp.status === 200, 'POST /opml returns 200');
        const importData = importResp.data as {addedFeeds: number; addedFolders: number};
        assert(importData.addedFeeds === 2, 'OPML import created 2 feeds');
        assert(importData.addedFolders === 1, 'OPML import created 1 folder');

        const libAfter = await api(sessionA, 'GET', '/library');
        const libDataAfter = libAfter.data as {
            feeds: Array<{title: string}>;
            folders: Array<{title: string}>;
        };
        assert(
            libDataAfter.folders.some((f) => f.title === 'Imported Tech'),
            'library has Imported Tech folder',
        );
        assert(
            libDataAfter.feeds.some((f) => f.title === 'Imported Feed X'),
            'library has Imported Feed X',
        );
        assert(
            libDataAfter.feeds.some((f) => f.title === 'Imported Standalone'),
            'library has Imported Standalone',
        );
    }

    // ==============================================================
    // Scenario 14: migration endpoint isolation
    // ==============================================================

    {
        const libABefore = await api(sessionA, 'GET', '/library');
        const libDataABefore = libABefore.data as {feeds: Array<{id: string}>};
        const aFeedCount = libDataABefore.feeds.length;

        await api(sessionB, 'POST', '/migrate/library', {
            feeds: [{url: 'https://session-b-only.example/rss', title: 'B Only'}],
        });

        const libAAfter = await api(sessionA, 'GET', '/library');
        const libDataAAfter = libAAfter.data as {feeds: Array<{id: string}>};
        assert(
            libDataAAfter.feeds.length === aFeedCount,
            'migration as session B does not change session A feed count',
        );

        const libB = await api(sessionB, 'GET', '/library');
        const libDataB = libB.data as {feeds: Array<{title: string}>};
        assert(
            libDataB.feeds.some((f) => f.title === 'B Only'),
            'session B sees its own migrated feed',
        );
    }

    // ==============================================================
    // Scenario 15: folder scope + unreadOnly (Low-folder regression)
    // A folder can have many all-read feeds and a few with unread.
    // scope=folder&unreadOnly=1 must still return those unread items.
    // ==============================================================

    {
        const created = await api(sessionA, 'POST', '/folders', {title: 'Low'});
        assert(created.status === 200, 'POST /folders Low returns 200');
        const folderId = (created.data as {id: string}).id;

        // Scenario 11 inserted extra unread rows into feed A after the earlier
        // read-all — make A actually all-read so the folder is mixed.
        await api(sessionA, 'POST', '/articles/read-all', {feedId: feedAId});

        const putA = await api(sessionA, 'PUT', `/feeds/${feedAId}/folders`, {folderIds: [folderId]});
        assert(putA.status === 200, 'assign feed A (all-read) to Low');
        const putB = await api(sessionA, 'PUT', `/feeds/${feedBId}/folders`, {folderIds: [folderId]});
        assert(putB.status === 200, 'assign feed B (has unread) to Low');

        const unread = await api(
            sessionA,
            'GET',
            `/articles?scope=folder:${folderId}&unreadOnly=1&limit=50`,
        );
        assert(unread.status === 200, 'GET folder unreadOnly returns 200');
        const unreadItems = (unread.data as {items: Array<{feedId: string; read: number}>}).items;
        assert(unreadItems.length > 0, 'folder unreadOnly is not empty when some member feeds have unread');
        assert(
            unreadItems.every((a) => a.read === 0),
            'folder unreadOnly returns only unread articles',
        );
        const folderFeedIds = new Set([feedAId, feedBId]);
        assert(
            unreadItems.every((a) => folderFeedIds.has(a.feedId)),
            'folder unreadOnly does not leak articles from outside the folder',
        );
        assert(
            unreadItems.every((a) => a.feedId === feedBId),
            'folder unreadOnly skips the all-read member feed',
        );
    }

    console.log('\nAll integration tests passed.');
} finally {
    globalThis.fetch = REAL_FETCH;
    if (closeSrv) {
        try {
            await closeSrv();
        } catch {
            // ignore cleanup errors
        }
    }
    if (mockServer) {
        await new Promise<void>((res) => mockServer!.close(() => res()));
    }
    if (pgStarted) {
        try {
            await pg.stop();
        } catch {
            // ignore cleanup errors
        }
    }
    try {
        await rm(DATA_DIR, {recursive: true, force: true});
    } catch {
        // ignore cleanup errors
    }
}
