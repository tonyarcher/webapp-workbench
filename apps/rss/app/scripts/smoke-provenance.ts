// N6 provenance: one narrow read, stable evidence ids, and a safe markdown copy.
import { fetchArticleProvenance, type ArticleProvenance } from '../src/services/api-provenance';
import { provenanceToMarkdown } from '../src/services/provenance-export';
import { assert } from './smoke-assert';

const shims = globalThis as Record<string, unknown>;
const realFetch = shims['fetch'];
const realWindow = shims['window'];
const calls: string[] = [];
shims['window'] = { dispatchEvent: () => false };
const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
store?.setItem(
    'rss.auth.tokens',
    JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
);

const sample: ArticleProvenance = {
    articleId: 'a1',
    source: {
        articleId: 'a1',
        feedId: 'f1',
        feedTitle: 'Example Feed',
        sourceKind: 'scrape',
        connectorId: 'rss',
        connectorVersion: '1',
        fetchMode: 'full',
        canonicalUrl: 'javascript:alert(1)',
        sourceUrl: 'https://example.com/original',
        fetchedAt: 1_700_000_000_000,
    },
    quotes: [
        {
            id: 'stable-id',
            articleId: 'a1',
            kind: 'quote',
            text: 'The minister said the plan would cost 3.4 billion dollars.',
        },
    ],
    figures: [],
};
shims['fetch'] = async (url: unknown) => {
    calls.push(String(url));
    return new Response(JSON.stringify(sample), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

try {
    const result = await fetchArticleProvenance('a:1');
    assert(result?.articleId === 'a1', 'provenance loads for the open article');
    assert(calls.length === 1, 'provenance is requested once');
    assert(calls[0]!.endsWith('/api/articles/a%3A1/provenance'), 'provenance uses the narrow route');
    assert(result?.quotes[0]?.id === 'stable-id', 'evidence ids survive the client boundary');

    const markdown = provenanceToMarkdown(result!);
    assert(markdown.includes('- Origin: scrape / full'), 'export reports the P12 source type and fetch mode');
    assert(markdown.includes('## Evidence — Example Feed'), 'export names the source feed');
    assert(markdown.includes('> The minister said'), 'export keeps the verbatim quote');
    assert(markdown.includes('`stable-id`'), 'export keeps the stable evidence id');
    assert(markdown.includes('https://example.com/original'), 'export falls back to the safe source URL');
    assert(!markdown.includes('javascript:'), 'untrusted URLs never reach the export');
    assert(markdown.includes('No figures found.'), 'empty evidence groups are stated');
} finally {
    shims['fetch'] = realFetch;
    shims['window'] = realWindow;
}
