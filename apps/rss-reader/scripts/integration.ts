// integration.ts — full integration tests for the Postgres-backed API server
// Run: tsx scripts/integration.ts
// Embeds a real Postgres, boots the server in-process, and drives it with fetch().

import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createHash} from 'node:crypto';
import {rm, mkdir} from 'node:fs/promises';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}

// ---- find a free port ----

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
const DATA_DIR = new URL('../.tmp/integration-pg', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

await rm(DATA_DIR, {recursive: true, force: true});
await mkdir(DATA_DIR, {recursive: true});

const pg = new EmbeddedPostgresCtor({
    databaseDir: DATA_DIR,
    user: 'rss',
    password: 'rss',
    port: PG_PORT,
    persistent: false,
});

await pg.initialise();
await pg.start();

try {
    await pg.createDatabase('rss_test');
} catch {
    // database may already exist on re-runs; that's fine
}

const DATABASE_URL = `postgres://rss:rss@127.0.0.1:${PG_PORT}/rss_test`;

// ---- set env BEFORE any server imports ----

process.env.DATABASE_URL = DATABASE_URL;
process.env.PORT = '0';
process.env.POLL_TICK_MS = '3600000';
process.env.RSS_ALLOW_LOCAL_FETCH = '1';

// ---- mock globalThis.fetch ----

const REAL_FETCH = globalThis.fetch;

interface MockRequest {
    url: string;
    headers: Record<string, string>;
}

const mockRequestLog: MockRequest[] = [];

// ---- fixture feeds ----

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

let feedBCallCount = 0;

const mockServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = `http://mock${req.url}`;
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers[k] = v;
    }
    mockRequestLog.push({url, headers});

    if (req.url === '/feed-a.xml') {
        res.writeHead(200, {'Content-Type': 'application/xml'});
        res.end(feedAXml);
    } else if (req.url === '/feed-b.xml') {
        feedBCallCount++;
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === '"v1"') {
            res.writeHead(304);
            res.end();
        } else {
            res.writeHead(200, {
                'Content-Type': 'application/xml',
                'ETag': '"v1"',
            });
            res.end(feedBXml);
        }
    } else if (req.url === '/dead.xml') {
        res.writeHead(403);
        res.end('Forbidden');
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const MOCK_PORT = await freePort();
await new Promise<void>((resolve) => mockServer.listen(MOCK_PORT, '127.0.0.1', () => resolve()));

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('http://mock') || url.startsWith('http://127.0.0.1')) {
        return REAL_FETCH.call(globalThis, input, init);
    }
    // Rewrite feed URLs to go through mock server
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

// ---- import server AFTER env + mock are set ----

const {startServer} = await import('../server/app.js');
const srv = await startServer(0);

const BASE = `http://127.0.0.1:${srv.port}`;

// ---- helpers ----

interface Session {
    cookie?: string;
}

