import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {firstImageUrl, isFolder, parseFeedXml, parseOpml, safeHttpUrl, sanitizeHtml, stripHtml} from '../src/services/parser';
import {fetchFeedText, FetchError, validateFeedUrl} from '../src/services/proxy';
import {interleaveArticles} from '../src/util';
import {capItems, feedWindow, MAX_LIST_ITEMS, perFeedLimit} from '../src/services/pagination';
import type {Article, Feed} from '../src/types';
import {
  affinityBoostScore,
  contentEngagement,
  hotScore,
  normalizeLink,
  popularityScore,
  velocityBonus
} from '../src/services/ranking';
import {createCoalescer} from '../src/services/coalesce';
import {allSyncKey, isSetSyncKey, setKeyIncludesFeed} from '../src/services/sync-keys';
import {
  DEFAULT_PER_FOLDER,
  loadTodaySettings,
  pruneTodaySettings,
  saveTodaySettings,
} from '../src/services/today-settings';
import {buildTodaySections} from '../src/services/today';
import {
  aiAvailability,
  aiDiagnostics,
  aiStatusMessage,
  resetAiAvailability,
  runAiPrompt,
  summarizeArticle
} from '../src/ai';
import {isTokenFresh, tokenExp} from '../src/services/auth';
import {API_VERSION, API_VERSION_HEADER} from '../src/services/api';

(globalThis as Record<string, unknown>).DOMParser = DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = XMLSerializer;

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}

assert(API_VERSION_HEADER === 'X-Api-Version' && API_VERSION === '1', 'api version header');

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:slash="http://purl.org/rss/1.0/modules/slash/" xmlns:thr="http://purl.org/syndication/thread/1.0">
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
    <media:thumbnail xmlns:media="http://search.yahoo.com/mrss/" url="https://example.com/thumb.jpg"/>
  </item>
</channel>
</rss>`;

const parsed = parseFeedXml(rss, Date.now());
assert(parsed.title === 'Example Blog', 'rss title parsed');
assert(parsed.siteUrl === 'https://example.com', 'rss site url parsed');
assert(parsed.items.length === 1, 'rss item count');
assert(parsed.items[0].title === 'Hello World', 'item title');
assert(parsed.items[0].author === 'Jane Doe', 'item dc:creator author');
assert(parsed.items[0].comments === 42, 'item slash:comments parsed');
assert(parsed.items[0].published === Date.parse('Wed, 30 Jul 2025 10:00:00 GMT'), 'item pubDate parsed');
assert(parsed.items[0].summary === 'A short summary', 'item summary stripped to text');
assert(parsed.items[0].content?.includes('<b>content</b>') ?? false, 'item content:encoded kept');
assert(parsed.items[0].media === 'https://example.com/thumb.jpg', 'media:thumbnail parsed');

const sanitized = sanitizeHtml('<p>ok</p><script>bad()</script><img src="x" onerror="bad()">');
assert(!sanitized.includes('<script'), 'sanitize removes script');
assert(!sanitized.includes('onerror'), 'sanitize removes on* attrs');

// ---- sanitizer allowlist + URL schemes ----
const sanitizedSafe = sanitizeHtml(
    '<p onclick="x()" style="color:red" class="y">ok <b>bold</b></p>' +
        '<a href="javascript:alert(1)">bad</a><a href="https://ok.example/x">good</a>' +
        '<img src="data:image/png;base64,AAA" alt="bad">' +
        '<img src="https://img.example/a.png" onerror="x()" width="10">' +
        '<svg><script>alert(1)</script></svg><unknown>keep me</unknown>'
);
assert(!sanitizedSafe.includes('javascript:'), 'sanitize strips javascript: hrefs');
assert(!sanitizedSafe.includes('onerror') && !sanitizedSafe.includes('onclick'), 'sanitize strips event handlers');
assert(!sanitizedSafe.includes('style=') && !sanitizedSafe.includes('class='), 'sanitize strips style/class attributes');
assert(!sanitizedSafe.includes('data:image'), 'sanitize strips data: image urls');
assert(sanitizedSafe.includes('https://ok.example/x'), 'sanitize keeps safe links');
assert(sanitizedSafe.includes('https://img.example/a.png'), 'sanitize keeps safe img src');
assert(sanitizedSafe.includes('<b>bold</b>'), 'sanitize keeps formatting tags');
assert(!sanitizedSafe.includes('<script'), 'sanitize drops script elements (incl. inside svg)');
assert(sanitizedSafe.includes('keep me'), 'sanitize unwraps unknown tags keeping their text');

assert(safeHttpUrl('https://example.com/a') === 'https://example.com/a', 'safeHttpUrl keeps https');
assert(safeHttpUrl('http://example.com/a') === 'http://example.com/a', 'safeHttpUrl keeps http');
assert(safeHttpUrl('javascript:alert(1)') === undefined, 'safeHttpUrl blocks javascript:');
assert(safeHttpUrl('data:text/html,x') === undefined, 'safeHttpUrl blocks data:');
assert(safeHttpUrl('//example.com/x') === undefined, 'safeHttpUrl blocks protocol-relative (no base)');

// ---- non-feed documents rejected ----
let threw = false;
try {
    parseFeedXml('<html><body><p>not a feed</p></body></html>', Date.now());
} catch {
    threw = true;
}
assert(threw, 'parseFeedXml rejects HTML documents');
const minimal = parseFeedXml(
    '<?xml version="1.0"?><rss version="2.0"><channel><title>Minimal</title></channel></rss>',
    0,
);
assert(minimal.title === 'Minimal', 'parseFeedXml accepts minimal rss');

// ---- anonymous items without guid/link key off published+title (legacy-compatible) ----
const anon = parseFeedXml(
    `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>` +
        `<item><title>Same</title><pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate><description>first</description></item>` +
        `<item><title>Same</title><pubDate>Wed, 30 Jul 2025 10:00:00 GMT</pubDate><description>second</description></item>` +
        `</channel></rss>`,
    0,
);
assert(anon.items[0].guid === anon.items[1].guid, 'identical anonymous items dedupe to the same guid');
assert(
    anon.items[0].guid === `${Date.parse('Wed, 30 Jul 2025 10:00:00 GMT')}-t`,
    'anonymous guid keeps the historic published-channelTitle format',
);

const unsafeLink = parseFeedXml(
    '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>' +
        '<item><title>x</title><link>javascript:alert(1)</link></item></channel></rss>',
    0,
);
assert(unsafeLink.items[0].link === undefined, 'unsafe item links are dropped at parse time');

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

const atomParsed = parseFeedXml(atom, Date.now());
assert(atomParsed.title === 'Atom Blog', 'atom title parsed');
assert(atomParsed.items[0].guid === 'tag:atom.example,2025:1', 'atom entry id');
assert(atomParsed.items[0].author === 'Bob', 'atom author');
assert(atomParsed.items[0].comments === 7, 'atom thr:total parsed');
assert(atomParsed.items[0].content?.includes('Atom content') ?? false, 'atom content');
assert(atomParsed.items[0].published === Date.parse('2025-07-31T08:30:00Z'), 'atom updated parsed');

// ---- ranking ----
assert(normalizeLink('https://www.Example.com/news/story/?utm_source=rss&utm_medium=feed&id=7') === 'example.com/news/story?id=7', 'normalizeLink strips www, utm params');
assert(normalizeLink('http://example.com/news/') === 'example.com/news', 'normalizeLink normalizes protocol/trailing slash');
assert(normalizeLink('https://example.com') === 'example.com', 'normalizeLink keeps bare host');

assert(popularityScore(1, 0) === 1, 'popularity base 1');
assert(popularityScore(2, 0) === 4, 'popularity adds 3 per extra feed');
assert(popularityScore(3, 10) === 17, 'popularity combines syndication + comments');
assert(popularityScore(2, 200) === 54, 'popularity caps comments at 50');

const t = Date.parse('2025-07-31T08:30:00Z');
assert(hotScore(1, 0, t) < hotScore(1, 0, t + 45_000), 'newer article ranks hotter');
assert(hotScore(1, 0, t) < hotScore(10, 0, t), 'higher popularity ranks hotter at same age');
assert(hotScore(1, 0, t + 90_000) < hotScore(10, 0, t), '10x popularity offsets ~1 day age (hot gravity)');
assert(hotScore(1, 10, t) > hotScore(1, 0, t + 90_000), 'engagement offsets ~1 day of age');
assert(Number.isFinite(hotScore(1, 0, 0)), 'hotScore finite for very old article');

assert(contentEngagement({
    title: 'BREAKING: Top 5 Live!',
    content: '<p>' + 'word '.repeat(1200) + '</p>'
}) >= 8, 'contentEngagement rewards media-less rich story');
assert(contentEngagement({title: 'Quiet title'}) === 0, 'contentEngagement floor is 0');
assert(affinityBoostScore(0) === 0, 'affinityBoostScore 0 for no affinity');
assert(affinityBoostScore(99) > affinityBoostScore(0), 'affinityBoostScore grows with affinity');
assert(velocityBonus(0, 1_000) === 0, 'velocityBonus 0 when not syndicated');
assert(velocityBonus(3, 3_600_000) > 0, 'velocityBonus rewards fresh spread');
assert(velocityBonus(3, 30 * 3_600_000) === 0, 'velocityBonus decays after a day');

const opml = `<?xml version="1.0"?>
<opml version="2.0">
<body>
  <outline text="Tech">
    <outline type="rss" text="HN" xmlUrl="https://news.ycombinator.com/rss"/>
    <outline type="rss" text="Verge" xmlUrl="https://www.theverge.com/rss/index.xml" htmlUrl="https://www.theverge.com/"/>
  </outline>
  <outline type="rss" text="Standalone" xmlUrl="https://example.com/feed"/>
