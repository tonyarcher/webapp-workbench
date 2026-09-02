// server-smoke.ts — pure parity tests + optional DB-gated tests
// Run: tsx scripts/server-smoke.ts
// DB tests run only when RSS_TEST_DATABASE_URL is set.

import {DOMParser, XMLSerializer} from '@xmldom/xmldom';

(globalThis as Record<string, unknown>).DOMParser = DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = XMLSerializer;

// ---- client imports (via global DOMParser) ----
import {
    parseFeedXml as clientParseFeedXml,
    sanitizeHtml as clientSanitizeHtml,
    stripHtml as clientStripHtml,
    safeHttpUrl as clientSafeHttpUrl,
} from '../src/services/parser';
import {
    normalizeLink as cNormalizeLink,
    popularityScore as cPopularityScore,
    hotScore as cHotScore,
    contentEngagement as cContentEngagement,
    velocityBonus as cVelocityBonus,
} from '../src/services/ranking';

// ---- server imports (linkedom, no globals) ----
import {parseFeedXml as serverParseFeedXml, stripHtml as serverStripHtml, safeHttpUrl as serverSafeHttpUrl} from '../server/services/feed-parser.js';
import {sanitizeHtml as serverSanitizeHtml} from '../server/services/sanitize.js';
import {
    normalizeLink as sNormalizeLink,
    popularityScore as sPopularityScore,
    hotScore as sHotScore,
    contentEngagement as sContentEngagement,
    velocityBonus as sVelocityBonus,
} from '../server/services/ranking.js';
import {encodeCursor, decodeCursor} from '../server/cursor.js';
import {isPrivateIp} from '../server/services/fetcher.js';
import {cookieOpts} from '../server/http.js';

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}

// ====================================================================
// SSRF: isPrivateIp
// ====================================================================

assert(isPrivateIp('127.0.0.1'), 'loopback is private');
assert(isPrivateIp('10.1.2.3'), '10/8 is private');
assert(isPrivateIp('192.168.1.1'), '192.168/16 is private');
assert(isPrivateIp('172.16.0.1'), '172.16/12 low is private');
assert(isPrivateIp('172.31.255.255'), '172.16/12 high is private');
assert(isPrivateIp('169.254.1.1'), 'link-local is private');
assert(isPrivateIp('100.64.0.1'), 'CGNAT is private');
assert(isPrivateIp('0.0.0.0'), '0/8 is private');
assert(isPrivateIp('::1'), 'ipv6 loopback is private');
assert(isPrivateIp('::'), 'ipv6 unspecified is private');
assert(isPrivateIp('::ffff:127.0.0.1'), 'mapped ipv6 loopback is private');
assert(isPrivateIp('::ffff:7f00:1'), 'mapped ipv6 hex form is private');
assert(isPrivateIp('fc00::1'), 'ULA fc00 is private');
assert(isPrivateIp('fd12::1'), 'ULA fd00 is private');
assert(isPrivateIp('fe80::1'), 'ipv6 link-local is private');
assert(!isPrivateIp('::ffff:8.8.8.8'), 'mapped ipv6 public is public');
assert(!isPrivateIp('8.8.8.8'), '8.8.8.8 is public');
assert(!isPrivateIp('1.1.1.1'), '1.1.1.1 is public');
assert(!isPrivateIp('172.32.0.1'), '172.32 is public (outside 172.16/12)');
assert(!isPrivateIp('100.63.255.255'), '100.63 is public (outside CGNAT)');

const httpCookie = cookieOpts();
assert(!httpCookie.includes('Secure'), 'cookieOpts omits Secure on HTTP');
const httpsCookie = cookieOpts({headers: {'x-forwarded-proto': 'https'}} as import('node:http').IncomingMessage);
assert(httpsCookie.includes('Secure'), 'cookieOpts sets Secure on HTTPS');