async function api(
    session: Session,
    method: string,
    path: string,
    body?: unknown,
): Promise<{status: number; data: unknown; raw: Response}> {
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
    // capture set-cookie
    const setCookie = resp.headers.get('set-cookie');
    if (setCookie) {
        const match = setCookie.match(/rss_uid=([^;]+)/);
        if (match) {
            session.cookie = `rss_uid=${match[1]}`;
        }
    }
    const text = await resp.text();
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return {status: resp.status, data, raw: resp};
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

const sessionA: Session = {};
const sessionB: Session = {};

// ==============================================================
// Scenario 1: healthz + cookie isolation
// ==============================================================

{
    const h = await api(sessionA, 'GET', '/healthz');
    assert(h.status === 200, 'healthz returns 200');

    const h2 = await api(sessionB, 'GET', '/healthz');
    assert(h2.status === 200, 'session B healthz returns 200');

    const uidA = sessionA.cookie?.match(/rss_uid=([^;]+)/)?.[1];
    const uidB = sessionB.cookie?.match(/rss_uid=([^;]+)/)?.[1];
    assert(!!uidA, 'session A got rss_uid cookie');
    assert(!!uidB, 'session B got rss_uid cookie');
    assert(uidA !== uidB, 'two sessions get DIFFERENT rss_uid cookies');
}

// ==============================================================
// Scenario 2: add feeds, library, thumbnail extraction
// ==============================================================

{
    mockRequestLog.length = 0;

    const addA = await api(sessionA, 'POST', '/feeds', {
        url: FEED_A_URL,
    });
    assert(addA.status === 200, 'POST /feeds A returns 200');
    const feedAData = addA.data as {id: string};
    const feedAId = feedAData.id;

    const addB = await api(sessionA, 'POST', '/feeds', {
        url: FEED_B_URL,
    });
    assert(addB.status === 200, 'POST /feeds B returns 200');
    const feedBData = addB.data as {id: string};
    const feedBId = feedBData.id;

    const lib = await api(sessionA, 'GET', '/library');
    assert(lib.status === 200, 'GET /library returns 200');
    const libData = lib.data as {feeds: Array<{id: string; unread: number}>};
    assert(libData.feeds.length >= 2, 'library shows both feeds');

    const feedALib = libData.feeds.find((f) => f.id === feedAId);
    assert(!!feedALib, 'feed A in library');
    assert((feedALib!.unread ?? 0) > 0, 'feed A has unread > 0');

    const feedBLib = libData.feeds.find((f) => f.id === feedBId);
    assert(!!feedBLib, 'feed B in library');
    assert((feedBLib!.unread ?? 0) > 0, 'feed B has unread > 0');

    // Check thumbnail extraction from description <img>
    const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=100`);
    const artsData = arts.data as {items: Array<{guid: string; image?: string}>};
    const descImgItem = artsData.items.find((a) => a.guid === 'a-guid-0');
    assert(!!descImgItem, 'description-img item found');
    assert(!!descImgItem!.image, 'image extracted from description HTML (thumbnail regression)');
}

// ==============================================================
// Scenario 3: scope=all ownership — only session A's articles
// ==============================================================

{
    // Session B adds its own copy of feed A
    const addBA = await api(sessionB, 'POST', '/feeds', {
        url: FEED_A_URL,
    });
    assert(addBA.status === 200, 'session B adds feed A copy');

    const allA = await api(sessionA, 'GET', '/articles?scope=all&limit=1000');
    const allDataA = allA.data as {items: Array<{feedId: string; id: string}>};

    // Get session B's feed ids
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
    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string}>};
    const feedAId = libData.feeds[0].id;

    const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
    const artsData = arts.data as {items: Array<{id: string; read: number; starred: boolean}>};
    const targetId = artsData.items[0].id;
    assert(artsData.items.length > 0, 'articles exist for state test');

    // Mark read
    const readResult = await api(sessionA, 'POST', '/articles/state', {
        updates: [{id: targetId, read: true}],
    });
    const readData = readResult.data as {updated: number};
    assert(readData.updated === 1, 'mark read returns updated:1');

    // Verify read persists
    const checkRead = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
    const checkReadData = checkRead.data as {items: Array<{id: string; read: number}>};
    const readArticle = checkReadData.items.find((a) => a.id === targetId);
    assert(!!readArticle, 'article found after read update');
    assert(readArticle!.read === 1, 'read:1 persists (NOT NULL regression)');

    // Star
    const starResult = await api(sessionA, 'POST', '/articles/state', {
        updates: [{id: targetId, starred: true}],
    });
    const starData = starResult.data as {updated: number};
    assert(starData.updated === 1, 'star returns updated:1');

    const checkStar = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
    const checkStarData = checkStar.data as {items: Array<{id: string; starred: boolean}>};
    const starred = checkStarData.items.find((a) => a.id === targetId);
    assert(!!starred?.starred, 'starred:true persists');

    // Unstar
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
    const libA = await api(sessionA, 'GET', '/library');
    const libDataA = libA.data as {feeds: Array<{id: string}>};
    const feedAId = libDataA.feeds[0].id;

    const arts = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
    const artsData = arts.data as {items: Array<{id: string; read: number}>};
    // Use the second article to avoid conflict with scenario 4 which modified the first
    const aArticleId = artsData.items[1].id;

    // Session B tries to write session A's article
    const foreign = await api(sessionB, 'POST', '/articles/state', {
        updates: [{id: aArticleId, read: true}],
    });
    const foreignData = foreign.data as {updated: number};
    assert(foreignData.updated === 0, 'foreign write rejected: updated:0');

    // Session A's state unchanged
    const check = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=10`);
    const checkData = check.data as {items: Array<{id: string; read: number}>};
    const unchanged = checkData.items.find((a) => a.id === aArticleId);
    assert(unchanged!.read === 0, 'session A article state unchanged after foreign write');
}

