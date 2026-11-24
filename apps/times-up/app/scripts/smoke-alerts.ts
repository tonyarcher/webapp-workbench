// F1 alerts: narrow fetch, full article rows, and deep-linkable hits.
import { fetchAlerts } from '../src/services/api-alerts';
import type { Article } from '../src/types';
import { assert } from './smoke-assert';

const shims = globalThis as Record<string, unknown>;
const realFetch = shims['fetch'];
const realWindow = shims['window'];
const calls: string[] = [];
shims['window'] = { dispatchEvent: () => false };
const store = shims['localStorage'] as { setItem: (k: string, v: string) => void } | undefined;
store?.setItem(
    'times-up.auth.tokens',
    JSON.stringify({ access: 'test-access', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 900 }),
);
const hit: Article = {
    id: 'a1',
    feedId: 'f1',
    guid: 'g1',
    title: 'Grid storage expands',
    read: 0,
    starred: false,
    popularity: 0,
    hot: 0,
    published: 1_700_000_000_000,
    fetchedAt: 1_700_000_000_000,
};
shims['fetch'] = async (url: unknown) => {
    calls.push(String(url));
    return new Response(
        JSON.stringify({ alerts: [{ id: 's1', title: 'Battery', query: 'battery grid', hits: [hit] }] }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    );
};

try {
    const alerts = await fetchAlerts();
    assert(alerts.length === 1, 'alerts load from the narrow route');
    assert(alerts[0]!.hits[0]!.id === 'a1', 'an alert carries a full article the shell can open');
    assert(calls.length === 1 && calls[0]!.endsWith('/api/alerts'), 'alerts use the alerts route');
    assert(!calls[0]!.includes('/body'), 'alerts never request article bodies');
} finally {
    shims['fetch'] = realFetch;
    shims['window'] = realWindow;
}
