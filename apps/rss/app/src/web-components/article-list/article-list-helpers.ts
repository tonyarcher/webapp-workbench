import { elementScroll, observeElementOffset, observeElementRect, type Virtualizer } from '@tanstack/virtual-core';
import type { ArticleSort, Feed, Folder, ListViewType, View } from '../../types';

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZES = [20, 50, 100, 500] as const;
export const VIEW_SETTINGS_KEY = 'rss-reader:view-settings';
export const CARD_MIN_WIDTH = 240;
export const CARD_HEIGHT = 420;
export const CARD_ROW_GAP = 32;
export const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

export interface ViewSettings {
    listView: ListViewType;
    sort: ArticleSort;
    pageSize: number;
    maxCardCols: number;
    unreadOnly: boolean;
    markOnScroll: boolean;
}

export function clampPageSize(n: unknown): number {
    return typeof n === 'number' && (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

export function readViewSettings(): Record<string, ViewSettings> {
    try {
        const raw = localStorage.getItem(VIEW_SETTINGS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, ViewSettings>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

export function viewKeyOf(view: View): string {
    if (view.kind === 'feed') return `feed:${view.id}`;
    if (view.kind === 'folder') return `folder:${view.id}`;
    if (view.kind === 'interesting') return `interesting:${view.id}`;
    return 'all';
}

export function viewTitleOf(view: View, library: { feeds: Feed[]; folders: Folder[] } | undefined): string {
    if (!library) return 'Articles';
    if (view.kind === 'feed') return library.feeds.find((f) => f.id === view.id)?.title ?? 'Feed';
    if (view.kind === 'folder') return library.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
    if (view.kind === 'interesting') {
        const title = library.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
        return `Interesting in ${title}`;
    }
    return 'All';
}

export function feedTitleOf(feedId: string, library: { feeds: Feed[] } | undefined): string | undefined {
    return library?.feeds.find((f) => f.id === feedId)?.title;
}

export function scopeLabelOf(view: View, library: { feeds: Feed[]; folders: Folder[] } | undefined): string {
    if (!library) return '';
    if (view.kind === 'feed') return library.feeds.find((f) => f.id === view.id)?.title ?? 'Feed';
    if (view.kind === 'folder') return library.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
    if (view.kind === 'interesting')
        return `Interesting in ${library.folders.find((f) => f.id === view.id)?.title ?? 'Folder'}`;
    return 'All feeds';
}

export function folderFeedsOf(view: View, library: { feeds: Feed[] } | undefined): Feed[] {
    if ((view.kind !== 'folder' && view.kind !== 'interesting') || !library) return [];
    const id = view.id;
    return library.feeds.filter((f) => f.folderIds.includes(id));
}

/** Feeds for an explicit view, so jobs snapshot scope instead of reading live state. */
export function feedsForView(view: View, library: { feeds: Feed[] } | undefined): Feed[] {
    if (view.kind === 'feed') return library?.feeds.filter((f) => f.id === view.id) ?? [];
    if (view.kind === 'folder' || view.kind === 'interesting') return folderFeedsOf(view, library);
    return library?.feeds ?? [];
}

/** Every feed a view reads from: the folder's members, one feed, or all feeds. */
export function scopeFeedsFor(view: View, library: { feeds: Feed[] } | undefined): Feed[] {
    if (!library) return [];
    if (view.kind === 'feed') return library.feeds.filter((f) => f.id === view.id);
    if (view.kind === 'folder' || view.kind === 'interesting') return folderFeedsOf(view, library);
    return library.feeds;
}

/** Newest lastFetchedAt across the view's feeds, or null when none reported one. */
export function freshestFetchAt(view: View, library: { feeds: Feed[] } | undefined): number | null {
    let latest = 0;
    for (const feed of scopeFeedsFor(view, library)) {
        const ts = feed.lastFetchedAt ?? 0;
        if (ts > latest) latest = ts;
    }
    return latest > 0 ? latest : null;
}

/**
 * Short freshness label for the toolbar ("Updated 2m ago"). Empty when no
 * feed reported a fetch yet, so the toolbar shows nothing rather than a lie.
 * Clocks skew, so a future timestamp reads as just now.
 */
export function describeFreshness(fetchedAt: number | null, now: number): string {
    if (fetchedAt === null) return '';
    const minutes = Math.floor(Math.max(0, now - fetchedAt) / 60_000);
    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Updated ${hours}h ago`;
    return `Updated ${Math.floor(hours / 24)}d ago`;
}

export function viewRefreshKeyOf(view: View): string {
    if (view.kind === 'feed') return `feed:${view.id}`;
    if (view.kind === 'folder') return `folder:${view.id}`;
    if (view.kind === 'interesting') return `interesting:${view.id}`;
    return 'all';
}

interface SettingsHost {
    view: View;
    listView: ListViewType;
    sort: ArticleSort;
    pageSize: number;
    maxCardCols: number;
    unreadOnly: boolean;
    markOnScroll: boolean;
    updateCols(): void;
}

export function loadViewSettingsFor(host: SettingsHost): void {
    const saved = readViewSettings()[viewKeyOf(host.view)];
    if (!saved) return;
    host.listView = saved.listView ?? 'detailed';
    host.sort = saved.sort ?? 'hot';
    host.pageSize = clampPageSize(saved.pageSize);
    host.maxCardCols = saved.maxCardCols ?? 4;
    host.unreadOnly = saved.unreadOnly ?? false;
    host.markOnScroll = saved.markOnScroll ?? false;
    host.updateCols();
}

export function saveViewSettingsFor(host: SettingsHost): void {
    const map = readViewSettings();
    map[viewKeyOf(host.view)] = {
        listView: host.listView,
        sort: host.sort,
        pageSize: host.pageSize,
        maxCardCols: host.maxCardCols,
        unreadOnly: host.unreadOnly,
        markOnScroll: host.markOnScroll,
    };
    try {
        localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(map));
    } catch {
        // ignore
    }
}

export function virtualizerOptionsFor(host: {
    items: { id: string }[];
    listView: ListViewType;
    cols: number;
    scrollElRef: { value: HTMLDivElement | null };
    requestUpdate(): void;
}) {
    const cards = host.listView === 'cards';
    return {
        count: cards ? Math.max(1, Math.ceil(host.items.length / Math.max(1, host.cols))) : host.items.length,
        getScrollElement: () => host.scrollElRef.value ?? null,
        estimateSize: () => (cards ? CARD_ROW_HEIGHT : host.listView === 'headline' ? 46 : 82),
        getItemKey: (index: number) => (cards ? `row:${index}` : (host.items[index]?.id ?? index)),
        overscan: 8,
        scrollEndThreshold: 300,
        scrollToFn: elementScroll,
        observeElementRect,
        observeElementOffset,
        measureElement: measureRow,
        onChange: () => host.requestUpdate(),
    };
}

function measureRow(
    element: HTMLDivElement,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
): number {
    const box = entry?.borderBoxSize?.[0];
    if (box && box.blockSize > 0) return Math.round(box.blockSize);
    const height = element.offsetHeight;
    if (height > 0) return height;
    return instance.options.estimateSize(instance.indexFromElement(element));
}
