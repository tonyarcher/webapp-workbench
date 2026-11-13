/**
 * Foreground feed sync: while the reader tab is visible and focused, ask the
 * server to fetch the feeds for the current view and reload when they land.
 * The batch poller is deliberately slow for idle users; an open tab should
 * feel current like a hosted reader. The manual Refresh button still owns
 * user-visible failures, so this loop stays quiet.
 */
import { fetchLibrary, libraryKey, queryClient, type LibraryData } from '../query';
import { syncAllFeeds } from '../mutations';

export const AUTO_SYNC_MS = 5 * 60_000;
/** Returning to the tab forces a sync only after this long, so alt-tabbing is cheap. */
export const FOCUS_SYNC_GAP_MS = 60_000;
/** Give the poller time to drain a large library; a partial refresh still reloads. */
const INGEST_WAIT_MS = 120_000;
const INGEST_POLL_MS = 2_000;

export interface AutoSyncState {
    hidden: boolean;
    focused: boolean;
    lastSyncAt: number;
    now: number;
    gapMs: number;
}

/** A sync is due only when the tab is visible, focused, and past the gap. */
export function autoSyncDue(state: AutoSyncState): boolean {
    if (state.hidden || !state.focused) return false;
    return state.now - state.lastSyncAt >= state.gapMs;
}

let started = false;
let timer: number | null = null;
let running = false;
let lastSyncAt = 0;
/** Bumped on every start/stop so a run from the previous account cannot win. */
let runGen = 0;
let feedIdsForView: (() => string[] | undefined) | null = null;

export function startForegroundSync(getFeedIds: () => string[] | undefined): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    runGen++;
    feedIdsForView = getFeedIds;
    window.addEventListener('focus', onFocusOrVisibility);
    document.addEventListener('visibilitychange', onFocusOrVisibility);
    timer = window.setInterval(() => {
        void runSync();
    }, AUTO_SYNC_MS);
    if (!document.hidden && document.hasFocus()) void runSync();
}

export function stopForegroundSync(): void {
    if (!started || typeof window === 'undefined') return;
    started = false;
    runGen++;
    if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
    }
    window.removeEventListener('focus', onFocusOrVisibility);
    document.removeEventListener('visibilitychange', onFocusOrVisibility);
    feedIdsForView = null;
    running = false;
    lastSyncAt = 0;
}

function onFocusOrVisibility(): void {
    void runSync();
}

async function runSync(): Promise<void> {
    if (!started || running) return;
    if (
        !autoSyncDue({
            hidden: document.hidden,
            focused: document.hasFocus(),
            lastSyncAt,
            now: Date.now(),
            gapMs: FOCUS_SYNC_GAP_MS,
        })
    ) {
        return;
    }
    running = true;
    const gen = runGen;
    const startedAt = Date.now();
    try {
        const feedIds = feedIdsForView?.();
        await syncAllFeeds(undefined, feedIds);
        if (gen !== runGen || !started) return;
        const ids = feedIds ?? (libraryFeeds() ?? []).map((f) => f.id);
        await waitForFeeds(ids, startedAt, gen);
        if (gen === runGen && started) window.dispatchEvent(new CustomEvent('feeds-refreshed'));
    } catch {
        // Quiet: a scheduled fetch must not toast at the reader every few minutes.
    } finally {
        // A stopped/restarted session owns a newer generation; leave its state alone.
        if (gen === runGen) {
            running = false;
            lastSyncAt = Date.now();
        }
    }
}

function libraryFeeds() {
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    return lib?.feeds;
}

/** Poll the library until every requested feed reports a fetch after `startedAt`. */
async function waitForFeeds(feedIds: string[], startedAt: number, gen: number): Promise<void> {
    if (!feedIds.length) return;
    const deadline = startedAt + INGEST_WAIT_MS;
    while (started && gen === runGen && !document.hidden) {
        await fetchLibrary();
        if (gen !== runGen || !started) return;
        if (allFetched(feedIds, startedAt)) return;
        if (Date.now() >= deadline) return;
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, INGEST_POLL_MS);
        });
    }
}

function allFetched(feedIds: string[], startedAt: number): boolean {
    const feeds = libraryFeeds() ?? [];
    for (const id of feedIds) {
        const feed = feeds.find((f) => f.id === id);
        if (!feed) continue;
        if ((feed.lastFetchedAt ?? 0) < startedAt) return false;
    }
    return true;
}