// ==============================================================
// Scenario 6: syndication popularity >= 4
// ==============================================================

{
    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string}>};
    const feedAId = libData.feeds[0].id;
    const feedBId = libData.feeds.length > 1 ? libData.feeds[1].id : libData.feeds[0].id;

    const artsA = await api(sessionA, 'GET', `/articles?scope=feed:${feedAId}&limit=100`);
    const dataA = artsA.data as {items: Array<{normLink?: string; popularity: number}>};
    const sharedA = dataA.items.find((a) => a.normLink === 'news.example.com/breaking');
    assert(!!sharedA, 'shared article found in feed A');
    assert(sharedA!.popularity >= 4, `syndication popularity >= 4 in feed A (got ${sharedA!.popularity})`);

    const artsB = await api(sessionA, 'GET', `/articles?scope=feed:${feedBId}&limit=100`);
    const dataB = artsB.data as {items: Array<{normLink?: string; popularity: number}>};
    const sharedB = dataB.items.find((a) => a.normLink === 'news.example.com/breaking');
    assert(!!sharedB, 'shared article found in feed B');
    assert(sharedB!.popularity >= 4, `syndication popularity >= 4 in feed B (got ${sharedB!.popularity})`);
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
    // Verify descending published order via published timestamps
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
    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string}>};
    const feedAId = libData.feeds[0].id;

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
    assert(feedAfter!.unread === 0, 'library unread 0 for feed after mark-all-read');
}

// ==============================================================
// Scenario 9: conditional GET (ETag 304 path)
// ==============================================================

{
    // First: trigger a fresh sync so feed_sync has a last_fetched_at
    feedBCallCount = 0;
    mockRequestLog.length = 0;

    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string}>};
    const feedBId = libData.feeds[1].id;

    // Force resync feed B
    await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedBId]}});

    // Wait for poller to process (poll checks every tick, but we kicked via sync)
    await waitFor(
        async () => {
            const {getPool} = await import('../server/db.js');
            const {rows} = await getPool().query<{last_fetched_at: Date | null}>(
                'SELECT last_fetched_at FROM feed_sync WHERE feed_id = $1',
                [feedBId],
            );
            return rows[0]?.last_fetched_at;
        },
        (v) => v !== null,
        'feed_sync.last_fetched_at advances after resync',
    );

    // Second sync: feed_sync now has etag stored (from first mock response)
    // The mock returns ETag "v1" on first hit. After ingest, poller stores it.
    // Now clear last_fetched_at again to trigger re-fetch
    await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedBId]}});

    // Wait for the second poll cycle to complete
    const beforeCount = mockRequestLog.filter((r) => r.url.includes('feed-b.xml')).length;
    await waitFor(
        async () => mockRequestLog.filter((r) => r.url.includes('feed-b.xml')).length,
        (n) => n >= beforeCount + 1,
        'second feed B fetch triggered',
    );

    // Check if If-None-Match was sent on the second fetch
    const bRequests = mockRequestLog.filter((r) => r.url.includes('feed-b.xml'));
    // First request (from initial add), second (from sync1), third (from sync2 with etag)
    // The third request should have If-None-Match: "v1" and get a 304
    const etagRequest = bRequests.find(
        (r) => r.headers['if-none-match'] === '"v1"',
    );
    assert(!!etagRequest, 'mock server saw If-None-Match header on conditional GET');

    // Articles should be unchanged (304 = no new articles)
    const arts = await api(sessionA, 'GET', '/articles?scope=all&limit=100');
    const artsData = arts.data as {items: unknown[]};
    assert(artsData.items.length > 0, 'articles still exist after 304 sync');
}

// ==============================================================
// Scenario 10: dead feed backoff
// ==============================================================