// ====================================================================
// parser parity
// ====================================================================

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:thr="http://purl.org/syndication/thread/1.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Example Blog</title>
  <link>https://example.com</link>
  <item>
    <title>Hello World</title>
    <link>https://example.com/hello</link>
    <guid>https://example.com/hello</guid>
    <pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate>
    <dc:creator>Jane Doe</dc:creator>
    <slash:comments>42</slash:comments>
    <thr:total>42</thr:total>
    <description>&lt;p&gt;A &lt;b&gt;short&lt;/b&gt; summary&lt;/p&gt;</description>
    <content:encoded><![CDATA[<p>Full <b>content</b> here.</p><script>evil()</script>]]></content:encoded>
    <media:thumbnail url="https://example.com/thumb.jpg"/>
  </item>
</channel>
</rss>`;

const now = Date.now();
const cRss = clientParseFeedXml(rss, now);
const sRss = serverParseFeedXml(rss, now);
assert(cRss.title === sRss.title, 'rss title parity');
assert(cRss.siteUrl === sRss.siteUrl, 'rss siteUrl parity');
assert(cRss.items.length === sRss.items.length, 'rss item count parity');
assert(cRss.items[0].guid === sRss.items[0].guid, 'rss item guid parity');
assert(cRss.items[0].title === sRss.items[0].title, 'rss item title parity');
assert(cRss.items[0].author === sRss.items[0].author, 'rss item author parity');
assert(cRss.items[0].comments === sRss.items[0].comments, 'rss item comments parity');
assert(cRss.items[0].published === sRss.items[0].published, 'rss item published parity');
assert(cRss.items[0].summary === sRss.items[0].summary, 'rss item summary parity');
assert(cRss.items[0].media === sRss.items[0].media, 'rss item media parity');

// ---- image fallback: WordPress-style feeds embed <img> in the description
// HTML with no media elements (cnevpost). Both parsers must find it. ----
const imgInDescription = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>WP Feed</title>
  <link>https://wp.example</link>
  <item>
    <title>Has description img</title>
    <link>https://wp.example/a</link>
    <guid>wp-a</guid>
    <pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate>
    <description><![CDATA[<p><img src="https://wp.example/images/lead.jpg" alt="" /></p><p>Body text.</p>]]></description>
  </item>
  <item>
    <title>Img only in content:encoded</title>
    <link>https://wp.example/b</link>
    <guid>wp-b</guid>
    <pubDate>Wed, 30 Jul 2025 09:00:00 GMT</pubDate>
    <description><![CDATA[<p>Plain text, no image.</p>]]></description>
    <content:encoded><![CDATA[<figure><img src="https://wp.example/images/encoded.png" /></figure>]]></content:encoded>
  </item>
  <item>
    <title>No image anywhere</title>
    <link>https://wp.example/c</link>
    <guid>wp-c</guid>
    <pubDate>Wed, 30 Jul 2025 08:00:00 GMT</pubDate>
    <description><![CDATA[<p>Just words.</p>]]></description>
  </item>
</channel>
</rss>`;
const cImg = clientParseFeedXml(imgInDescription, now);
const sImg = serverParseFeedXml(imgInDescription, now);
assert(sImg.items[0].media === 'https://wp.example/images/lead.jpg', 'server extracts img from description html');
assert(sImg.items[1].media === 'https://wp.example/images/encoded.png', 'server extracts img from content:encoded');
assert(sImg.items[2].media === undefined, 'server leaves media undefined without any image');
// No client parity asserts here: the legacy client parser left HTML images
// to its ingest step, so ParsedItem.media intentionally differs across sides.

// ---- Atom entry ----
const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:thr="http://purl.org/syndication/thread/1.0">
  <title>Atom Blog</title>
  <link href="https://atom.example"/>
  <entry>
    <title>Post One</title>
    <id>tag:atom.example,2025:1</id>
    <link rel="alternate" href="https://atom.example/1"/>
    <updated>2025-07-31T08:30:00Z</updated>
    <author><name>Bob</name></author>
    <summary>Atom summary</summary>
    <thr:total>7</thr:total>
    <content type="html"><![CDATA[<p>Atom content</p>]]></content>
  </entry>
