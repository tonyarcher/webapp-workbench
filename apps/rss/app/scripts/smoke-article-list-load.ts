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