</body>
</opml>`;

const opmlNodes = parseOpml(opml);
assert(opmlNodes.length === 2, 'opml top-level count');
const tech = opmlNodes[0];
assert(isFolder(tech) && tech.title === 'Tech', 'opml folder detected');
assert(isFolder(tech) && tech.children.length === 2, 'opml folder children');
const standalone = opmlNodes[1];
assert(!isFolder(standalone) && standalone.xmlUrl === 'https://example.com/feed', 'opml top-level source');
assert(stripHtml('<p>a&nbsp;b</p>') === 'a b', 'stripHtml collapses whitespace');
assert(firstImageUrl('<p>text</p><img src="https://img.example/1.jpg" alt="x">') === 'https://img.example/1.jpg', 'firstImageUrl finds first img');
assert(firstImageUrl('<img src="data:image/gif;base64,xxx" data-src="https://img.example/lazy.jpg">') === 'https://img.example/lazy.jpg', 'firstImageUrl prefers data-src for lazy-loading images');
assert(firstImageUrl('<img srcset="https://img.example/small.jpg 480w, https://img.example/large.jpg 1200w">') === 'https://img.example/small.jpg', 'firstImageUrl reads srcset');
assert(firstImageUrl('<p>no image</p>') === undefined, 'firstImageUrl returns undefined without img');
assert(firstImageUrl('<img src="data:image/gif;base64,xxx">') === undefined, 'firstImageUrl rejects data: urls');

// ---- interleave (diverse hot pages) ----
const hotArticle = (id: string, hot: number): Article => ({
    id,
    feedId: 'f',
    guid: id,
    title: id,
    published: 0,
    fetchedAt: 0,
    read: 0,
    starred: false,
    popularity: 1,
    hot,
});
const feedA = [hotArticle('a1', 30), hotArticle('a2', 10), hotArticle('a3', 2)];
const feedB = [hotArticle('b1', 20), hotArticle('b2', 8)];
const feedC = [hotArticle('c1', 15)];
const mixed = interleaveArticles([feedA, feedB, feedC], 4);
assert(mixed.length === 4, 'interleave fills the page');
assert(mixed[0].id === 'a1', 'interleave starts with the hottest story');
assert(
    mixed.map((a) => a.id).join(',') === 'a1,b1,c1,a2',
    'interleave alternates feeds (a1,b1,c1,a2)',
);
assert(interleaveArticles([feedA, feedB, feedC], 10).length === 6, 'interleave returns everything when limit is large');
assert(interleaveArticles([[], feedB], 3).map((a) => a.id).join(',') === 'b1,b2', 'interleave skips empty feeds');
assert(interleaveArticles([feedA], 1)[0].id === 'a1', 'interleave with one feed returns its top');
assert(interleaveArticles([], 5).length === 0, 'interleave empty input returns empty');

// ---- AI module (mock Chrome's built-in model) ----
const g = globalThis as unknown as Record<string, unknown>;
const encoder = new TextEncoder();

resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'ai unavailable when no model API present');

let capturedSystem: string | undefined;
g.model = {
    capabilities: async () => ({available: 'readily'}),
    create: async ({systemPrompt}: { systemPrompt?: string }) => {
        capturedSystem = systemPrompt;
        return {
            prompt: async (text: string) => `SUMMARY[${text.slice(0, 59)}]`,
            destroy: () => {
            },
        };
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'readily', 'ai availability detects model.capabilities');
const out = await runAiPrompt('hello world body');
assert(out === 'SUMMARY[hello world body]', 'runAiPrompt routes through model.create');
const articleSummary = await summarizeArticle('My Article', 'body text here');
assert(
    articleSummary === 'SUMMARY[Summarize the following article in 4-6 short bullet points.]',
    'summarizeArticle builds an article prompt',
);
assert(typeof capturedSystem === 'string' && capturedSystem.length > 0, 'summarizeArticle sends a system prompt');

g.model = {
    capabilities: async () => ({available: 'readily'}),
    create: async () => {
        return {
            prompt: async () =>
                new ReadableStream({
                    start(c) {
                        c.enqueue(encoder.encode('streamed '));
                        c.enqueue(encoder.encode('result'));
                        c.close();
                    },
                }),
            destroy: () => {
            },
        };
    },
};
const streamed = await runAiPrompt('x');
assert(streamed === 'streamed result', 'runAiPrompt consumes a streaming response');

g.model = {
    capabilities: async () => ({available: 'after-download'}),
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'after-download', 'ai availability reports after-download');
delete g.model;

// capabilities reports readily but no create() exists -> must be treated as unsupported
g.model = {
    capabilities: async () => ({available: 'readily'}),
};
resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'readily without a create() is reported as unsupported');
delete g.model;

assert(
    aiStatusMessage('unsupported').includes('LanguageModel') &&
        aiStatusMessage('unsupported').includes('localhost'),
    'aiStatusMessage gives actionable guidance for unsupported',
);
assert(
    aiStatusMessage('after-download').includes('downloading'),
    'aiStatusMessage covers after-download',
);
assert(aiStatusMessage('readily') === '', 'aiStatusMessage empty when readily');

// diagnostics surface what Chrome exposes
g.model = {
    capabilities: async () => ({available: 'readily'}),
    create: async () => ({
        prompt: async (t: string) => t, destroy: () => {
        }
    }),
};
resetAiAvailability();
const diag = await aiDiagnostics();
assert(diag.hasModelApi === true, 'diagnostics detect window.model');
assert(diag.capabilitiesValue === 'readily', 'diagnostics report capabilities value');
assert(diag.available === 'readily', 'diagnostics available is readily');
delete g.model;
resetAiAvailability();
const diag2 = await aiDiagnostics();
assert(diag2.hasModelApi === false && diag2.hasAiApi === false, 'diagnostics report absent APIs');
assert(diag2.hasLanguageModelGlobal === false, 'diagnostics report absent LanguageModel');

// Chrome 138+ Prompt API: global LanguageModel.availability() / create()
g.LanguageModel = {
    availability: async () => 'available',
    create: async ({initialPrompts}: { initialPrompts?: Array<{ role: string; content: string }> } = {}) => {
        capturedSystem = initialPrompts?.[0]?.content;
        return {
            prompt: async (text: string) => `LM[${text.slice(0, 20)}]`,
            destroy: () => {
            },
        };
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'readily', 'LanguageModel.availability available maps to readily');
const lmOut = await runAiPrompt('hello from prompt api', 'be concise');
assert(lmOut === 'LM[hello from prompt ap]', 'runAiPrompt routes through LanguageModel.create');
assert(capturedSystem === 'be concise', 'LanguageModel.create receives system prompt as initialPrompts');
const lmDiag = await aiDiagnostics();
assert(lmDiag.hasLanguageModelGlobal === true, 'diagnostics detect LanguageModel');
assert(lmDiag.capabilitiesValue === 'available', 'diagnostics report LanguageModel availability');
g.LanguageModel = {
    availability: async () => 'downloadable',
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'after-download', 'LanguageModel downloadable maps to after-download');
g.LanguageModel = {
    availability: async () => 'unavailable',
    create: async () => {
        throw new Error('should not be called');
    },
};
resetAiAvailability();
assert((await aiAvailability()) === 'no', 'LanguageModel unavailable maps to no');
delete g.LanguageModel;
resetAiAvailability();

// ---- proxy: URL validation, size limit, timeout mapping ----
assert(
    validateFeedUrl('https://example.com/feed.xml') === 'https://example.com/feed.xml',
    'validateFeedUrl accepts absolute https',
);
assert(
    validateFeedUrl(' http://example.com/feed ') === 'http://example.com/feed',
    'validateFeedUrl trims and accepts absolute http',
);
const invalidUrls: [string, string][] = [
    ['javascript:alert(1)', 'javascript: scheme'],
    ['data:text/html,x', 'data: scheme'],
    ['ftp://example.com/feed', 'ftp: scheme'],
    ['/relative/path', 'relative path'],
    ['https://user:pass@example.com/', 'embedded credentials'],
];
for (const [url, label] of invalidUrls) {
    let rejected = false;
    try {
        validateFeedUrl(url);
    } catch {
        rejected = true;
    }
    assert(rejected, `validateFeedUrl rejects ${label}`);
}

const g2 = globalThis as unknown as Record<string, unknown>;
const realFetch = g2.fetch;
try {
    g2.fetch = async () => new Response('<rss/>', {status: 200});
    assert((await fetchFeedText('https://ok.example/feed')) === '<rss/>', 'fetchFeedText returns the proxied body');

    g2.fetch = async () => {
        const chunk = new Uint8Array(1024 * 1024);
        return new Response(
            new ReadableStream({
                start(controller) {
                    for (let i = 0; i < 6; i++) controller.enqueue(chunk);
                    controller.close();
                },
            }),
            {status: 200},
        );
    };
    let oversized = false;
    try {
        await fetchFeedText('https://ok.example/big', 0);
    } catch (err) {
        oversized = err instanceof FetchError && err.message === 'Feed is too large';
    }
    assert(oversized, 'fetchFeedText rejects oversized responses');

    g2.fetch = async () => {
        throw new DOMException('aborted', 'AbortError');
    };
    let timedOut = false;
    try {
        await fetchFeedText('https://ok.example/slow', 0);
    } catch (err) {
        timedOut = err instanceof FetchError && err.message.includes('timed out');
    }
    assert(timedOut, 'fetchFeedText maps aborts to a timeout FetchError');
} finally {
    g2.fetch = realFetch;
}

// ---- pagination helpers: capItems / feedWindow ----
const overCap = Array.from({length: MAX_LIST_ITEMS + 5}, (_, i) => i);
assert(capItems(overCap).length === MAX_LIST_ITEMS, 'capItems caps a list at MAX_LIST_ITEMS');
assert(
  capItems(overCap).every((v, i) => v === i),
  'capItems keeps the head of the list (drops the least-relevant tail)',
);
assert(capItems([1, 2, 3]).length === 3, 'capItems passes through lists under the cap');
assert(capItems(overCap, 20).length === 20, 'capItems honors an explicit page-size cap');
assert(capItems([1, 2, 3], 20).length === 3, 'capItems does not pad when under the page-size cap');
assert(capItems(overCap, 0).length === 0, 'capItems with max 0 returns empty');
assert(capItems(overCap, -1).length === 0, 'capItems with negative max returns empty');

const makeFeed = (id: string): Feed => ({
  id,
  title: id,
  url: `https://${id}.example/rss`,
  folderIds: [],
  unread: 0,
  addedAt: 0,
});
const manyFeeds = Array.from({length: 10}, (_, i) => makeFeed(`f${i}`));
const smallFeeds = manyFeeds.slice(0, 3);

