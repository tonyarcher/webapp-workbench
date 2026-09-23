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

interface OpenHost {
    items: Article[];
    cursor: number;
    dispatchEvent(e: Event): boolean;
    library: { data?: { feeds: Feed[]; folders: unknown } };
}

export async function openArticleAction(host: OpenHost, article: Article) {
    if (article.read === 0) {
        host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 1 } : a));
        if (!(await markArticleRead(article.id))) {
            host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 0 } : a));
        }
        void queryClient.invalidateQueries({ queryKey: libraryKey });
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
        else if (host.view.kind === 'folder') for (const feed of host.folderFeeds()) await markAllRead(feed.id);
        else await markAllRead();
    } else {
        const feedIds =
            host.view.kind === 'feed'
                ? [host.view.id]
                : host.view.kind === 'folder'
                  ? host.folderFeeds().map((f) => f.id)
                  : undefined;
        await markReadBefore(feedIds, cutoff);
    }
    host.hideRead = true;
    await host.reset();
}

export async function runRefreshAction(
    view: View,
    host: { reset(): Promise<void> },
    setRefreshing: (v: boolean) => void,
    refreshGenRef: { value: number },
) {
    const mine = ++refreshGenRef.value;
    setRefreshing(true);
    try {
        if (view.kind === 'feed') await refreshFeed(view.id);
        else if (view.kind === 'folder') await refreshFolder(view.id);
        else await syncAllFeeds();
    } catch {
        // surfaced elsewhere
    } finally {
        try {
            await host.reset();
        } finally {
            if (mine === refreshGenRef.value) setRefreshing(false);
        }
    }
}

interface RefreshHost {
    view: View;
    refreshing: boolean;
    refreshJob: Promise<void> | null;
    refreshJobKey: string | null;
    refreshGenRef: { value: number };
    reset(): Promise<void>;
}

/**
 * Elevator button for the current view only. A different folder/feed
 * starts its own job instead of waiting on an unrelated sync.
 */
export async function refreshViewAction(host: RefreshHost, key: string): Promise<void> {
    if (host.refreshJob && host.refreshJobKey === key) {
        await host.refreshJob;
        return;
    }
    const job = runRefreshAction(
        host.view,
        { reset: () => host.reset() },
        (v) => {
            host.refreshing = v;
        },
        host.refreshGenRef,
    );
    host.refreshJob = job;
    host.refreshJobKey = key;
    try {
        await job;
    } finally {
        if (host.refreshJob === job) {
            host.refreshJob = null;
            host.refreshJobKey = null;
        }
    }
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
    if (document.querySelector('dialog[open]')) return true;
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