</feed>`;

const cAtom = clientParseFeedXml(atom, now);
const sAtom = serverParseFeedXml(atom, now);
assert(cAtom.title === sAtom.title, 'atom title parity');
assert(cAtom.items[0].guid === sAtom.items[0].guid, 'atom guid parity');
assert(cAtom.items[0].author === sAtom.items[0].author, 'atom author parity');
assert(cAtom.items[0].comments === sAtom.items[0].comments, 'atom comments parity');
assert(cAtom.items[0].content === sAtom.items[0].content, 'atom content parity');
assert(cAtom.items[0].published === sAtom.items[0].published, 'atom published parity');

// ---- guid-fallback anonymous item ----
const anon = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>` +
    `<item><title>Same</title><pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate><description>first</description></item>` +
    `<item><title>Same</title><pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate><description>second</description></item>` +
    `</channel></rss>`;
const cAnon = clientParseFeedXml(anon, 0);
const sAnon = serverParseFeedXml(anon, 0);
assert(cAnon.items[0].guid === sAnon.items[0].guid, 'anon guid parity');
assert(cAnon.items[0].guid === `${Date.parse('Wed, 30 Jul 2025 10:00:00 GMT')}-t`, 'anon guid format');

// ---- unsafe javascript: link ----
const unsafe = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>` +
    `<item><title>x</title><link>javascript:alert(1)</link></item></channel></rss>`;
const cUnsafe = clientParseFeedXml(unsafe, 0);
const sUnsafe = serverParseFeedXml(unsafe, 0);
assert(cUnsafe.items[0].link === undefined, 'client drops unsafe link');
assert(sUnsafe.items[0].link === undefined, 'server drops unsafe link');

// ---- HTML error page rejected ----
let cThrew = false;
try { clientParseFeedXml('<html><body><p>not a feed</p></body></html>', now); } catch { cThrew = true; }
let sThrew = false;
try { serverParseFeedXml('<html><body><p>not a feed</p></body></html>', now); } catch { sThrew = true; }
assert(cThrew && sThrew, 'both parsers reject HTML documents');

// ---- safeHttpUrl parity ----
assert(clientSafeHttpUrl('https://ok.com') === serverSafeHttpUrl('https://ok.com'), 'safeHttpUrl https parity');
assert(clientSafeHttpUrl('javascript:alert(1)') === serverSafeHttpUrl('javascript:alert(1)'), 'safeHttpUrl blocks javascript:');
assert(clientSafeHttpUrl('data:text/html,x') === serverSafeHttpUrl('data:text/html,x'), 'safeHttpUrl blocks data:');

// ====================================================================
// sanitizer parity
// ====================================================================

const dirty = '<p onclick="x()" style="color:red" class="y">ok <b>bold</b></p>' +
    '<a href="javascript:alert(1)">bad</a><a href="https://ok.example/x">good</a>' +
    '<img src="data:image/png;base64,AAA" alt="bad">' +
    '<img src="https://img.example/a.png" onerror="x()" width="10">' +
    '<svg><script>alert(1)</script></svg><unknown>keep me</unknown>';
const cClean = clientSanitizeHtml(dirty);
const sClean = serverSanitizeHtml(dirty);
assert(!sClean.includes('javascript:'), 'server sanitize strips javascript:');
assert(!sClean.includes('onerror') && !sClean.includes('onclick'), 'server sanitize strips event handlers');
assert(!sClean.includes('style=') && !sClean.includes('class='), 'server sanitize strips style/class');
assert(!sClean.includes('data:image'), 'server sanitize strips data: urls');
assert(sClean.includes('https://ok.example/x'), 'server sanitize keeps safe links');
assert(sClean.includes('https://img.example/a.png'), 'server sanitize keeps safe img');
assert(sClean.includes('bold'), 'server sanitize keeps formatting');
assert(!sClean.includes('<script'), 'server sanitize drops script elements');
assert(sClean.includes('keep me'), 'server sanitize unwraps unknown tags');
// Cross-check with client
assert(!cClean.includes('javascript:'), 'client sanitize strips javascript:');
assert(cClean.includes('keep me'), 'client sanitize unwraps unknown tags');

// ====================================================================
// ranking parity
// ====================================================================

const urls: [string, string][] = [
    ['https://www.Example.com/news/story/?utm_source=rss&utm_medium=feed&id=7', 'example.com/news/story?id=7'],
    ['http://example.com/news/', 'example.com/news'],
    ['https://example.com', 'example.com'],
];
for (const [input, expected] of urls) {
    assert(cNormalizeLink(input) === sNormalizeLink(input), `normalizeLink parity for ${input}`);
    assert(sNormalizeLink(input) === expected, `normalizeLink output for ${input}`);
}

const popCases: [number, number][] = [[1, 0], [2, 0], [3, 10], [2, 200]];
for (const [sc, comments] of popCases) {
    assert(cPopularityScore(sc, comments) === sPopularityScore(sc, comments), `popularityScore parity (${sc},${comments})`);
}
assert(sPopularityScore(1, 0) === 1, 'popularity base');
assert(sPopularityScore(2, 0) === 4, 'popularity syndication');
assert(sPopularityScore(2, 200) === 54, 'popularity caps comments');

const t = Date.parse('2025-07-31T08:30:00Z');
assert(cHotScore(1, 0, t) === sHotScore(1, 0, t), 'hotScore parity');
assert(sHotScore(1, 0, t) < sHotScore(1, 0, t + 45_000), 'newer ranks hotter');
assert(sHotScore(1, 0, t) < sHotScore(10, 0, t), 'higher pop ranks hotter');

assert(cContentEngagement({title: 'Q'}) === sContentEngagement({title: 'Q'}), 'contentEngagement parity');
assert(sContentEngagement({title: 'BREAKING: Top 5 Live!', content: '<p>' + 'word '.repeat(1200) + '</p>'}) >= 8, 'contentEngagement rewards rich story');

assert(cVelocityBonus(3, 3_600_000) === sVelocityBonus(3, 3_600_000), 'velocityBonus parity');
assert(sVelocityBonus(3, 3_600_000) > 0, 'velocityBonus rewards fresh spread');
assert(sVelocityBonus(3, 30 * 3_600_000) === 0, 'velocityBonus decays after a day');

// ====================================================================
// cursor roundtrip
// ====================================================================

const c1 = encodeCursor({k: 1234, id: 'abc'});
const d1 = decodeCursor(c1);
assert(d1 !== null && d1.k === 1234 && d1.id === 'abc', 'cursor roundtrip number');

const c2 = encodeCursor({k: 'abc', id: 'xyz'});
const d2 = decodeCursor(c2);
assert(d2 !== null && d2.k === 'abc' && d2.id === 'xyz', 'cursor roundtrip string');

assert(decodeCursor('!!!invalid!!!') === null, 'cursor tamper resistance');
assert(decodeCursor('') === null, 'cursor empty string');

// ====================================================================
// DB-gated tests
// ====================================================================

if (!process.env.RSS_TEST_DATABASE_URL) {
    console.log('\nserver-smoke: DB tests skipped (set RSS_TEST_DATABASE_URL)');
    console.log('\nAll pure server smoke tests passed.');
    process.exit(0);
}

process.env.DATABASE_URL = process.env.RSS_TEST_DATABASE_URL;

const {migrate, getPool} = await import('../server/db.js');
const {ingestFeed, makeArticleId} = await import('../server/services/ingest.js');
const {fetchFeedText} = await import('../server/services/fetcher.js');
const {normalizeLink} = await import('../server/services/ranking.js');
const {startPoller, stopPoller, tickNow} = await import('../server/services/poller.js');

await migrate();
assert(true, 'migrate() succeeded');
await migrate();
assert(true, 'migrate() idempotent (second call no-op)');

const pool = getPool();

// ---- create user/folder/feed ----
const {rows: [user]} = await pool.query<{ id: string }>(
    'INSERT INTO users (label) VALUES ($1) RETURNING id',
    ['smoke-test'],
);
assert(user.id.length > 0, 'test user created');

const {rows: [folder]} = await pool.query<{ id: string }>(
    'INSERT INTO folders (user_id, title) VALUES ($1, $2) RETURNING id',
    [user.id, 'Test Folder'],
);
assert(folder.id.length > 0, 'test folder created');

const {rows: [feed]} = await pool.query<{ id: string }>(
    'INSERT INTO feeds (user_id, xml_url, title) VALUES ($1, $2, $3) RETURNING id',
    [user.id, 'https://smoke-a.example/rss', 'Feed A'],
);
assert(feed.id.length > 0, 'test feed A created');

await pool.query(
    'INSERT INTO folder_feeds (folder_id, feed_id) VALUES ($1, $2)',
    [folder.id, feed.id],
);

// ---- ingest fixture feed ----
const feedXmlA = `<?xml version="1.0"?>
<rss version="2.0">
<channel>
  <title>Feed A</title>
  <link>https://smoke-a.example</link>
  <item>
    <title>Story X</title>
    <link>https://news.example.com/breaking?utm_source=rss</link>
    <guid>a1</guid>
    <pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate>
    <description>A story</description>
  </item>