assert(feedWindow(smallFeeds, 0, 5) === smallFeeds, 'feedWindow returns feeds unchanged when the set fits the size');
assert(feedWindow(smallFeeds, 7, 5) === smallFeeds, 'feedWindow ignores offset when the set fits the size');
assert(
  feedWindow(manyFeeds, 0, 4).map((f) => f.id).join(',') === 'f0,f1,f2,f3',
  'feedWindow starts at the offset and returns size feeds',
);
assert(
  feedWindow(manyFeeds, 4, 4).map((f) => f.id).join(',') === 'f4,f5,f6,f7',
  'feedWindow advances the window with the offset',
);
assert(
  feedWindow(manyFeeds, 8, 4).map((f) => f.id).join(',') === 'f8,f9,f0,f1',
  'feedWindow wraps around the end of the list',
);
assert(
  feedWindow(manyFeeds, 12, 4).map((f) => f.id).join(',') === 'f2,f3,f4,f5',
  'feedWindow rotates by offset modulo the feed count',
);
const sevenFeeds = Array.from({length: 7}, (_, i) => makeFeed(`n${i}`));
const visitedFeeds = new Set<string>();
for (const off of [0, 3, 6]) {
    for (const f of feedWindow(sevenFeeds, off, 3)) visitedFeeds.add(f.id);
}
assert(
  visitedFeeds.size === 7,
  'rotating offsets across the window visit every feed at least once over ceil(n/size) pages',
);
assert(feedWindow(manyFeeds, 0, 20).length === 10, 'feedWindow never returns more feeds than exist');

// ---- per-feed share backfill limit ----
assert(perFeedLimit(50, 1) === 50, 'perFeedLimit one feed fills the page');
assert(perFeedLimit(50, 3) === 17, 'perFeedLimit few feeds share the page (ceil)');
assert(perFeedLimit(50, 50) === 1, 'perFeedLimit one-from-each when feeds == pageSize');
assert(perFeedLimit(50, 200) === 1, 'perFeedLimit never more than one when feeds exceed pageSize');
assert(perFeedLimit(20, 5) === 4, 'perFeedLimit splits 20 across 5 feeds');
assert(perFeedLimit(50, 0) === 0, 'perFeedLimit zero feeds returns 0');
assert(perFeedLimit(0, 3) === 0, 'perFeedLimit zero pageSize returns 0');

// ---- elevator-button coalescing ----
{
  const c = createCoalescer<string, number>();
  let calls = 0;
  const fn = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 10));
    return 42;
  };
  const [a, b] = await Promise.all([c.run('k', fn), c.run('k', fn)]);
  assert(calls === 1, 'concurrent run for the same key invokes fn once');
  assert(a === 42 && b === 42, 'concurrent callers resolve to the same value');

  let calls2 = 0;
  const fn2 = async () => {
    calls2++;
    return 7;
  };
  assert((await c.run('k', fn2)) === 7, 'a later run after settle invokes a new fn');
  assert(calls2 === 1, 'post-settle run starts a fresh job');

  let callsA = 0;
  let callsB = 0;
  const other = createCoalescer<string, number>();
  const [ra, rb] = await Promise.all([
    other.run('a', async () => {
      callsA++;
      await new Promise((r) => setTimeout(r, 5));
      return 1;
    }),
    other.run('b', async () => {
      callsB++;
      await new Promise((r) => setTimeout(r, 5));
      return 2;
    }),
  ]);
  assert(callsA === 1 && callsB === 1, 'different keys run independently');
  assert(ra === 1 && rb === 2, 'different keys resolve to their own values');

  const failing = createCoalescer<string, number>();
  const bad = async () => {
    throw new Error('coalesced job failed');
  };
  let badThrew = false;
  try {
    await failing.run('k', bad);
  } catch {
    badThrew = true;
  }
  assert(badThrew, 'a rejected job propagates the error');
  let retried = 0;
  assert((await failing.run('k', async () => {
    retried++;
    return 9;
  })) === 9, 'a rejected job is cleared so the next run starts fresh');
  assert(retried === 1, 'post-failure run invokes a new fn exactly once');
}

