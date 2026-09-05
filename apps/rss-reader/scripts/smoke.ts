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

(globalThis as Record<string, unknown>).DOMParser = DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = XMLSerializer;

function assert(cond: boolean, msg: string): asserts cond {
    if (!cond) {
        throw new Error(`FAIL: ${msg}`);
    }
    console.log(`ok: ${msg}`);
}

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
        await fetchFeedText('https://ok.example/big');
    } catch (err) {
        oversized = err instanceof FetchError && err.message === 'Feed is too large';
    }
    assert(oversized, 'fetchFeedText rejects oversized responses');

    g2.fetch = async () => {
        throw new DOMException('aborted', 'AbortError');
    };
    let timedOut = false;
    try {
        await fetchFeedText('https://ok.example/slow');
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
    throw new Error('boom');
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

// ---- image derivation (thumbnail without a dedicated column) ----
assert(firstImageUrl('<p>hi</p><img src="https://img.example/a.jpg">') === 'https://img.example/a.jpg', 'firstImageUrl finds image in article content for card thumbnail');
assert(firstImageUrl('<p>no img</p>') === undefined, 'firstImageUrl returns undefined when content has no image');
assert(firstImageUrl(undefined) === undefined, 'firstImageUrl handles undefined content');
// Browser cards derive the thumbnail from content at render time, not
// from a persisted Article.image column.
const contentWithEnclosure = '<img src="https://media.example/thumb.jpg" alt="">' + '<p>Body</p>';
assert(firstImageUrl(contentWithEnclosure) === 'https://media.example/thumb.jpg', 'firstImageUrl finds prepended enclosure image');

console.log('\nAll parser smoke tests passed.');