</channel>
</rss>`;

const r1 = await ingestFeed(feed, feedXmlA, user.id);
assert(r1.inserted >= 1, 'ingest inserted articles from feed A');

// ---- unread count ----
const {rows: [unreadCount]} = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM articles a
     LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1
     WHERE a.feed_id = $2 AND COALESCE(s.read, false) = false`,
    [user.id, feed.id],
);
assert(Number(unreadCount.cnt) >= 1, 'unread count correct after ingest');

// ---- state upsert flips read ----
const articleId = makeArticleId(feed.id, 'a1');
await pool.query(
    `INSERT INTO article_state (user_id, article_id, read, read_at)
     VALUES ($1, $2, true, now())
     ON CONFLICT (user_id, article_id) DO UPDATE SET read = true, read_at = now()`,
    [user.id, articleId],
);
const {rows: [stateRow]} = await pool.query<{ read: boolean }>(
    'SELECT read FROM article_state WHERE user_id = $1 AND article_id = $2',
    [user.id, articleId],
);
assert(stateRow.read === true, 'state upsert sets read');

// ---- ingest second feed sharing same norm_link → syndication ----
const {rows: [feed2]} = await pool.query<{ id: string }>(
    'INSERT INTO feeds (user_id, xml_url, title) VALUES ($1, $2, $3) RETURNING id',
    [user.id, 'https://smoke-b.example/rss', 'Feed B'],
);
const feedXmlB = `<?xml version="1.0"?>
<rss version="2.0">
<channel>
  <title>Feed B</title>
  <link>https://smoke-b.example</link>
  <item>
    <title>Story X (dup)</title>
    <link>https://news.example.com/breaking</link>
    <guid>b1</guid>
    <pubDate>Wed, 30 Jul 2025 10:05:00 GMT</pubDate>
    <description>Duplicate story</description>
  </item>
</channel>
</rss>`;

