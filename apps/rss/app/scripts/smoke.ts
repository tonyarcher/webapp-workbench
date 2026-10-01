// Smoke suite for the reader app: `tsx scripts/smoke.ts` (part of `npm test`).
// Each phase lives in a sibling ./smoke-*.ts module and runs in the order below;
// every assertion prints `ok: ...` and a failure throws.
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { API_VERSION, API_VERSION_HEADER } from '../src/services/api';
import { assert } from './smoke-assert';

(globalThis as Record<string, unknown>).DOMParser = DOMParser;
(globalThis as Record<string, unknown>).XMLSerializer = XMLSerializer;

// src/query.ts gives cached queries a 5-minute gcTime. Disconnecting a
// QueryController unsubscribes its observer, which arms that timer, and a module
// that then clears the cache leaves the timer with no query to cancel it -- so
// the timer outlives the process's real work and holds the event loop open for
// the full 5 minutes. Measured: 274ms of assertions in a 301s process.
//
// Shorten gcTime before the phases run so any such timer expires immediately.
// Clearing the cache afterwards does not help: the query is already gone, so
// there is nothing left for clear(), cancelQueries() or destroy() to act on.
//
// The timer itself cannot be observed from here, so the guard below asserts the
// mechanism instead: a long-lived timer that is never cancelled is what hangs the
// process, and the phases must not arm one.
const { queryClient } = await import('../src/query.js');
// setDefaultOptions replaces the whole defaults object rather than merging, so
// spread the existing query defaults and change only gcTime. Passing a bare
// { gcTime } would drop staleTime, refetchOnWindowFocus and retry, and the retry
// default is load-bearing: phases assert on first-try rejection then retry.
const queryDefaults = { ...queryClient.getDefaultOptions().queries };
queryClient.setDefaultOptions({ queries: { ...queryDefaults, gcTime: 1 } });

const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const uncancelled = new Map<unknown, number>();

(globalThis as Record<string, unknown>).setTimeout = (
    fn: (...a: unknown[]) => void,
    delay = 0,
    ...rest: unknown[]
): unknown => {
    // Under a second is ordinary test pacing; anything longer is what pins the
    // event loop open after the assertions finish.
    const tracked = delay > 1000;
    const wrapped = (...args: unknown[]): void => {
        if (tracked) uncancelled.delete(handle);
        fn(...args);
    };
    const handle = realSetTimeout(wrapped, delay, ...rest);
    // A timer that fires is no longer holding the loop open, so drop it from the
    // map as well as on clearTimeout. Otherwise a long timer that simply elapses
    // (proxy.ts arms a 20s abort timer per fetch) would fail the guard spuriously.
    if (tracked) uncancelled.set(handle, delay);
    return handle;
};

(globalThis as Record<string, unknown>).clearTimeout = (handle: unknown): void => {
    uncancelled.delete(handle);
    realClearTimeout(handle as Parameters<typeof realClearTimeout>[0]);
};

assert(API_VERSION_HEADER === 'X-Api-Version' && API_VERSION === '1', 'api version header');

await import('./smoke-feed.js');
await import('./smoke-ai.js');
await import('./smoke-proxy.js');
await import('./smoke-pagination.js');
await import('./smoke-coalesce.js');
await import('./smoke-settings.js');
await import('./smoke-api.js');
await import('./smoke-server-ai.js');
await import('./smoke-query.js');
await import('./smoke-fetch-races.js');
await import('./smoke-mutations.js');
await import('./smoke-auth.js');
await import('./smoke-router.js');
await import('./smoke-summary.js');
await import('./smoke-interesting.js');
await import('./smoke-edition.js');
await import('./smoke-router-guard.js');
await import('./smoke-sidebar.js');

// Without the gcTime override above, smoke-fetch-races leaves a 300s gc timer
// pending and this phase takes five minutes to finish. Assert the mechanism so
// the speedup cannot silently regress: no uncancelled long timer survives.
const stuck = [...uncancelled.values()];
assert(
    stuck.length === 0,
    stuck.length === 0
        ? 'no uncancelled long timer outlives the phases'
        : `uncancelled timers outlive the phases: ${stuck.map((d) => `${d}ms`).join(', ')}`,
);

console.log('\nAll parser smoke tests passed.');
