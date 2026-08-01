import { DOMParser } from '@xmldom/xmldom';
import { parseFeedXml, parseOpml, stripHtml, sanitizeHtml, isFolder } from '../src/services/parser';
import { normalizeLink, popularityScore, hotScore } from '../src/services/ranking';
import { aiAvailability, aiDiagnostics, aiStatusMessage, runAiPrompt, resetAiAvailability, summarizeArticle } from '../src/ai';

(globalThis as Record<string, unknown>).DOMParser = DOMParser;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
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
assert(parsed.items[0].content?.includes('<b>content</b>'), 'item content:encoded kept');

const sanitized = sanitizeHtml('<p>ok</p><script>bad()</script><img src="x" onerror="bad()">');
assert(!sanitized.includes('<script'), 'sanitize removes script');
assert(!sanitized.includes('onerror'), 'sanitize removes on* attrs');

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
assert(atomParsed.items[0].content?.includes('Atom content'), 'atom content');
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
assert(hotScore(1, t) < hotScore(1, t + 45_000), 'newer article ranks hotter');
assert(hotScore(1, t) < hotScore(10, t), 'higher popularity ranks hotter at same age');
assert(hotScore(1, t + 45_000) < hotScore(10, t), '10x popularity offsets ~12.5h age (hot gravity)');
assert(Number.isFinite(hotScore(1, 0)), 'hotScore finite for very old article');

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

// ---- AI module (mock Chrome's built-in model) ----
const g = globalThis as unknown as Record<string, unknown>;
const encoder = new TextEncoder();

resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'ai unavailable when no model API present');

let capturedSystem: string | undefined;
g.model = {
  capabilities: async () => ({ available: 'readily' }),
  create: async ({ systemPrompt }: { systemPrompt?: string }) => {
    capturedSystem = systemPrompt;
    return {
      prompt: async (text: string) => `SUMMARY[${text.slice(0, 59)}]`,
      destroy: () => {},
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
  capabilities: async () => ({ available: 'readily' }),
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
      destroy: () => {},
    };
  },
};
const streamed = await runAiPrompt('x');
assert(streamed === 'streamed result', 'runAiPrompt consumes a streaming response');

g.model = {
  capabilities: async () => ({ available: 'after-download' }),
  create: async () => {
    throw new Error('should not be called');
  },
};
resetAiAvailability();
assert((await aiAvailability()) === 'after-download', 'ai availability reports after-download');
delete g.model;

// capabilities reports readily but no create() exists -> must be treated as unsupported
g.model = {
  capabilities: async () => ({ available: 'readily' }),
};
resetAiAvailability();
assert((await aiAvailability()) === 'unsupported', 'readily without a create() is reported as unsupported');
delete g.model;

assert(
  aiStatusMessage('unsupported').includes('Gemini Nano'),
  'aiStatusMessage gives actionable guidance for unsupported',
);
assert(
  aiStatusMessage('after-download').includes('downloading'),
  'aiStatusMessage covers after-download',
);
assert(aiStatusMessage('readily') === '', 'aiStatusMessage empty when readily');

// diagnostics surface what Chrome exposes
g.model = {
  capabilities: async () => ({ available: 'readily' }),
  create: async () => ({ prompt: async (t: string) => t, destroy: () => {} }),
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

console.log('\nAll parser smoke tests passed.');