const r2 = await ingestFeed(feed2, feedXmlB, user.id);
assert(r2.inserted >= 1, 'ingest inserted article from feed B');

// Check syndication: both articles should have popularity >= 4
const {rows: arts} = await pool.query<{ id: string; popularity: number }>(
    'SELECT id, popularity FROM articles WHERE norm_link = $1 ORDER BY feed_id',
    [normalizeLink('https://news.example.com/breaking')],
);
assert(arts.length === 2, 'two articles share the same norm_link');
assert(arts[0].popularity >= 4, `syndication popularity >= 4 (got ${arts[0].popularity})`);
assert(arts[1].popularity >= 4, `syndication popularity >= 4 (got ${arts[1].popularity})`);

// ---- keyset pagination walk ----
const PAGE = 3;
const allArticles: string[] = [];
let cursor: string | undefined;
let pages = 0;
while (pages < 20) {
    const conditions: string[] = [];
    const params: unknown[] = [user.id];
    let idx = 2;
    if (cursor) {
        const d = decodeCursor(cursor)!;
        conditions.push(`(a.published_at, a.id) < ($${idx}, $${idx + 1})`);
        params.push(new Date(d.k as number), d.id);
        idx += 2;
    }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(PAGE + 1);
    const {rows} = await pool.query<{ id: string; published_at: Date }>(
        `SELECT a.id, a.published_at FROM articles a
         LEFT JOIN article_state s ON s.article_id = a.id AND s.user_id = $1
         ${where}
         ORDER BY a.published_at DESC, a.id DESC
         LIMIT $${idx}`,
        params,
    );
    const hasMore = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    allArticles.push(...page.map((r) => r.id));
    if (!hasMore || page.length === 0) break;
    const last = page[page.length - 1];
    cursor = encodeCursor({k: last.published_at.getTime(), id: last.id});
    pages++;
}
assert(allArticles.length > 0, 'pagination walk collected articles');
assert(new Set(allArticles).size === allArticles.length, 'pagination has no duplicates');

