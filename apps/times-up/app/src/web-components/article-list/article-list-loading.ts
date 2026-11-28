import { Virtualizer } from '@tanstack/virtual-core';
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';
import { beginReset, loadSettled, pageRequested, type LoadState, type LoadStep } from './article-list-load-state';
import { loadFolderPageAction, loadSearchPageAction, loadSinglePageAction } from './article-list-paging';
import { interestingActiveFor, loadInterestingBatchAction } from './article-list-interesting';
import { applyResumeAction, insertArticleForReveal } from './article-list-targets';
import { folderFeedsOf, virtualizerOptionsFor } from './article-list-helpers';
import { fetchLibrary, libraryKey, queryClient } from '../../query';
import { clearSelectionAction } from './article-list-selection';
import { partitionPriorityArticles } from '../../services/priority-inbox';
import { activeSnoozedIds, loadSnoozed } from '../../services/snooze';

/** Everything the list loader reads and writes on the component. */
export interface LoadingHost {
    view: View;
    items: Article[];
    loadError: string | null;
    loadState: LoadState;
    cursors: Map<string, string | undefined>;
    feedHasMore: Map<string, boolean>;
    hasMoreSingle: boolean;
    cursor: number;
    feedWindowOffset: number;
    lastFeedSetKey: string;
    lastAutoMark: number;
    selectedIds: string[];
    selectAnchor: number;
    hideRead: boolean;
    priorityOnly: boolean;
    priorityHidden: number;
    sort: ArticleSort;
    pageSize: number;
    listView: ListViewType;
    cols: number;
    mutedHidden: number;
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement> | undefined;
    virtualizerCleanup?: () => void;
    scrollElRef: { value: HTMLDivElement | null };
    library: { data?: { feeds: Feed[]; folders: Folder[] } };
    resumeApplied: boolean;
    resumeArticleId: string | null;
    deepLinkArticleId: string | null;
    deepLinkArticle: Article | null;
}

/** Replace the list for the current view. The load machine decides whether
 * this starts now, queues behind the load in flight, or waits for the
 * library; `clear` is set on every path that replaces the list. */
export async function resetList(host: LoadingHost): Promise<void> {
    await applyStep(host, beginReset(host.loadState));
}

/** Infinite-scroll paging: append the next page, but only from idle. */
export async function loadNextPageAction(host: LoadingHost): Promise<void> {
    await applyStep(host, pageRequested(host.loadState));
}

/** Applies one load-machine transition; paging appends, resets replace. */
export async function applyStep(host: LoadingHost, step: LoadStep): Promise<void> {
    if (step.clear) clearList(host);
    host.loadState = step.state;
    if (step.start !== null) await runLoad(host, step.start);
}

export function clearList(host: LoadingHost): void {
    host.items = [];
    host.loadError = null;
    host.mutedHidden = 0;
    host.priorityHidden = 0;
    host.lastAutoMark = 0;
    clearSelectionAction(host);
    host.cursors.clear();
    host.feedHasMore.clear();
    host.hasMoreSingle = true;
    host.cursor = -1;
    host.resumeApplied = false;
    host.feedWindowOffset = 0;
    host.lastFeedSetKey = feedSetKey(host);
    const el = host.scrollElRef.value;
    if (el) el.scrollTop = 0;
    reinitVirtualizer(host);
}

export function reinitVirtualizer(host: LoadingHost): void {
    host.virtualizerCleanup?.();
    host.virtualizer = new Virtualizer(virtualizerOptionsFor(host as never));
    host.virtualizer._willUpdate();
    host.virtualizerCleanup = host.virtualizer._didMount();
}

/**
 * Fetch the page for `gen`. Pages accumulate (infinite scroll); the paging
 * actions drop a result whose generation no longer matches, so a superseded
 * load cannot be written into the list that replaced it. A failure sets a
 * banner instead of an empty list: without it the view reads as "no
 * articles" while the sidebar badge still counts them.
 */
export async function runLoad(host: LoadingHost, gen: number): Promise<void> {
    try {
        await loadPageSource(host, gen);
        const snoozed = activeSnoozedIds(loadSnoozed());
        host.items = host.items.filter((article) => !snoozed.has(article.id));
        applyPriorityFilter(host);
        if (host.deepLinkArticle) host.items = insertArticleForReveal(host.items, host.deepLinkArticle, host.sort);
        applyResumeAction(host as never);
    } catch (err) {
        console.error('article page load failed', err);
        if (gen === host.loadState.gen) {
            host.loadError = 'Could not load articles. Check your connection and try again.';
        }
    } finally {
        const step = loadSettled(host.loadState);
        host.loadState = step.state;
        if (step.start !== null) void runLoad(host, step.start);
    }
}

function applyPriorityFilter(host: LoadingHost): void {
    if (!host.priorityOnly) {
        host.priorityHidden = 0;
        return;
    }
    const { keep, hidden } = partitionPriorityArticles(host.items);
    host.items = keep;
    host.priorityHidden += hidden.length;
}

async function loadPageSource(host: LoadingHost, gen: number): Promise<void> {
    if (interestingActiveFor(host.view)) {
        return loadInterestingBatchAction(host as never, gen);
    }
    if (host.view.kind === 'search') {
        return loadSearchPageAction(host as never, gen);
    }
    if (host.view.kind === 'folder' || host.view.kind === 'interesting') {
        return loadFolderPageAction(host as never, gen);
    }
    return loadSinglePageAction(host as never, gen);
}

/**
 * The loader depends on library feed membership in two views: a folder
 * (its feeds) and All/Hot (every feed). `fetchLibrary()` paints feeds
 * after folders, so the first load can run against an empty set. Reload
 * when the set changes, or the view stays empty until something else
 * resets it.
 */
export function feedSetKey(host: LoadingHost): string {
    if (host.view.kind === 'folder' || host.view.kind === 'interesting') {
        return folderFeedsOf(host.view, host.library.data)
            .map((f) => f.id)
            .join(',');
    }
    if (host.view.kind === 'all' && host.sort === 'hot') {
        return (host.library.data?.feeds ?? []).map((f) => f.id).join(',');
    }
    return '';
}

export function needsLibrary(host: LoadingHost): boolean {
    return (
        host.view.kind === 'folder' ||
        host.view.kind === 'interesting' ||
        (host.view.kind === 'all' && host.sort === 'hot')
    );
}

export function refreshFeedSetKey(host: LoadingHost): void {
    if (
        host.view.kind !== 'folder' &&
        host.view.kind !== 'interesting' &&
        !(host.view.kind === 'all' && host.sort === 'hot')
    )
        return;
    const key = feedSetKey(host);
    if (key === host.lastFeedSetKey) return;
    host.lastFeedSetKey = key;
    void resetList(host);
}

export function canLoadMore(host: LoadingHost): boolean {
    if (host.view.kind === 'search') return false;
    if (host.items.length >= host.pageSize) return false;
    if (
        host.view.kind === 'feed' ||
        host.view.kind === 'folder' ||
        host.view.kind === 'interesting' ||
        (host.view.kind === 'all' && host.sort !== 'hot')
    ) {
        return host.hasMoreSingle;
    }
    const feeds = host.library.data?.feeds ?? [];
    if (!feeds.length) return false;
    return feeds.some((f) => host.feedHasMore.get(f.id) !== false);
}

export function retryLibrary(): void {
    void queryClient.invalidateQueries({ queryKey: libraryKey });
}

export async function refetchLibrary(): Promise<void> {
    await fetchLibrary();
}