// ---- sync keys ----
assert(allSyncKey() === 'all', 'allSyncKey() keys the whole-library sync');
assert(allSyncKey(undefined) === 'all', 'allSyncKey(undefined) keys the whole-library sync');
assert(allSyncKey([]) === null, 'allSyncKey([]) is null so an empty folder cannot claim the global slot');
assert(allSyncKey(['b', 'a']) === allSyncKey(['a', 'b']), 'set keys are order-independent');
assert(allSyncKey(['b', 'a']) === 'set:a\0b', 'set keys are sorted and NUL-joined');
assert(setKeyIncludesFeed(allSyncKey(['a', 'b'])!, 'a') === true, 'set key includes a member id');
assert(setKeyIncludesFeed(allSyncKey(['a', 'b'])!, 'c') === false, 'set key excludes a non-member id');
assert(setKeyIncludesFeed('all', 'a') === false, 'the all key never claims a specific feed');
assert(isSetSyncKey('all') === false, 'the all key is not a feed-set key');
assert(isSetSyncKey(allSyncKey(['a'])!) === true, 'a set key is a feed-set key');

// ---- today settings ----
const defaults = loadTodaySettings();
assert(defaults.excludedFolderIds.length === 0, 'today settings default to all folders included');
assert(defaults.perFolder === DEFAULT_PER_FOLDER, 'today settings default per-folder amount');

const mem = new Map<string, string>();
const gStorage = globalThis as Record<string, unknown>;
gStorage.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
};
saveTodaySettings({excludedFolderIds: ['a', 'b'], perFolder: 3, unreadOnly: true, listView: 'cards'});
const roundTrip = loadTodaySettings();
assert(roundTrip.excludedFolderIds.join(',') === 'a,b', 'today settings save/load round trip');
assert(roundTrip.perFolder === 3, 'today settings round trip keeps the amount');
assert(roundTrip.unreadOnly === true, 'today settings round trip keeps unread-only');
assert(roundTrip.listView === 'cards', 'today settings round trip keeps list view');

mem.set('rss-reader:today-settings', JSON.stringify({excludedFolderIds: ['a'], perFolder: 7}));
assert(loadTodaySettings().perFolder === DEFAULT_PER_FOLDER, 'today settings clamp an unknown amount');

const pruned = pruneTodaySettings({excludedFolderIds: ['a', 'b'], perFolder: 5, unreadOnly: false, listView: 'detailed'}, ['a', 'c']);
assert(pruned.excludedFolderIds.join(',') === 'a', 'today settings prune deleted folder ids');

// ---- today sections ----
const mkArticle = (id: string, feedId: string, hot: number): Article => ({
  id,
  feedId,
  guid: id,
  title: id,
  link: `https://example.com/${id}`,
  published: 0,
  fetchedAt: 0,
  read: 0,
  starred: false,
  popularity: 1,
  hot,
});
const folder1 = {id: 'f1', title: 'Tech', createdAt: 0};
const folder2 = {id: 'f2', title: 'News', createdAt: 0};
const tFeedA = {id: 'fa', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0};
const tFeedB = {id: 'fb', title: 'B', url: 'https://b.example/rss', folderIds: ['f2'], unread: 0, addedAt: 0};
const tFeedC = {id: 'fc', title: 'C', url: 'https://c.example/rss', folderIds: ['f1', 'f2'], unread: 0, addedAt: 0};
const dayArticles = [
  mkArticle('a1', 'fa', 10),
  mkArticle('a2', 'fa', 5),
  mkArticle('a3', 'fa', 1),
  mkArticle('b1', 'fb', 7),
  mkArticle('c1', 'fc', 9),
];

const allSections = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 2);
assert(allSections.length === 2, 'today sections cover both folders');
assert(allSections[0].folder.id === 'f1' && allSections[1].folder.id === 'f2', 'today sections keep sidebar folder order');
assert(allSections[0].articles.map((a) => a.id).join(',') === 'a1,c1', 'today section takes the hottest per folder');
assert(allSections[1].articles.map((a) => a.id).join(',') === 'c1,b1', 'today section interleaves shared-feed articles by hot');

const excludedSections = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], ['f2'], 2);
assert(excludedSections.length === 1 && excludedSections[0].folder.id === 'f1', 'today sections skip excluded folders');

const oneEach = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 1);
assert(oneEach[0].articles.length === 1 && oneEach[0].articles[0].id === 'a1', 'today per-folder amount is honored');
assert(oneEach[1].articles[0].id === 'c1', 'today per-folder amount applies to every folder');