{
    const addDead = await api(sessionA, 'POST', '/feeds', {
        url: FEED_DEAD_URL,
    });
    assert(addDead.status === 200, 'POST /feeds dead returns 200');
    const deadData = addDead.data as {id: string; lastError?: string};
    const deadFeedId = deadData.id;

    // The handler tried to fetch but got 403; feed_sync should have last_error
    const {getPool} = await import('../server/db.js');
    const pool = getPool();
    const {rows} = await pool.query<{last_error: string | null; last_fetched_at: Date | null}>(
        'SELECT last_error, last_fetched_at FROM feed_sync WHERE feed_id = $1',
        [deadFeedId],
    );
    assert(rows.length === 1, 'feed_sync row exists for dead feed');
    assert(rows[0].last_error !== null, 'dead feed has non-null last_error (backoff regression)');
    assert(rows[0].last_fetched_at !== null, 'dead feed has non-null last_fetched_at (no permanent NULL starvation)');
}

// ==============================================================
// Scenario 11: prune protects starred articles
// ==============================================================

{
    const {getPool} = await import('../server/db.js');
    const pool = getPool();

    // Insert >MAX_ARTICLES_PER_FEED items via direct SQL
    const MAX = 400;
    const {rows: [feedRow]} = await pool.query<{id: string}>(
        'SELECT id FROM feeds WHERE user_id = $1 LIMIT 1',
        [(await api(sessionA, 'GET', '/healthz'), sessionA.cookie!.match(/rss_uid=([^;]+)/)![1])],
    );
    // Use the first feed we already have
    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string}>};
    const feedId = libData.feeds[0].id;

    // Insert MAX + 10 articles, oldest first
    for (let i = 0; i < MAX + 10; i++) {
        const guid = `prune-${i}`;
        const articleId = makeArticleId(feedId, guid);
        await pool.query(
            `INSERT INTO articles (id, feed_id, guid, title, published_at, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [
                articleId,
                feedId,
                guid,
                `Prune test ${i}`,
                new Date(Date.now() - (MAX + 10 - i) * 60_000),
                new Date(),
            ],
        );
    }

    // Star one old article
    const starGuid = `prune-0`;
    const starId = makeArticleId(feedId, starGuid);
    await api(sessionA, 'POST', '/articles/state', {
        updates: [{id: starId, starred: true}],
    });

    // Force re-ingest (resync the feed)
    await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedId]}});

    // Wait for feed_sync to update
    await waitFor(
        async () => {
            const {rows: r} = await pool.query<{last_fetched_at: Date | null}>(
                'SELECT last_fetched_at FROM feed_sync WHERE feed_id = $1',
                [feedId],
            );
            return r[0]?.last_fetched_at;
        },
        (v) => v !== null,
        'feed_sync advances after prune resync',
    );

    // Verify starred article survived
    const {rows: starCheck} = await pool.query<{cnt: string}>(
        'SELECT COUNT(*) AS cnt FROM articles WHERE id = $1',
        [starId],
    );
    assert(Number(starCheck[0].cnt) === 1, 'starred article survived prune');

    // Verify count <= MAX
    const {rows: countCheck} = await pool.query<{cnt: string}>(
        'SELECT COUNT(*) AS cnt FROM articles WHERE feed_id = $1',
        [feedId],
    );
    assert(
        Number(countCheck[0].cnt) <= MAX + 1,
        `prune keeps <= ${MAX}+1 articles (got ${countCheck[0].cnt}, starred article exempt)`,
    );
}

// ==============================================================
// Scenario 12: pending state lifecycle
// ==============================================================

{
    const {getPool} = await import('../server/db.js');
    const pool = getPool();

    const lib = await api(sessionA, 'GET', '/library');
    const libData = lib.data as {feeds: Array<{id: string; url: string}>};
    const feedId = libData.feeds[0].id;
    const feedUrl = libData.feeds[0].url;

    // Create a pending state referencing a guid not yet in the feed
    const pendingGuid = 'future-guid-xyz';
    const migrateResult = await api(sessionA, 'POST', '/migrate/library', {
        feeds: [{url: feedUrl, title: 'Existing Feed'}],
        states: [{feedUrl, guid: pendingGuid, read: true, starred: false}],
    });
    assert(migrateResult.status === 200, 'migrate/library returns 200');

    // Pending row should exist
    const {rows: pending} = await pool.query<{id: number}>(
        'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
        [feedId, pendingGuid],
    );
    assert(pending.length === 1, 'pending state row created for future guid');

    // Now mutate the mock feed to include that guid
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('feed-a.xml')) {
            // Add the future-guid item to the feed
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

    // Resync the feed
    await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedId]}});

    // Wait for resync to complete
    await waitFor(
        async () => {
            const {rows: r} = await pool.query<{last_fetched_at: Date | null}>(
                'SELECT last_fetched_at FROM feed_sync WHERE feed_id = $1',
                [feedId],
            );
            return r[0]?.last_fetched_at;
        },
        (v) => v !== null,
        'feed_sync advances after pending lifecycle resync',
    );

    // Pending row should be consumed
    const {rows: pendingAfter} = await pool.query<{id: number}>(
        'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
        [feedId, pendingGuid],
    );
    assert(pendingAfter.length === 0, 'pending state consumed after article appears');

    // Article state should be applied
    const articleId = makeArticleId(feedId, pendingGuid);
    const {rows: stateRow} = await pool.query<{read: boolean}>(
        'SELECT read FROM article_state WHERE user_id = $1 AND article_id = $2',
        [sessionA.cookie!.match(/rss_uid=([^;]+)/)![1], articleId],
    );
    assert(stateRow.length === 1, 'article_state created for pending guid');
    assert(stateRow[0].read === true, 'pending state applied: read=true');

    // Restore normal fetch
    globalThis.fetch = originalFetch;

    // Unmatched pending rows >48h get cleaned up
    const unmatchedGuid = 'unmatched-never-arrives';
    await pool.query(
        `INSERT INTO pending_article_state (user_id, feed_id, guid, read, starred, created_at)
         VALUES ($1, $2, $3, false, false, now() - interval '49 hours')`,
        [sessionA.cookie!.match(/rss_uid=([^;]+)/)![1], feedId, unmatchedGuid],
    );

    // Trigger another ingest (resync)
    await api(sessionA, 'POST', '/sync', {scope: {feedIds: [feedId]}});
    await waitFor(
        async () => {
            const {rows: r} = await pool.query<{last_fetched_at: Date | null}>(
                'SELECT last_fetched_at FROM feed_sync WHERE feed_id = $1',
                [feedId],
            );
            return r[0]?.last_fetched_at;
        },
        (v) => v !== null,
        'feed_sync advances after unmatched pending cleanup',
    );

    const {rows: oldPending} = await pool.query<{id: number}>(
        'SELECT id FROM pending_article_state WHERE feed_id = $1 AND guid = $2',
        [feedId, unmatchedGuid],
    );
    assert(oldPending.length === 0, 'unmatched pending row >48h deleted after ingest');
}

// ==============================================================
// Scenario 13: OPML round trip
// ==============================================================

{
    // GET /opml should return XML
    const opmlResp = await api(sessionA, 'GET', '/opml');
    assert(opmlResp.status === 200, 'GET /opml returns 200');
    assert(typeof opmlResp.data === 'string', 'GET /opml returns XML string');
    const opml = opmlResp.data as string;
    assert(opml.includes('<opml'), 'OPML contains <opml> element');
    assert(opml.includes('Feed A') || opml.includes('feed-a'), 'OPML contains feed title');

    // POST /opml with nested folders
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

    // Verify library reflects the import
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
    // Session A's current library state
    const libABefore = await api(sessionA, 'GET', '/library');
    const libDataABefore = libABefore.data as {feeds: Array<{id: string}>};
    const aFeedCount = libDataABefore.feeds.length;

    // Session B imports a library — should not affect session A
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
// cleanup
// ==============================================================

await srv.close();
globalThis.fetch = REAL_FETCH;
mockServer.close();
try {
    await pg.stop();
} catch {
    // ignore cleanup errors
}
try {
    await rm(DATA_DIR, {recursive: true, force: true});
} catch {
    // ignore cleanup errors
}

console.log('\nAll integration tests passed.');
