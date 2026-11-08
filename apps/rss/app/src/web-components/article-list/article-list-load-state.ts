/**
 * The article list's reset/load machine.
 *
 * One page load runs at a time, and everything that wants to replace the list
 * has to wait for something: the load already in flight, or the library query
 * that supplies feed membership for a folder or All/Hot view.
 *
 * Held as three booleans (`loadingRef`, `pendingReset`, `pendingFirstLoad`),
 * that contract was unstated. Consuming a pending reset from `updated()`
 * re-entered `reset()` on every update while the first library fetch was still
 * pending, which is the folder-load hang. The phases below give each waiting
 * state its own value, so a step can only produce one of them:
 *
 *     idle --reset/view--> loading --settle--> idle
 *     loading --reset/view--> again --settle--> loading
 *     idle --view needing library--> awaiting-library --library--> loading
 *     awaiting-library --reset--> loading
 *
 * `gen` is the staleness key: a page result may only be written while its
 * generation still matches `state.gen`. Starting a load and superseding one
 * both bump it, so a load replaced mid-flight cannot land in the new list.
 */

export type LoadPhase = 'idle' | 'loading' | 'again' | 'awaiting-library';

export interface LoadState {
    readonly phase: LoadPhase;
    readonly gen: number;
}

/** One transition: the next state, plus what the caller must do to honour it. */
export interface LoadStep {
    readonly state: LoadState;
    /** Generation to fetch now, or null when this step owes the work later. */
    readonly start: number | null;
    /** True when the caller clears its list and paging state before running. */
    readonly clear: boolean;
}

export function initialLoadState(): LoadState {
    return { phase: 'idle', gen: 0 };
}

function startLoad(state: LoadState, clear: boolean): LoadStep {
    const gen = state.gen + 1;
    return { state: { phase: 'loading', gen }, start: gen, clear };
}

/** The load in flight is now stale: remember exactly one reset for its settle. */
function queueReset(state: LoadState): LoadStep {
    return { state: { phase: 'again', gen: state.gen + 1 }, start: null, clear: true };
}

/**
 * A reset was requested: `feeds-refreshed`, mark-shown-read, the refresh
 * button, or a view change that does not need the library gate.
 */
export function beginReset(state: LoadState): LoadStep {
    if (state.phase === 'loading' || state.phase === 'again') return queueReset(state);
    return startLoad(state, true);
}

/**
 * The view key changed. A folder (or All/Hot) cannot load before the library
 * supplies feed membership, so it parks in `awaiting-library` without clearing
 * the list it is about to replace. An explicit reset while parked still loads
 * with the feed set it has; the feed-set key reloads it when the library lands.
 */
export function viewChanged(state: LoadState, needsLibrary: boolean, libraryReady: boolean): LoadStep {
    if (needsLibrary && !libraryReady) {
        return { state: { phase: 'awaiting-library', gen: state.gen }, start: null, clear: false };
    }
    return beginReset(state);
}

/** The library query resolved while a reset was parked. Releases the gate once. */
export function libraryArrived(state: LoadState): LoadStep {
    if (state.phase !== 'awaiting-library') return { state, start: null, clear: false };
    return startLoad(state, true);
}

/** The in-flight load finished, successfully or not. */
export function loadSettled(state: LoadState): LoadStep {
    if (state.phase === 'again') return startLoad(state, false);
    if (state.phase === 'loading') return { state: { phase: 'idle', gen: state.gen }, start: null, clear: false };
    return { state, start: null, clear: false };
}

/** Scroll paging appends the next page. Only meaningful from idle; a reset wins. */
export function pageRequested(state: LoadState): LoadStep {
    if (state.phase !== 'idle') return { state, start: null, clear: false };
    return startLoad(state, false);
}

/**
 * The render flag: a fetch is in flight, or its replacement is queued behind
 * it. `again` still counts as loading because the list was cleared and the
 * next fetch starts the moment this one settles.
 */
export function isLoading(state: LoadState): boolean {
    return state.phase === 'loading' || state.phase === 'again';
}

/** No reset is owed or running. */
export function isIdle(state: LoadState): boolean {
    return state.phase === 'idle';
}
