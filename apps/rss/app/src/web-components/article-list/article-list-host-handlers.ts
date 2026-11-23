import { queryClient, libraryKey } from '../../query';
import { toastApiError, toastInfo } from '../../services/toast';
import { peekMuteUndo, restoreMuteUndo } from '../../services/mute-rules';
import { setInterestingHideRead } from '../../services/interesting-counts';
import { invalidateInterestingBatch } from '../../services/interesting-counts-refresh';
import { clampInterestingStrictness } from '../../services/interesting-words';
import { loadInterestingStrictness, saveInterestingStrictness } from '../../services/interesting-settings';
import { isIdle } from './article-list-load-state';
import { applyStep, canLoadMore, loadNextPageAction, needsLibrary, refreshFeedSetKey } from './article-list-loading';
import { libraryArrived, viewChanged } from './article-list-load-state';
import { markBeforeAction } from './article-list-actions';
import { markAboveViewport } from './article-list-selection';
import {
    applyDefaultToAllViews,
    describeFreshness,
    folderFeedsOf,
    freshestFetchAt,
    loadViewSettingsFor,
    normalizeViewSettings,
    saveViewSettingsFor,
    scopeLabelOf,
} from './article-list-helpers';
import type { Article, ArticleSort, Feed, ListViewType, View } from '../../types';

export function onArticleStarred(host: any, e: Event): void {
    const { id, starred } = (e as CustomEvent<{ id: string; starred: boolean }>).detail;
    let changed = false;
    host.items = host.items.map((a: Article) => {
        if (a.id === id && a.starred !== starred) {
            changed = true;
            return { ...a, starred };
        }
        return a;
    });
    if (changed) host.requestUpdate();
}

export function onArticleRead(host: any, e: Event): void {
    const detail = (e as CustomEvent<string | { id: string; read: 0 | 1 }>).detail;
    const id = typeof detail === 'string' ? detail : detail.id;
    const read = typeof detail === 'string' ? 1 : detail.read;
    let changed = false;
    host.items = host.items.map((a: Article) => {
        if (a.id === id && a.read !== read) {
            changed = true;
            return { ...a, read };
        }
        return a;
    });
    if (changed) host.requestUpdate();
}

export function syncInterestingCount(host: any, changed: Map<string, unknown>): void {
    const view = host.view as View;
    if (view.kind !== 'interesting') {
        if (host.interestingHideReadFolderId) {
            setInterestingHideRead(host.interestingHideReadFolderId, false);
            host.interestingHideReadFolderId = null;
        }
        return;
    }
    if (host.interestingHideReadFolderId && host.interestingHideReadFolderId !== view.id) {
        setInterestingHideRead(host.interestingHideReadFolderId, false);
    }
    host.interestingHideReadFolderId = view.id;
    if (changed.has('hideRead') && host.hideRead) invalidateInterestingBatch(view.id);
    setInterestingHideRead(view.id, host.hideRead);
}

export function currentViewKey(host: any): string {
    const strict = host.view.kind === 'interesting' ? `|strict:${host.interestingStrictness}` : '';
    const search = host.view.kind === 'search' ? `|search:${host.searchScope}` : '';
    return `${JSON.stringify(host.view)}|${host.unreadOnly}|${host.sort}|${host.listView}|${host.pageSize}${strict}${search}`;
}

export function handleUpdate(host: any, viewKey: string): void {
    if (viewKey !== host.lastViewKey) {
        loadViewSettingsFor(host);
        host.lastViewKey = currentViewKey(host);
        void applyStep(host, viewChanged(host.loadState, needsLibrary(host), host.library.data !== undefined));
        return;
    }
    if (host.loadState.phase === 'awaiting-library' && host.library.data) {
        void applyStep(host, libraryArrived(host.loadState));
        return;
    }
    refreshFeedSetKey(host);
}

export function onScroll(host: any): void {
    if (host.markOnScroll) void markAboveViewport(host);
    if (!isIdle(host.loadState) || !canLoadMore(host)) return;
    const el = host.scrollElRef.value;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) void loadNextPageAction(host);
}

export function loadViewSettings(host: any): void {
    loadViewSettingsFor(host);
    if (host.view.kind === 'interesting') host.interestingStrictness = loadInterestingStrictness(host.view.id);
}

export function saveViewSettings(host: any): void {
    saveViewSettingsFor(host);
}

/** The Advanced menu's contextual "make this the default everywhere" action. */
export function applyAllViewsAction(host: any): void {
    const settings = normalizeViewSettings({
        listView: host.listView,
        sort: host.sort,
        pageSize: host.pageSize,
        maxCardCols: host.maxCardCols,
        unreadOnly: host.unreadOnly,
        hideRead: host.view?.kind === 'interesting' ? host.hideRead : false,
        markOnScroll: host.markOnScroll,
    });
    applyDefaultToAllViews(settings);
    window.dispatchEvent(new CustomEvent('view-settings-changed'));
    toastInfo('Applied this view to all views');
}

/** Toolbar and shortcut mutators: each writes its setting, then persists the per-view prefs. */
export function toggleUnread(host: any): void {
    if (host.view?.kind === 'interesting') {
        // Interesting ranks a bounded recent batch; server-side unreadOnly starves it.
        // Hide-read is the client-side equivalent.
        host.hideRead = !host.hideRead;
        saveViewSettings(host);
        void host.reset();
        return;
    }
    host.unreadOnly = !host.unreadOnly;
    saveViewSettings(host);
}

export function setListViewPref(host: any, listView: ListViewType): void {
    host.listView = listView;
    saveViewSettings(host);
    host.updateCols();
}

export function setSortPref(host: any, sort: ArticleSort): void {
    host.sort = sort;
    saveViewSettings(host);
}

export function onInterestingStrictness(host: any, e: Event): void {
    if (host.view.kind !== 'interesting') return;
    const next = clampInterestingStrictness(Number((e.target as HTMLInputElement).value));
    host.interestingStrictness = next;
    saveInterestingStrictness(host.view.id, next);
}

export async function onMarkBefore(host: any, e: Event): Promise<void> {
    const cutoff = (e as CustomEvent<number | null>).detail;
    host.advancedOpen = false;
    if (host.marking) return;
    host.marking = true;
    toastInfo('Marking articles as read — this takes a while on large libraries.');
    try {
        await markBeforeAction(host, cutoff);
    } catch (err) {
        console.error('mark-before failed', err);
        toastApiError(err, 'Could not mark articles as read. Check your connection and try again.');
    } finally {
        host.marking = false;
    }
}

export function onUndoMute(): void {
    if (!restoreMuteUndo()) return;
    toastInfo('Mute filter change undone');
    window.dispatchEvent(new CustomEvent('mute-rules-changed'));
}

export function canUndoMute(): boolean {
    return peekMuteUndo() !== null;
}

export function scopeLabel(host: any): string {
    return scopeLabelOf(host.view, host.library.data);
}

export function freshnessLabel(host: any): string {
    return describeFreshness(freshestFetchAt(host.view, host.library.data), Date.now());
}

export function folderFeeds(host: any): Feed[] {
    return folderFeedsOf(host.view, host.library.data);
}

export function onRetryLibrary(): void {
    void queryClient.invalidateQueries({ queryKey: libraryKey });
}
