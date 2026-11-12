// Load-machine smoke: the article list's reset/load coordination.
//
// The component used to hold this as `loadingRef` + `pendingReset` +
// `pendingFirstLoad`. These assertions pin the transitions the folder-load hang
// came from: a parked view releases exactly once, and a superseded load keeps
// an older generation than the list that replaced it.
import {
    beginReset,
    initialLoadState,
    isIdle,
    isLoading,
    libraryArrived,
    loadSettled,
    pageRequested,
    viewChanged,
} from '../src/web-components/article-list/article-list-load-state';
import { assert } from './smoke-assert';

// ---- idle -> loading ----
const fresh = initialLoadState();
assert(fresh.phase === 'idle' && fresh.gen === 0, 'the load machine starts idle at generation 0');
assert(isIdle(fresh) && !isLoading(fresh), 'idle is not loading');

const first = beginReset(fresh);
assert(first.clear, 'a reset from idle clears the list');
assert(first.state.phase === 'loading', 'a reset from idle starts loading');
assert(first.start === 1 && first.state.gen === 1, 'the first load runs at generation 1');
assert(isLoading(first.state) && !isIdle(first.state), 'a started load reports loading');

// ---- a reset while loading queues, and invalidates the load ----
const queued = beginReset(first.state);
assert(queued.state.phase === 'again', 'a reset during a load queues instead of starting');
assert(queued.start === null, 'the queued reset has nothing to start yet');
assert(queued.clear, 'a reset during a load still clears the list it replaces');
assert(queued.state.gen === 2, 'the queued reset invalidates the in-flight generation');
assert(isLoading(queued.state), 'a queued reset still reports loading, so the cleared list never renders as empty');

const queuedTwice = beginReset(queued.state);
assert(queuedTwice.state.phase === 'again', 'a second reset while queued still owes one reset');
assert(queuedTwice.start === null, 'a second reset while queued does not start a load');

// ---- settle runs exactly one owed reset ----
const rerun = loadSettled(queuedTwice.state);
assert(rerun.state.phase === 'loading', 'settling a queued reset starts the next load');
assert(rerun.start === 4 && rerun.state.gen === 4, 'the owed load runs at a fresh generation');
assert(!rerun.clear, 'the owed reset does not clear twice');

const done = loadSettled(rerun.state);
assert(done.state.phase === 'idle' && done.start === null, 'settling the last load returns to idle');

// ---- the library gate ----
const parked = viewChanged(fresh, true, false);
assert(parked.state.phase === 'awaiting-library', 'a folder or All/Hot view parks until the library arrives');
assert(parked.start === null, 'a parked view does not load against an empty feed set');
assert(!parked.clear, 'a parked view keeps the list it is about to replace');

const parkedReset = beginReset(parked.state);
assert(
    parkedReset.state.phase === 'loading' && parkedReset.start === 1,
    'an explicit reset while parked loads with the feed set it has',
);
assert(parkedReset.clear, 'an explicit reset while parked clears the list');
assert(
    libraryArrived(parkedReset.state).start === null,
    'the library cannot restart a load that an explicit reset already started',
);

const released = libraryArrived(parked.state);
assert(released.state.phase === 'loading' && released.start === 1, 'the library arriving starts the parked reset');
assert(released.clear, 'the released reset clears before loading');

const releasedAgain = libraryArrived(released.state);
assert(
    releasedAgain.start === null && releasedAgain.state.phase === 'loading',
    'the gate releases once; a later library update cannot start a second load',
);

const notParked = libraryArrived(fresh);
assert(
    notParked.start === null && notParked.state.phase === 'idle',
    'a library resolve with nothing parked is a no-op',
);

// ---- a view change ----
const ready = viewChanged(fresh, true, true);
assert(
    ready.state.phase === 'loading' && ready.start === 1,
    'a library-dependent view loads once the library is ready',
);
assert(ready.clear, 'a ready view change clears the previous list');

const simple = viewChanged(fresh, false, false);
assert(simple.state.phase === 'loading' && simple.start === 1, 'a feed view loads without the library');

const during = viewChanged({ phase: 'loading', gen: 7 }, false, true);
assert(during.state.phase === 'again', 'a view change during a load queues one reset');
assert(
    during.state.gen === 8 && during.start === null,
    'a view change during a load invalidates the in-flight generation',
);
assert(during.clear, 'a view change during a load replaces the visible list');

