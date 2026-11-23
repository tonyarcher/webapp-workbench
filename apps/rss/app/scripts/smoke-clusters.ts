// B7: the article panel reads a learned cluster, never article text.
import { fetchArticleCluster } from '../src/services/api-clusters';
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
shims['fetch'] = async (url: unknown) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ id: 'topic:1', label: 'battery grid', memberCount: 4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
};

try {
    const cluster = await fetchArticleCluster('a:1');
    assert(cluster?.label === 'battery grid', 'the open article loads its learned cluster');
    assert(cluster?.memberCount === 4, 'the cluster carries its member count');
    assert(calls.length === 1, 'the cluster is requested once');
    assert(calls[0]!.endsWith('/api/articles/a%3A1/cluster'), 'cluster reads use the narrow route');
    assert(!calls[0]!.includes('/body'), 'cluster reads never request article text');
} finally {
    shims['fetch'] = realFetch;
    shims['window'] = realWindow;
}