const emptySections = buildTodaySections([], [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 5);
assert(emptySections.length === 0, 'today sections omit folders with no articles today');
assert(
  buildTodaySections(dayArticles, [tFeedA], [folder1], [], 5).length === 1,
  'today sections drop articles of unknown feeds',
);

const mixedRead = dayArticles.map((a) => a.id === 'a1' ? {...a, read: 1 as const} : a);
const unreadOnly = buildTodaySections(mixedRead, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 2, true);
assert(
  unreadOnly[0].articles.map((a) => a.id).join(',') === 'c1,a2',
  'today unread-only skips read articles before taking the per-folder quota',
);

// ---- api.ts: apiUrl joins base + path ----
import {apiUrl} from '../src/services/api';
import {buildMigratePayload} from '../src/services/migrate-export';

assert(apiUrl('/library').endsWith('/api/library'), 'apiUrl appends path to /api base');
assert(apiUrl('/feeds').endsWith('/api/feeds'), 'apiUrl handles /feeds path');

// ---- migrate-export: buildMigratePayload shape + aff: filtering ----
const migrateFolders = [
    {id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0},
    {id: 'f2', title: 'News', createdAt: 0, sortOrder: 1},
];
const migrateFeeds = [
    {id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0},
    {id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: ['f1', 'f2'], unread: 0, addedAt: 0},
];
const migrateArticles = [
    {id: 'a:1', feedId: 'a', guid: '1', title: 'Art 1', link: 'https://a.example/1', published: 0, fetchedAt: 0, read: 1 as const, starred: true, popularity: 1, hot: 0},
    {id: 'b:2', feedId: 'b', guid: '2', title: 'Art 2', link: 'https://b.example/2', published: 0, fetchedAt: 0, read: 0 as const, starred: false, popularity: 1, hot: 0},
];
const metaEntries = [
    {key: 'aff:feed:a', value: 5},
    {key: 'aff:domain:example.com', value: 3},
    {key: 'other-key', value: 'ignored'},
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
assert(payload.affinity.every((a) => a.key.startsWith('aff:')), 'migrate payload affinity keys start with aff:');

// ---- OPML import/export route through the server library ----
{
    const {exportOpml, importOpmlXml} = await import('../src/services/api');
    const shims = globalThis as Record<string, unknown>;
    const seen: Array<{url: string; auth: string | null; body: string | null}> = [];
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    shims['fetch'] = async (url: unknown, init?: {headers?: Record<string, string>; body?: unknown}) => {
        seen.push({url: String(url), auth: init?.headers?.['Authorization'] ?? null, body: typeof init?.body === 'string' ? init.body : null});
        if (String(url).endsWith('/api/opml') && (init as {method?: string} | undefined)?.method !== 'GET' && seen.length === 1) {
            return new Response(
                JSON.stringify({
                    addedFeeds: 2,
                    addedFolders: 1,
                    subscribedFeeds: 2,
                    skippedFeeds: 0,
                    folders: [{id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0}],
                    feeds: [
                        {id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0},
                        {id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0},
                    ],
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}},
            );
        }
        return new Response('<opml></opml>', {status: 200, headers: {'Content-Type': 'text/xml'}});
    };
    try {
        const imported = await importOpmlXml('<opml></opml>');
        assert(imported.addedFeeds === 2 && imported.addedFolders === 1, 'OPML import returns server counts');
        assert(imported.feeds.length === 2 && imported.folders.length === 1, 'OPML import returns names for instant paint');
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

// ---- server AI summarize: use when available, local fallback ----
{
    const {resetServerAi, summarizeBest, summarizeWithServer} = await import('../src/ai');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    const realLM = (shims as Record<string, unknown>)['LanguageModel'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const seen: Array<{url: string; auth: string | null; body: string | null}> = [];
    let summarizeMode: 'ok' | 'fail' = 'ok';
    let serverAvailable = true;
    shims['fetch'] = async (url: unknown, init?: {headers?: Record<string, string>; body?: unknown}) => {
        const path = String(url);
        seen.push({url: path, auth: init?.headers?.['Authorization'] ?? null, body: typeof init?.body === 'string' ? init.body : null});
        if (path.endsWith('/api/ai/status')) {
            return new Response(JSON.stringify({available: serverAvailable, provider: 'ollama', model: 'qwen3:8b'}), {
                status: 200,
                headers: {'Content-Type': 'application/json'},
            });
        }
        if (path.endsWith('/api/ai/summarize')) {
            if (summarizeMode === 'fail') {
                return new Response(JSON.stringify({error: 'internal error'}), {status: 500, headers: {'Content-Type': 'application/json'}});
            }
            return new Response(JSON.stringify({summary: '- server'}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        throw new Error('unexpected ' + path);
    };
    (shims as Record<string, unknown>)['LanguageModel'] = {
        availability: async () => 'available',
        create: async () => ({prompt: async () => 'LOCAL', destroy: () => {}}),
    };
    try {
        resetServerAi();
        assert((await summarizeWithServer('T', 'body')) === '- server', 'server summarize returns model text');
        assert(seen.some((s) => s.url.endsWith('/api/ai/summarize') && (s.body?.includes('"title":"T"') ?? false)), 'server summarize posts title and text');
        assert(seen.some((s) => s.url.endsWith('/api/ai/summarize') && (s.body?.includes('"length":"standard"') ?? false)), 'server summarize posts the default length');
        assert(seen.every((s) => s.auth === 'Bearer test-access'), 'server AI sends the Bearer token');

        resetServerAi();
        assert((await summarizeBest('T', 'body')) === '- server', 'best uses the server when available');

        summarizeMode = 'fail';
        resetServerAi();
        assert((await summarizeBest('T', 'body')) === 'LOCAL', 'best falls back to local when the server fails');

        summarizeMode = 'ok';
        serverAvailable = false;
        resetServerAi();
        const before = seen.length;
        assert((await summarizeBest('T', 'body')) === 'LOCAL', 'best uses local when no server is configured');
        assert(!seen.slice(before).some((s) => s.url.endsWith('/api/ai/summarize')), 'no summarize call without a server');
    } finally {
        (shims as Record<string, unknown>)['LanguageModel'] = realLM;
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- library fetch paints folders, then names, then badges ----
{
    const {queryClient, libraryKey, fetchLibrary, bustCounts} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    const realSet = queryClient.setQueryData.bind(queryClient) as (...a: never[]) => unknown;
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const order: string[] = [];
    const paints: Array<{folders: number; unread: Array<[string, number]>}> = [];
    queryClient.setQueryData(libraryKey, {
        folders: [],
        feeds: [
            {id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 5, addedAt: 0},
            {id: 'z', title: 'Z', url: 'https://z.example/rss', folderIds: [], unread: 9, addedAt: 0},
        ],
    });
    (queryClient as {setQueryData: (...a: never[]) => unknown}).setQueryData = (...a: never[]) => {
        const out = realSet(...a);
        const cur = queryClient.getQueryData(libraryKey) as {folders: unknown[]; feeds: Array<{id: string; unread: number}>};
        paints.push({folders: cur.folders.length, unread: cur.feeds.map((f) => [f.id, f.unread])});
        return out;
    };
    shims['fetch'] = async (url: unknown) => {
        const path = String(url);
        if (path.endsWith('/api/library/counts')) {
            order.push('counts');
            return new Response(JSON.stringify({counts: {a: 7}}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        if (path.endsWith('/api/library/feeds')) {
            order.push('feeds');
            return new Response(
                JSON.stringify({
                    feeds: [
                        {id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0},
                        {id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0},
                    ],
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}},
            );
        }
        order.push('folders');
        return new Response(
            JSON.stringify({folders: [{id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0}]}),
            {status: 200, headers: {'Content-Type': 'application/json'}},
        );
    };
    try {
        const merged = await fetchLibrary();
        assert(order.join(',') === 'folders,feeds,counts', 'library fetches folders before names before counts');
        assert(paints.length === 3, 'library paints three stages');
        assert(paints[0].folders === 1 && paints[0].unread.length === 2, 'folders paint before feed names');
        assert(JSON.stringify(paints[1].unread) === JSON.stringify([['a', 5], ['b', 0]]), 'names keep seen badges without flashing to zero');
        assert(merged.feeds[0].unread === 7, 'library merges counts into badges');
        const cached = queryClient.getQueryData(libraryKey) as {feeds: Array<{unread: number}>};
        assert(cached.feeds[0].unread === 7, 'merged library survives in cache');

        shims['fetch'] = async (url: unknown) => {
            if (String(url).endsWith('/api/library/counts')) {
                return new Response(JSON.stringify({error: 'internal error'}), {status: 500, headers: {'Content-Type': 'application/json'}});
            }
            if (String(url).endsWith('/api/library/feeds')) {
                return new Response(
                    JSON.stringify({
                        feeds: [
                            {id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0},
                            {id: 'b', title: 'B', url: 'https://b.example/rss', folderIds: [], unread: 0, addedAt: 0},
                        ],
                    }),
                    {status: 200, headers: {'Content-Type': 'application/json'}},
                );
            }
            return new Response(JSON.stringify({folders: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
        };
        const fallback = await (async () => {
            bustCounts();
            return fetchLibrary();
        })();
        assert(fallback.feeds.length === 2 && fallback.feeds[0].unread === 7, 'counts failure keeps seen badges');

        shims['fetch'] = async (url: unknown) => {
            if (String(url).endsWith('/api/library/folders')) {
                return new Response(JSON.stringify({folders: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
            }
            return new Response(JSON.stringify({error: 'internal error'}), {status: 500, headers: {'Content-Type': 'application/json'}});
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
            feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 4, addedAt: 0}],
        });
        const warm = await fetchLibrary();
        assert(warm.feeds.length === 1 && warm.feeds[0].unread === 4, 'warm feeds failure keeps painted feeds');

        shims['fetch'] = async () => new Response(JSON.stringify({error: 'internal error'}), {status: 500, headers: {'Content-Type': 'application/json'}});
        const warmFolders = await fetchLibrary();
        assert(warmFolders.feeds.length === 1 && warmFolders.feeds[0].unread === 4, 'warm folders failure keeps painted library');
    } finally {
        (queryClient as {setQueryData: (...a: never[]) => unknown}).setQueryData = realSet;
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- folder reorder paints optimistically ----
{
    const {queryClient, libraryKey} = await import('../src/query');
    const {moveFeed, reorderFolders} = await import('../src/mutations');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const seen: Array<{url: string; body: string | null}> = [];
    shims['fetch'] = async (url: unknown, init?: {body?: unknown}) => {
        seen.push({url: String(url), body: typeof init?.body === 'string' ? init.body : null});
        return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
    };
    try {
        queryClient.setQueryData(libraryKey, {
            folders: [
                {id: 'f1', title: 'A', createdAt: 0, sortOrder: 0},
                {id: 'f2', title: 'B', createdAt: 1, sortOrder: 1},
            ],
            feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0}],
        });
        await reorderFolders(['f2', 'f1']);
        const ordered = queryClient.getQueryData(libraryKey) as {folders: Array<{id: string}>};
        assert(ordered.folders.map((f) => f.id).join(',') === 'f2,f1', 'reorder paints the new order immediately');
        assert(seen[0]?.url.endsWith('/api/folders/reorder') ?? false, 'reorder posts the order');
        assert(seen[0]?.body?.includes('"f2","f1"') ?? false, 'reorder posts ids in drop order');

        await moveFeed('a', 'f2');
        const moved = queryClient.getQueryData(libraryKey) as {feeds: Array<{folderIds: string[]}>};
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
    const {queryClient, fetchLibrary, bustCounts} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    let countsCalls = 0;
    shims['fetch'] = async (url: unknown) => {
        if (String(url).endsWith('/api/library/counts')) {
            countsCalls += 1;
            return new Response(JSON.stringify({counts: {}}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        if (String(url).endsWith('/api/library/feeds')) {
            return new Response(JSON.stringify({feeds: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        return new Response(JSON.stringify({folders: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
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

// ---- superseded counts fetch cannot overwrite post-mark badges ----
{
    const {queryClient, fetchLibrary, bustCounts} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const libBody = JSON.stringify({
        folders: [],
        feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0}],
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
            return new Response(JSON.stringify({counts: {a: 4}}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        return new Response(path.endsWith('/api/library/feeds') ? libBody : JSON.stringify({folders: []}), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        });
    };
    const json = (counts: Record<string, number>) =>
        new Response(JSON.stringify({counts}), {status: 200, headers: {'Content-Type': 'application/json'}});
    try {
        bustCounts();
        const pendingA = fetchLibrary();
        for (let i = 0; i < 20 && countsCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(countsCalls === 1, 'stale fetch reaches the counts gate');
        bustCounts();
        const mergedB = await fetchLibrary();
        assert(mergedB.feeds[0].unread === 4, 'post-mark refetch paints exact badges');
        resolveStale(json({a: 5}));
        await pendingA;
        const cached = queryClient.getQueryData(['library']) as {feeds: Array<{unread: number}>};
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
    const {queryClient, fetchLibrary, bustCounts} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const feedA = JSON.stringify({
        feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0}],
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
            return new Response(feedA, {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        if (path.endsWith('/api/library/counts')) {
            return new Response(JSON.stringify({counts: {a: 4}}), {status: 200, headers: {'Content-Type': 'application/json'}});
        }
        return new Response(JSON.stringify({folders: []}), {status: 200, headers: {'Content-Type': 'application/json'}});
    };
    try {
        queryClient.setQueryData(['library'], {
            folders: [],
            feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: [], unread: 5, addedAt: 0}],
        });
        bustCounts();
        const pendingA = fetchLibrary();
        for (let i = 0; i < 20 && feedsCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(feedsCalls === 1, 'stale fetch reaches the feeds gate');
        bustCounts();
        const mergedB = await fetchLibrary();
        assert(mergedB.feeds[0].unread === 4, 'post-mark refetch paints exact badges');
        resolveStaleFeeds(new Response(feedA, {status: 200, headers: {'Content-Type': 'application/json'}}));
        await pendingA;
        const cached = queryClient.getQueryData(['library']) as {feeds: Array<{unread: number}>};
        assert(cached.feeds[0].unread === 4, 'late superseded feeds paint cannot overwrite badges');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- busted cold fetch restarts instead of stranding ----
{
    const {queryClient, libraryKey, fetchLibrary, bustCounts, invalidateLibrary, QueryController} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    let resolveParkedFolders!: (v: Response) => void;
    let firstFolders = true;
    let foldersCalls = 0;
    const jsonHeaders = {status: 200, headers: {'Content-Type': 'application/json'}};
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
            return new Response(JSON.stringify({folders: [{id: 'f1', title: 'Tech', createdAt: 0, sortOrder: 0}]}), jsonHeaders);
        }
        if (path.endsWith('/api/library/feeds')) {
            return new Response(
                JSON.stringify({
                    feeds: [{id: 'a', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0}],
                }),
                jsonHeaders,
            );
        }
        return new Response(JSON.stringify({counts: {a: 9}}), jsonHeaders);
    };
    const host = {addController(_: unknown) {}, requestUpdate() {}};
    const ctl = new QueryController(host as never, () => ({queryKey: libraryKey, queryFn: () => fetchLibrary()}));
    const wired = ctl as unknown as {hostConnected(): void; hostDisconnected(): void};
    try {
        queryClient.clear();
        bustCounts();
        wired.hostConnected();
        for (let i = 0; i < 50 && foldersCalls === 0; i++) await new Promise((r) => setTimeout(r, 0));
        assert(foldersCalls === 1, 'observer starts the cold fetch');
        bustCounts();
        await invalidateLibrary();
        resolveParkedFolders(new Response(JSON.stringify({folders: []}), jsonHeaders));
        for (let i = 0; i < 200; i++) {
            const cur = queryClient.getQueryData(libraryKey) as {feeds: Array<{unread: number}>} | undefined;
            if (cur && cur.feeds.length === 1 && cur.feeds[0].unread === 9) break;
            await new Promise((r) => setTimeout(r, 0));
        }
        const cached = queryClient.getQueryData(libraryKey) as {feeds: Array<{unread: number}>};
        assert(cached.feeds.length === 1 && cached.feeds[0].unread === 9, 'busted cold fetch restarts and paints exact badges');
    } finally {
        wired.hostDisconnected();
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- overlapping fetches resolve last-starter-wins ----
{
    const {queryClient, fetchLibrary, bustCounts} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const feedAs = (title: string) =>
        JSON.stringify({
            feeds: [{id: 'a', title, url: 'https://a.example/rss', folderIds: [], unread: 0, addedAt: 0}],
        });
    let resolveStaleFeeds!: (v: Response) => void;
    let firstFeeds = true;
    const jsonHeaders = {status: 200, headers: {'Content-Type': 'application/json'}};
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
            return new Response(JSON.stringify({counts: {}}), jsonHeaders);
        }
        return new Response(JSON.stringify({folders: []}), jsonHeaders);
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
        const cached = queryClient.getQueryData(['library']) as {feeds: Array<{title: string}>};
        assert(cached.feeds[0].title === 'B-new', 'older overlapping fetch paints nothing');
    } finally {
        queryClient.clear();
        shims['fetch'] = realFetch;
        shims['window'] = realWindow;
    }
}

// ---- mark-before posts the cutoff and resets the view ----
{
    const {markBeforeAction} = await import('../src/web-components/article-list/article-list-actions');
    const {queryClient: markQueryClient} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    const seen: Array<{url: string; body: string | null}> = [];
    shims['fetch'] = async (url: unknown, init?: {body?: unknown}) => {
        seen.push({url: String(url), body: typeof init?.body === 'string' ? init.body : null});
        return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'Content-Type': 'application/json'}});
    };
    try {
        let resets = 0;
        const host = {
            view: {kind: 'all'},
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
    const {markArticleRead} = await import('../src/mutations');
    const {queryClient: readQueryClient} = await import('../src/query');
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realWindow = shims['window'];
    shims['window'] = {dispatchEvent: () => false};
    const store = (shims['localStorage'] as {setItem: (k: string, v: string) => void} | undefined);
    store?.setItem('rss.auth.tokens', JSON.stringify({access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900}));
    let fail = false;
    shims['fetch'] = async () => {
        if (fail) {
            return new Response(JSON.stringify({error: 'internal error'}), {status: 500, headers: {'Content-Type': 'application/json'}});
        }
        return new Response(JSON.stringify({ok: true, updated: 1}), {status: 200, headers: {'Content-Type': 'application/json'}});
    };
    try {
        assert((await markArticleRead('a:1')) === true, 'markArticleRead resolves true on success');
        fail = true;
        assert((await markArticleRead('a:2')) === false, 'markArticleRead resolves false when the write fails');

        const {openArticleAction, toggleStarAction} = await import('../src/web-components/article-list/article-list-actions');
        const openHost = {
            items: [{id: 'a:1', feedId: 'a', guid: '1', title: 'A', published: 0, fetchedAt: 0, read: 0 as const, starred: false, popularity: 1, hot: 0}],
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

        const starHost = {items: [{...openHost.items[0], read: 1 as const, starred: false}]};
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
assert(firstImageUrl('<p>hi</p><img src="https://img.example/a.jpg">') === 'https://img.example/a.jpg', 'firstImageUrl finds image in article content for card thumbnail');
assert(firstImageUrl('<p>no img</p>') === undefined, 'firstImageUrl returns undefined when content has no image');
assert(firstImageUrl(undefined) === undefined, 'firstImageUrl handles undefined content');
// Browser cards derive the thumbnail from content at render time, not
// from a persisted Article.image column.
const contentWithEnclosure = '<img src="https://media.example/thumb.jpg" alt="">' + '<p>Body</p>';
assert(firstImageUrl(contentWithEnclosure) === 'https://media.example/thumb.jpg', 'firstImageUrl finds prepended enclosure image');

// ---- auth token helpers (login state without browser storage) ----
function fakeJwt(payload: Record<string, unknown>): string {
    const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64({alg: 'RS256'})}.${b64(payload)}.sig`;
}
const freshExp = Math.floor(Date.now() / 1000) + 600;
assert(tokenExp(fakeJwt({exp: freshExp})) === freshExp, 'tokenExp reads exp from the JWT payload');
assert(tokenExp('not-a-jwt') === null, 'tokenExp is null for malformed tokens');
assert(isTokenFresh(freshExp) === true, 'isTokenFresh accepts a token with margin');
assert(isTokenFresh(Math.floor(Date.now() / 1000) + 30) === false, 'isTokenFresh rejects tokens inside the refresh margin');

// Concurrent refreshes share one token request and keep the rotated pair.
{
    const store = new Map<string, string>();
    const shims = globalThis as Record<string, unknown>;
    const realFetch = shims['fetch'];
    const realLocation = shims['location'];
    const realLocalStorage = shims['localStorage'];
    shims['location'] = {origin: 'http://localhost', search: '', assign: () => {}};
    shims['localStorage'] = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    };
    let calls = 0;
    shims['fetch'] = async () => {
        calls += 1;
        return new Response(
            JSON.stringify({
                access_token: fakeJwt({exp: Math.floor(Date.now() / 1000) + 900}),
                refresh_token: 'r-new',
                expires_in: 900,
            }),
            {status: 200, headers: {'Content-Type': 'application/json'}},
        );
    };
    const {refreshTokens} = await import('../src/services/auth');
    store.set(
        'rss.auth.tokens',
        JSON.stringify({access: fakeJwt({exp: 1}), refresh: 'r-old', exp: 1}),
    );
    const [first, second] = await Promise.all([refreshTokens(), refreshTokens()]);
    assert(calls === 1, 'concurrent refreshTokens share one token request');
    assert(first?.refresh === 'r-new' && second?.refresh === 'r-new', 'concurrent refreshes resolve the rotated pair');
    assert(JSON.parse(store.get('rss.auth.tokens') as string).refresh === 'r-new', 'rotated pair survives concurrent refresh');
    shims['fetch'] = realFetch;
    shims['location'] = realLocation;
    shims['localStorage'] = realLocalStorage;
}

// ---- front page sections ----
{
    const {buildFrontPageSections, DEFAULT_FRONT_PAGE_OPTIONS, defaultFrontPageOptions} = await import('../src/services/front-page');
    const {summarizeArticle: summarizeWithLength} = await import('../src/ai');

    assert(
        DEFAULT_FRONT_PAGE_OPTIONS.perFolder === 5 &&
            DEFAULT_FRONT_PAGE_OPTIONS.unreadOnly === false &&
            DEFAULT_FRONT_PAGE_OPTIONS.sinceHours === 48 &&
            DEFAULT_FRONT_PAGE_OPTIONS.minWorthy === 0 &&
            DEFAULT_FRONT_PAGE_OPTIONS.showTopStory &&
            DEFAULT_FRONT_PAGE_OPTIONS.showBreaking &&
            DEFAULT_FRONT_PAGE_OPTIONS.showDeepReads &&
            DEFAULT_FRONT_PAGE_OPTIONS.showByFolder,
        'front page defaults are sane',
    );
    assert(
        JSON.stringify(defaultFrontPageOptions()) === JSON.stringify(DEFAULT_FRONT_PAGE_OPTIONS),
        'defaultFrontPageOptions matches DEFAULT_FRONT_PAGE_OPTIONS',
    );

    const NOW = Date.parse('2025-08-01T12:00:00Z');
    const fpFolders = [
        {id: 'f1', title: 'Tech', createdAt: 0},
        {id: 'f2', title: 'News', createdAt: 0},
    ];
    const fpFeeds = [
        {id: 'fa', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0},
        {id: 'fb', title: 'B', url: 'https://b.example/rss', folderIds: ['f2'], unread: 0, addedAt: 0},
        {id: 'fc', title: 'C', url: 'https://c.example/rss', folderIds: ['f1', 'f2'], unread: 0, addedAt: 0},
    ];
    const fpArticle = (
        id: string,
        feedId: string,
        opts: {worthy: number; hot: number; engagement: number; publishedAgoH: number; read?: 0 | 1},
    ): Article => ({
        id,
        feedId,
        guid: id,
        title: id,
        published: NOW - opts.publishedAgoH * 3_600_000,
        fetchedAt: NOW,
        read: opts.read ?? 0,
        starred: false,
        popularity: 1,
        engagement: opts.engagement,
        hot: opts.hot,
        scores: {worthy: opts.worthy, interest: 1, popularityOutlook: 1, readability: 1},
    });
    const fpArticles = [
        fpArticle('a1', 'fa', {worthy: 9, hot: 10, engagement: 2, publishedAgoH: 1}),
        fpArticle('b1', 'fb', {worthy: 4, hot: 20, engagement: 5, publishedAgoH: 2}),
        fpArticle('c1', 'fc', {worthy: 7, hot: 5, engagement: 10, publishedAgoH: 30}),
    ];

    const sections = buildFrontPageSections(fpArticles, fpFeeds, fpFolders, [], DEFAULT_FRONT_PAGE_OPTIONS, NOW);
    assert(
        sections.map((s) => s.id).join(',') === 'top-story,breaking,deep-reads,folder-f1,folder-f2',
        'front page has global sections first, then folders in sidebar order',
    );
    assert(sections[0].articles.map((a) => a.id).join(',') === 'a1', 'top story is the highest-worthy article');
    assert(sections[1].articles.map((a) => a.id).join(',') === 'b1,a1', 'breaking takes recent stories by hot desc');
    assert(sections[2].articles.map((a) => a.id).join(',') === 'c1,b1,a1', 'deep reads rank by engagement desc');
    assert(sections[3].articles.map((a) => a.id).join(',') === 'a1,c1', 'per-folder sections rank by worthy desc');
    assert(sections[4].articles.map((a) => a.id).join(',') === 'c1,b1', 'shared-feed articles appear in each folder');

    const gated = buildFrontPageSections(fpArticles, fpFeeds, fpFolders, [], {...DEFAULT_FRONT_PAGE_OPTIONS, minWorthy: 100}, NOW);
    assert(!gated.some((s) => s.id === 'top-story'), 'minWorthy gate omits the top story when nothing qualifies');
    assert(gated.length > 0, 'minWorthy gate keeps the other sections');

    const capped = buildFrontPageSections(fpArticles, fpFeeds, fpFolders, [], {...DEFAULT_FRONT_PAGE_OPTIONS, perFolder: 1}, NOW);
    assert(capped.every((s) => s.articles.length <= 1), 'perFolder caps every ranked section');
    assert(capped.find((s) => s.id === 'breaking')?.articles[0].id === 'b1', 'perFolder keeps the hottest breaking story');

    const tied = [
        fpArticle('t-b', 'fa', {worthy: 9, hot: 10, engagement: 1, publishedAgoH: 1}),
        fpArticle('t-a', 'fa', {worthy: 9, hot: 10, engagement: 1, publishedAgoH: 1}),
    ];
    const first = buildFrontPageSections(tied, fpFeeds, fpFolders, [], DEFAULT_FRONT_PAGE_OPTIONS, NOW);
    const second = buildFrontPageSections(tied, fpFeeds, fpFolders, [], DEFAULT_FRONT_PAGE_OPTIONS, NOW);
    assert(first[0].articles[0].id === 't-a', 'ties break on article id (top story)');
    assert(first[1].articles.map((a) => a.id).join(',') === 't-a,t-b', 'ties break on article id (breaking)');
    assert(JSON.stringify(first) === JSON.stringify(second), 'front page ranking is deterministic');

    assert(
        buildFrontPageSections([], fpFeeds, fpFolders, [], DEFAULT_FRONT_PAGE_OPTIONS, NOW).length === 0,
        'front page omits every section for empty input',
    );
    const hidden = buildFrontPageSections(fpArticles, fpFeeds, fpFolders, [], {
        ...DEFAULT_FRONT_PAGE_OPTIONS,
        showTopStory: false,
        showBreaking: false,
        showDeepReads: false,
        showByFolder: false,
    }, NOW);
    assert(hidden.length === 0, 'front page omits every section when all toggles are off');

    const readArticles = fpArticles.map((a) => (a.id === 'a1' ? {...a, read: 1 as const} : a));
    const unreadSections = buildFrontPageSections(readArticles, fpFeeds, fpFolders, [], {...DEFAULT_FRONT_PAGE_OPTIONS, unreadOnly: true}, NOW);
    assert(unreadSections[0].articles[0].id === 'c1', 'unread-only skips read articles before ranking');

    const excluded = buildFrontPageSections(fpArticles, fpFeeds, fpFolders, ['f1'], DEFAULT_FRONT_PAGE_OPTIONS, NOW);
    assert(!excluded.some((s) => s.id === 'folder-f1'), 'front page skips excluded folders');
    assert(excluded.some((s) => s.id === 'folder-f2'), 'front page keeps included folders');
    assert(!excluded.flatMap((s) => s.articles).some((a) => a.id === 'a1'), 'articles of fully-excluded feeds leave the page');

    // ---- router frontpage round-trip ----
    // router.ts builds a hash history at import, so it needs a browser-ish
    // window/document present before the first import.
    {
        const shims = globalThis as Record<string, unknown>;
        const realWindow = shims['window'];
        const realDocument = shims['document'];
        const fakeHistory = {
            state: undefined,
            pushState() {},
            replaceState() {},
            go() {},
            back() {},
            forward() {},
        };
        shims['window'] = {
            dispatchEvent: () => false,
            addEventListener: () => {},
            removeEventListener: () => {},
            history: fakeHistory,
            location: {pathname: '/', search: '', hash: '', href: 'http://localhost/'},
        };
        shims['document'] = {};
        try {
            const {parsePath, viewToPath} = await import('../src/router');
            assert(viewToPath({kind: 'frontpage'}) === '/frontpage', 'frontpage serializes to #/frontpage');
            assert(parsePath('/frontpage').kind === 'frontpage', 'frontpage parses back to a View');
            assert(
                JSON.stringify(parsePath(viewToPath({kind: 'frontpage'}))) === JSON.stringify({kind: 'frontpage'}),
                'frontpage router round-trips',
            );
        } finally {
            shims['window'] = realWindow;
            shims['document'] = realDocument;
        }
    }

    // ---- summary length threads into the prompt ----
    const prompts: string[] = [];
    (g as Record<string, unknown>)['model'] = {
        capabilities: async () => ({available: 'readily'}),
        create: async () => ({
            prompt: async (text: string) => {
                prompts.push(text);
                return 'ok';
            },
            destroy: () => {},
        }),
    };
    await summarizeWithLength('T', 'body', 'brief');
    await summarizeWithLength('T', 'body', 'standard');
    await summarizeWithLength('T', 'body', 'deep');
    assert(prompts[0]?.includes('3 short bullet points') ?? false, 'brief summaries ask for 3 bullets');
    assert(prompts[1]?.includes('4-6 short bullet points') ?? false, 'standard summaries ask for 4-6 bullets');
    assert(prompts[2]?.includes('8-10 short bullet points') ?? false, 'deep summaries ask for 8-10 bullets');
    delete (g as Record<string, unknown>)['model'];
}

// ---- interesting shadow: starred-word map, settings, jev state, router ----
{
    const {buildWordMap, extractWords, interestingScore, topWords, toJevState} = await import('../src/services/interesting-words');
    const {adjustWordMap, isHideReadFolder, loadInterestingShadow, loadWordMap, saveInterestingShadow, saveWordMap} = await import('../src/services/interesting-settings');

    assert(extractWords('The Quick, Brown Fox!').join(',') === 'quick,brown,fox', 'extractWords lowercases and drops stopwords');
    assert(extractWords('Go to Mars').join(',') === 'mars', 'extractWords drops short tokens and stopwords');
    assert(extractWords('the and of').length === 0, 'extractWords empties glue-only titles');

    const starredTitles = [{title: 'Kubernetes Rust Performance'}];
    const readTitles = [{title: 'Kubernetes News Roundup'}];
    const wordMap = buildWordMap(starredTitles, readTitles);
    assert(wordMap['kubernetes'] === 5, 'buildWordMap adds star weight 4 and read weight 1');
    assert(wordMap['rust'] === 4, 'buildWordMap star-only word weighs 4');
    assert(wordMap['news'] === 1, 'buildWordMap read-only word weighs 1');

    assert(interestingScore({title: 'Rust Kubernetes'}, wordMap) === 4.5, 'interestingScore averages weights over tokens');
    assert(interestingScore({title: 'Unrelated Zebra'}, wordMap) === 0, 'interestingScore is 0 for unknown words');
    assert(interestingScore({title: 'the!'}, wordMap) === 0, 'interestingScore is 0 for empty token lists');

    const top = topWords({b: 2, a: 2, c: 1}, 2);
    assert(top.map((w) => w.word).join(',') === 'a,b', 'topWords breaks ties alphabetically');
    assert(topWords({a: 1}, 0).length === 0, 'topWords with n=0 returns empty');

    const shims = globalThis as Record<string, unknown>;
    const mem = new Map<string, string>();
    shims['localStorage'] = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
    };
    saveInterestingShadow({f1: true});
    assert(loadInterestingShadow()['f1'] === true, 'interesting shadow settings round-trip');
    mem.set('rss-reader:interesting-shadow', 'oops');
    assert(Object.keys(loadInterestingShadow()).length === 0, 'interesting shadow falls back to {} on invalid JSON');
    mem.set('rss-reader:interesting-shadow', JSON.stringify({f1: 'yes', f2: 1}));
    assert(Object.keys(loadInterestingShadow()).length === 0, 'interesting shadow keeps true-valued string keys only');

    saveWordMap({rust: 4});
    assert(loadWordMap()['rust'] === 4, 'word map settings round-trip');
    adjustWordMap('Rust Performance', 4);
    assert(loadWordMap()['rust'] === 8, 'adjustWordMap adds star weight to cached words');
    adjustWordMap('Rust Performance', -8);
    assert(loadWordMap()['rust'] === undefined, 'adjustWordMap clamps to zero and removes the entry');
    mem.set('rss-reader:word-map', JSON.stringify({rust: 'lots'}));
    assert(loadWordMap()['rust'] === undefined, 'word map drops non-numeric entries');
    saveWordMap({});
    mem.delete('rss-reader:word-map-ids');
    adjustWordMap('Rust Performance', 4, 'a1');
    adjustWordMap('Rust Performance', 4, 'a1');
    assert(loadWordMap()['rust'] === 4, 'adjustWordMap counts one article once');
    adjustWordMap('Rust Performance', -4, 'a1');
    assert(loadWordMap()['rust'] === undefined, 'adjustWordMap unstar forgets the id');
    adjustWordMap('Rust Performance', 4, 'a1');
    assert(loadWordMap()['rust'] === 4, 'adjustWordMap re-star counts again');

    mem.set('rss-reader:hide-read-by-folder', JSON.stringify({f1: true}));
    assert(isHideReadFolder('f1') === true, 'hide-read lookup follows the folder toggle');
    assert(isHideReadFolder('f2') === false, 'hide-read lookup defaults to false');

    const candidates = [
        {id: 'a1', title: 'Rust Kubernetes Guide', feedId: 'fa', hot: 10},
        {id: 'a2', title: 'Zebra News', feedId: 'fb', hot: 5},
        {id: 'a3', title: 'Rust Performance Tips', feedId: 'fa', hot: 8},
    ];
    const full = toJevState(candidates, wordMap, {'aff:feed:fa': 3}, 100_000);
    const parsedFull = JSON.parse(full) as {candidates: Array<{id: string; title: string; feed: string; hot: number}>};
    assert(parsedFull.candidates.length === 3, 'toJevState keeps all candidates when under budget');
    assert(parsedFull.candidates[0].feed === 'fa' && typeof parsedFull.candidates[0].hot === 'number', 'toJevState candidates carry feed and hot');
    const tight = toJevState(candidates, wordMap, {'aff:feed:fa': 3}, 200);
    assert(tight.length <= 200, 'toJevState never exceeds maxChars');
    const parsedTight = JSON.parse(tight) as {candidates: Array<{id: string; title: string; feed: string; hot: number}>};
    assert(parsedTight.candidates.length < parsedFull.candidates.length, 'toJevState drops whole candidates over budget');
    for (const c of parsedTight.candidates) {
        assert(typeof c.id === 'string' && typeof c.title === 'string' && typeof c.feed === 'string' && typeof c.hot === 'number', 'toJevState never truncates mid-article');
    }

    const {parsePath, viewToPath} = await import('../src/router');
    assert(viewToPath({kind: 'interesting', folderId: 'f 1'}) === '/interesting/f%201', 'interesting serializes to #/interesting/:id');
    assert(
        JSON.stringify(parsePath(viewToPath({kind: 'interesting', folderId: 'f1'}))) === JSON.stringify({kind: 'interesting', folderId: 'f1'}),
        'interesting router round-trips',
    );

    const {interestingKey} = await import('../src/query');
    const keyJson = JSON.stringify(interestingKey({folderId: 'f1', limit: 200}));
    assert(keyJson.includes('f1') && keyJson.includes('200'), 'interestingKey includes every param');
}

console.log('\nAll parser smoke tests passed.');
