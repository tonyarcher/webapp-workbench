import { libraryKey, queryClient } from '../../query';
import {
    markAllRead,
    markArticleRead,
    markReadBefore,
    markShownRead,
    refreshFeed,
    refreshFolder,
    syncAllFeeds,
    toggleStar,
} from '../../mutations';
import type { Article, Feed, ListViewType, View } from '../../types';
import { feedsForView } from './article-list-helpers';
import { listShortcut } from '../../services/shortcuts';
import { isModalOpen } from '../../services/modal-guard';
import { toastApiError } from '../../services/toast';

interface OpenHost {
    items: Article[];
    cursor: number;
    dispatchEvent(e: Event): boolean;
    library: { data?: { feeds: Feed[]; folders: unknown } };
}

export async function openArticleAction(host: OpenHost, article: Article) {
    let pending: Promise<void> | undefined;
    if (article.read === 0) {
        // Optimistic: paint the row read and open the overlay now; the
        // network write and cache invalidations settle after the event so
        // they never delay the reader, but the returned promise still waits
        // for them (tests and callers can observe completion/revert).
        host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 1 } : a));
        pending = markArticleRead(article.id)
            .then((ok) => {
                if (!ok) {
                    host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 0 } : a));
                }
                void queryClient.invalidateQueries({ queryKey: libraryKey });
            })
            .catch(() => {
                host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 0 } : a));
                void queryClient.invalidateQueries({ queryKey: libraryKey });
            });
    }
    const index = host.items.findIndex((a) => a.id === article.id);
    host.cursor = index;
    host.dispatchEvent(
        new CustomEvent('open-article', {
            detail: { article, index, items: host.items },
            bubbles: true,
            composed: true,
        }),
    );
    await pending;
}

export async function toggleStarAction(host: { items: Article[] }, article: Article) {
    const starred = !article.starred;
    host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred } : a));
    if (!(await toggleStar(article.id, starred))) {
        host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred: article.starred } : a));
    }
}

export async function markShownReadAction(host: { items: Article[]; hideRead: boolean; reset(): Promise<void> }) {
    const ids = host.items.filter((a) => a.read === 0).map((a) => a.id);
    if (!ids.length) return;
    await markShownRead(ids);
    host.hideRead = true;
    await host.reset();
}

export async function markBeforeAction(
    host: { view: View; hideRead: boolean; reset(): Promise<void>; folderFeeds(): Feed[] },
    cutoff: number | null,
) {
    if (cutoff === null) {
        if (host.view.kind === 'feed') await markAllRead(host.view.id);
        else if (host.view.kind === 'folder' || host.view.kind === 'interesting')
            for (const feed of host.folderFeeds()) await markAllRead(feed.id);
        else await markAllRead();
    } else {
        const feedIds =
            host.view.kind === 'feed'
                ? [host.view.id]
                : host.view.kind === 'folder' || host.view.kind === 'interesting'
                  ? host.folderFeeds().map((f) => f.id)
                  : undefined;
        await markReadBefore(feedIds, cutoff);
    }
    host.hideRead = true;
    await host.reset();
}

/**
 * How often the ingest watch re-reads the library while a refresh settles.
 * Each tick is a small folders+feeds fetch; counts stay on their own throttle.
 */
export const INGEST_POLL_MS = 5_000;
/** Give up waiting for the poller after this long; the button clears anyway. */
export const INGEST_WAIT_MS = 10 * 60_000;

interface RefreshHost {
    view: View;
    reset(): Promise<void>;
    /** In-flight refresh jobs by view key. The component owns the map. */
    jobs: Map<string, Promise<void>>;
    setRefreshingKey(key: string, active: boolean): void;
    libraryFeeds(): Feed[];
    refreshTick(): Promise<void>;
    isAlive(): boolean;
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
    const existing = host.jobs.get(key);
    if (existing) {
        await existing;
        return;
    }
    const job = runRefreshJob(host, key);
    host.jobs.set(key, job);
    try {
        await job;
    } finally {
        if (host.jobs.get(key) === job) host.jobs.delete(key);
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

interface CursorHost {
    active: boolean;
    items: Article[];
    cursor: number;
    openArticle(article: Article): Promise<void>;
}

function isKeyHandlingIgnored(e: KeyboardEvent, host: CursorHost): boolean {
    if (!host.active) return true;
    if (e.key !== 'j' && e.key !== 'k') return true;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (isModalOpen()) return true;
    if (!host.items.length) return true;
    return false;
}

function nextCursorIndex(key: string, cursor: number, length: number): number {
    return Math.max(0, Math.min(cursor + (key === 'j' ? 1 : -1), length - 1));
}

export function handleCursorKey(host: CursorHost, e: KeyboardEvent): void {
    if (isKeyHandlingIgnored(e, host)) return;
    e.preventDefault();
    const next = nextCursorIndex(e.key, host.cursor, host.items.length);
    host.cursor = next;
    const article = host.items[next];
    if (article) void host.openArticle(article);
}

/** Typing or an open modal dialog: shortcuts stay out of the way. Native
 * dialogs live in shadow roots where document queries cannot see them, so
 * open dialogs announce themselves through the modal guard instead. */
function isShortcutIgnored(e: KeyboardEvent): boolean {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return isModalOpen();
}

export interface ListKeyHost extends CursorHost {
    toggleStarCursor(): void;
    toggleUnread(): void;
    onRefresh(): Promise<unknown>;
    setListView(view: ListViewType): void;
    toggleSelectCursor(): void;
    showShortcuts(): void;
}

/** Single-key shortcuts for the list. j/k keep their cursor behavior. */
export function handleListKey(host: ListKeyHost, e: KeyboardEvent): void {
    if (!host.active) return;
    if (e.key === 'j' || e.key === 'k') {
        handleCursorKey(host, e);
        return;
    }
    if (isShortcutIgnored(e)) return;
    const action = listShortcut(e.key);
    if (action === null || !host.items.length) return;
    e.preventDefault();
    switch (action) {
        case 'star':
            host.toggleStarCursor();
            break;
        case 'unread':
            host.toggleUnread();
            break;
        case 'refresh':
            void host.onRefresh();
            break;
        case 'view-detailed':
            host.setListView('detailed');
            break;
        case 'view-headline':
            host.setListView('headline');
            break;
        case 'view-cards':
            host.setListView('cards');
            break;
        case 'select':
            host.toggleSelectCursor();
            break;
        case 'help':
            host.showShortcuts();
            break;
    }
}

interface ResumeHost {
    items: Article[];
    cursor: number;
    listView: ListViewType;
    cols: number;
    resumeApplied: boolean;
    resumeArticleId: string | null;
    virtualizer: { scrollToIndex(index: number, options: { align: 'center' }): void } | null | undefined;
}

export function applyResumeAction(host: ResumeHost): void {
    if (host.resumeApplied || host.resumeArticleId == null) return;
    host.resumeApplied = true;
    const index = host.items.findIndex((a) => a.id === host.resumeArticleId);
    if (index >= 0) {
        host.cursor = index;
        const target = host.listView === 'cards' ? Math.floor(index / Math.max(1, host.cols)) : index;
        host.virtualizer?.scrollToIndex(target, { align: 'center' });
    }
}