// ---- scroll paging ----
const page = pageRequested(fresh);
assert(page.state.phase === 'loading' && page.start === 1, 'scroll paging starts a load from idle');
assert(!page.clear, 'scroll paging keeps the accumulated items');

const blockedPage = pageRequested(first.state);
assert(
    blockedPage.start === null && blockedPage.state.phase === 'loading',
    'scroll paging never starts while a load is in flight',
);

const queuedPage = pageRequested(queued.state);
assert(
    queuedPage.start === null && queuedPage.state.phase === 'again',
    'scroll paging never replaces the reset already owed',
);

// ---- empty-state copy names the active filter ----
{
    const { emptyTextFor } = await import('../src/web-components/article-list/article-list-render');
    assert(
        emptyTextFor(true, false, false) === 'Nothing unread here — "Unread only" is filtering this view.',
        'unread-only keeps the unread-only copy',
    );
    assert(
        emptyTextFor(false, true, false) === 'Nothing unread here — the shown articles were just marked as read.',
        'mark-shown-read names itself instead of blaming Unread only',
    );
    assert(
        emptyTextFor(true, true, false) === 'Nothing unread here — "Unread only" is filtering this view.',
        'both filters keep the unread-only copy',
    );
    assert(
        emptyTextFor(false, false, true) === 'Nothing here yet. Star articles to teach this view what you like.',
        'empty Interesting view invites starring',
    );
    assert(
        emptyTextFor(false, false, false) === 'No articles yet. Hit Refresh to sync this view.',
        'unfiltered empty view suggests a refresh',
    );
}

// ---- freshness label reads the view's own feeds ----
{
    const { describeFreshness, freshestFetchAt, scopeFeedsFor } =
        await import('../src/web-components/article-list/article-list-helpers');
    const library = {
        feeds: [
            {
                id: 'a',
                title: 'A',
                url: 'https://a.example',
                folderIds: ['f1'],
                unread: 3,
                addedAt: 0,
                lastFetchedAt: 1_000,
            },
            {
                id: 'b',
                title: 'B',
                url: 'https://b.example',
                folderIds: ['f2'],
                unread: 0,
                addedAt: 0,
                lastFetchedAt: 2_000,
            },
            { id: 'c', title: 'C', url: 'https://c.example', folderIds: [], unread: 0, addedAt: 0 },
        ],
    };
    assert(
        scopeFeedsFor({ kind: 'folder', id: 'f1' }, library)
            .map((f) => f.id)
            .join(',') === 'a',
        'folder scope reads its own feeds',
    );
    assert(
        scopeFeedsFor({ kind: 'interesting', id: 'f2' }, library)
            .map((f) => f.id)
            .join(',') === 'b',
        'Interesting scope reads its own feeds',
    );
    assert(
        scopeFeedsFor({ kind: 'feed', id: 'b' }, library)
            .map((f) => f.id)
            .join(',') === 'b',
        'feed scope reads one feed',
    );
    assert(scopeFeedsFor({ kind: 'all' }, library).length === 3, 'All scope reads every feed');
    assert(scopeFeedsFor({ kind: 'folder', id: 'f1' }, undefined).length === 0, 'no library means no feeds');
    assert(
        freshestFetchAt({ kind: 'folder', id: 'f1' }, library) === 1_000,
        'freshness takes the newest fetch in scope',
    );
    assert(freshestFetchAt({ kind: 'all' }, library) === 2_000, 'All freshness takes the newest fetch anywhere');
    assert(freshestFetchAt({ kind: 'feed', id: 'c' }, library) === null, 'no reported fetch means no label');
    assert(describeFreshness(null, 9_000) === '', 'missing fetch renders nothing');
    assert(describeFreshness(9_000, 9_000) === 'Updated just now', 'sub-minute freshness is just now');
    assert(describeFreshness(9_000, 10_000) === 'Updated just now', 'future timestamps read as just now');
    assert(describeFreshness(0, 120_000) === 'Updated 2m ago', 'minute freshness counts minutes');
    assert(describeFreshness(0, 3_600_000) === 'Updated 1h ago', 'hour freshness counts hours');
    assert(describeFreshness(0, 172_800_000) === 'Updated 2d ago', 'day freshness counts days');
}
