import { refreshFeed, refreshFolder, syncAllFeeds } from '../../mutations';
import { toastApiError } from '../../services/toast';
import { feedsForView, viewRefreshKeyOf } from './article-list-helpers';
import { resetList } from './article-list-loading';
import type { Feed, View } from '../../types';

/**
 * How often the ingest watch re-reads the library while a refresh settles.
 * Each tick is a small folders+feeds fetch; counts stay on their own throttle.
 */
export const INGEST_POLL_MS = 5_000;
/** Give up waiting for the poller after this long; the button clears anyway. */
export const INGEST_WAIT_MS = 10 * 60_000;

/** Everything a refresh job reads and writes on the component. */
export interface RefreshHost {
    view: View;
    reset(): Promise<void>;
    /** In-flight refresh jobs by view key. The component owns the map. */
    refreshJobs: Map<string, Promise<void>>;
    setRefreshingKey(key: string, active: boolean): void;
    libraryFeeds(): Feed[];
    refreshTick(): Promise<void>;
    isAlive(): boolean;
}

/** Component state behind the refresh surface: spinner keys and the deferred background refresh. */
export interface RefreshStateHost {
    view: View;
    active: boolean;
    unreadOnly: boolean;
    hideRead: boolean;
    pendingFeedsRefresh: boolean;
    activeRefreshKeys: string[];
    library: { data?: { feeds: Feed[] } };
}

/** True while this view's own refresh job runs. Other folders track their own keys. */
export function isRefreshing(host: RefreshStateHost): boolean {
    return host.activeRefreshKeys.includes(viewRefreshKeyOf(host.view));
}

export function setRefreshingKey(host: RefreshStateHost, key: string, active: boolean): void {
    const has = host.activeRefreshKeys.includes(key);
    if (active && !has) host.activeRefreshKeys = [...host.activeRefreshKeys, key];
    else if (!active && has) host.activeRefreshKeys = host.activeRefreshKeys.filter((k) => k !== key);
}

export function libraryFeedsOf(host: RefreshStateHost): Feed[] {
    return host.library.data?.feeds ?? [];
}

/** A background refresh arrived while the article overlay had focus; apply it once active again. */
export function onFeedsRefreshedAction(host: RefreshStateHost): void {
    if (!host.active) {
        host.pendingFeedsRefresh = true;
        return;
    }
    host.pendingFeedsRefresh = false;
    void resetList(host as never);
}

/** Runs from updated(): a refresh deferred while inactive fires once the view is active again. */
export function applyPendingFeedsRefresh(host: RefreshStateHost, changed: Map<string, unknown>): void {
    if (!changed.has('active') || !host.active || !host.pendingFeedsRefresh) return;
    host.pendingFeedsRefresh = false;
    if (!host.unreadOnly && !host.hideRead) void resetList(host as never);
}

/**
 * Elevator button per view key. Mashing Refresh on a refreshing folder joins
 * that folder's in-flight job instead of queueing a second sync, and a
 * different folder runs its own job — navigating between them never mixes
 * the two buttons. The job covers queueing plus the poller ingest (see
 * waitForIngest), so the button reads "Refreshing…" until the folder's
 * feeds actually report back, not just until the queue call returns.
 */
export async function refreshViewAction(host: RefreshHost, key: string): Promise<void> {
    const existing = host.refreshJobs.get(key);
    if (existing) {
        await existing;
        return;
    }
    const job = runRefreshJob(host, key);
    host.refreshJobs.set(key, job);
    try {
        await job;
    } finally {
        if (host.refreshJobs.get(key) === job) host.refreshJobs.delete(key);
    }
}

async function runRefreshJob(host: RefreshHost, key: string): Promise<void> {
    // Pin the view at click time. The component's view is mutable: reading
    // it after an await would let a navigation mid-queue sync the wrong
    // folder and wait on the wrong feeds under this key.
    const view = host.view;
    host.setRefreshingKey(key, true);
    try {
        const startedAt = Date.now();
        const queued = await queueSync(view);
        // The list reset runs even when queueing failed so the view is never
        // stuck on "Refreshing…", but a failed queue skips the ingest watch:
        // nothing was queued, so there is nothing to wait for. Resets only
        // touch the view that started the job; a view navigated to since
        // loads itself.
        if (sameView(host.view, view)) await host.reset();
        if (queued) {
            await waitForIngest(
                host,
                feedsForView(view, { feeds: host.libraryFeeds() }).map((f) => f.id),
                startedAt,
            );
            if (sameView(host.view, view)) await host.reset();
        }
    } catch (err) {
        console.error('refresh job failed', err);
    } finally {
        host.setRefreshingKey(key, false);
    }
}

/** Same view when kind and, where present, id match. */
function sameView(a: View, b: View): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'feed' || a.kind === 'folder' || a.kind === 'interesting') {
        return b.kind === a.kind && b.id === a.id;
    }
    return true;
}

async function queueSync(view: View): Promise<boolean> {
    try {
        if (view.kind === 'feed') await refreshFeed(view.id);
        else if (view.kind === 'folder' || view.kind === 'interesting') await refreshFolder(view.id);
        else await syncAllFeeds();
        return true;
    } catch (err) {
        // A silent refresh is why "latest" never feels trustworthy.
        toastApiError(err, 'Could not refresh. Check your connection and try again.');
        return false;
    }
}

/**
 * Wait until every snapshotted feed reports a fetch at or after the refresh
 * started. The server nulls lastFetchedAt when POST /sync queues a feed and
 * restamps it when the poller finishes that feed (ok, not-modified, or
 * error — an error row still counts as finished and shows its warning).
 * Feeds that vanished mid-refresh count as done. Times out so a stuck
 * poller cannot pin the button forever. The loop rechecks liveness every
 * step, so disconnecting the element ends the wait with it.
 */
export async function waitForIngest(
    host: RefreshHost,
    feedIds: string[],
    startedAt: number,
    pollMs: number = INGEST_POLL_MS,
    waitMs: number = INGEST_WAIT_MS,
): Promise<void> {
    if (!feedIds.length) return;
    const deadline = startedAt + waitMs;
    while (host.isAlive()) {
        await host.refreshTick();
        if (!host.isAlive()) return;
        if (ingestDone(host.libraryFeeds(), feedIds, startedAt)) return;
        if (Date.now() >= deadline) return;
        await delay(pollMs);
    }
}

/** True when every feed reported back after the refresh started. */
export function ingestDone(feeds: Feed[], feedIds: string[], startedAt: number): boolean {
    for (const id of feedIds) {
        const feed = feeds.find((f) => f.id === id);
        if (!feed) continue;
        if ((feed.lastFetchedAt ?? 0) < startedAt) return false;
    }
    return true;
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