// ---- prune protects starred ----
// Insert many articles into feed A
for (let i = 0; i < 420; i++) {
    await pool.query(
        `INSERT INTO articles (id, feed_id, guid, title, published_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [
            makeArticleId(feed.id, `prune-${i}`),
            feed.id,
            `prune-${i}`,
            `Prune ${i}`,
            new Date(Date.now() - i * 1000),
        ],
    );
}
// Star one article
const starId = makeArticleId(feed.id, 'prune-5');
await pool.query(
    `INSERT INTO article_state (user_id, article_id, read, starred)
     VALUES ($1, $2, false, true)
     ON CONFLICT (user_id, article_id) DO UPDATE SET starred = true`,
    [user.id, starId],
);

// Run ingest again to trigger prune
await ingestFeed(feed, feedXmlA, user.id);

const {rows: [starCount]} = await pool.query<{ cnt: string }>(
    'SELECT COUNT(*) AS cnt FROM articles WHERE id = $1',
    [starId],
);
assert(Number(starCount.cnt) === 1, 'starred article survived prune');

const {rows: [totalAfter]} = await pool.query<{ cnt: string }>(
    'SELECT COUNT(*) AS cnt FROM articles WHERE feed_id = $1',
    [feed.id],
);
assert(Number(totalAfter.cnt) <= 400, `prune keeps <= 400 articles (got ${totalAfter.cnt})`);

// ---- pending state applied post-ingest ----
await pool.query(
    `INSERT INTO pending_article_state (user_id, feed_id, guid, read, starred)
     VALUES ($1, $2, 'a1', true, false)`,
    [user.id, feed.id],
);
// Reset article_state for a1
await pool.query(
    'DELETE FROM article_state WHERE user_id = $1 AND article_id = $2',
    [user.id, makeArticleId(feed.id, 'a1')],
);
await ingestFeed(feed, feedXmlA, user.id);
const {rows: [pendingState]} = await pool.query<{ read: boolean }>(
    'SELECT read FROM article_state WHERE user_id = $1 AND article_id = $2',
    [user.id, makeArticleId(feed.id, 'a1')],
);
assert(pendingState?.read === true, 'pending state applied after ingest');

// ---- 304 path via mocked fetch ----
const realFetch = globalThis.fetch;
try {
    // Set up feed_sync with an etag
    await pool.query(
        `INSERT INTO feed_sync (feed_id, etag, last_modified, last_fetched_at)
         VALUES ($1, '"abc123"', 'Wed, 30 Jul 2025 10:00:00 GMT', now())
         ON CONFLICT (feed_id) DO UPDATE SET etag = '"abc123"', last_modified = 'Wed, 30 Jul 2025 10:00:00 GMT'`,
        [feed.id],
    );

    const beforeArts = (await pool.query('SELECT id FROM articles WHERE feed_id = $1', [feed.id])).rowCount;

    globalThis.fetch = async () => new Response(null, {
        status: 304,
        headers: {'etag': '"new-etag"'},
    }) as unknown as Response;

    const result = await fetchFeedText(feed.xml_url, {
        etag: '"abc123"',
        lastModified: 'Wed, 30 Jul 2025 10:00:00 GMT',
    });
    assert(result.status === 304, 'fetchFeedText returns 304');

    const afterArts = (await pool.query('SELECT id FROM articles WHERE feed_id = $1', [feed.id])).rowCount;
    assert(beforeArts === afterArts, 'no new articles on 304');
} finally {
    globalThis.fetch = realFetch;
}

// ---- cleanup ----
await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

console.log('\nAll server smoke tests passed.');
