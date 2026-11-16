import { elementScroll, observeElementOffset, observeElementRect, type Virtualizer } from '@tanstack/virtual-core';
import type { ArticleSort, Feed, Folder, ListViewType, View } from '../../types';

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZES = [20, 50, 100, 500] as const;
export const VIEW_SETTINGS_KEY = 'rss-reader:view-settings';
export const DEFAULT_VIEW_SETTINGS_KEY = 'rss-reader:default-view-settings';
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

/** Built-in reading defaults, used until the reader saves their own. */
export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
    listView: 'detailed',
    sort: 'hot',
    pageSize: DEFAULT_PAGE_SIZE,
    maxCardCols: 4,
    unreadOnly: false,
    markOnScroll: false,
};

export function clampPageSize(n: unknown): number {
    return typeof n === 'number' && (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** Coerce stored or edited settings into a complete, in-range object. */
export function normalizeViewSettings(input: Partial<ViewSettings> | null | undefined): ViewSettings {
    const listView: ListViewType =
        input?.listView === 'headline' || input?.listView === 'cards' || input?.listView === 'slideshow'
            ? input.listView
            : 'detailed';
    const sort: ArticleSort = input?.sort === 'newest' || input?.sort === 'oldest' ? input.sort : 'hot';
    const maxCardCols =
        typeof input?.maxCardCols === 'number'
            ? Math.min(6, Math.max(2, Math.round(input.maxCardCols)))
            : DEFAULT_VIEW_SETTINGS.maxCardCols;
    return {
        listView,
        sort,
        pageSize: clampPageSize(input?.pageSize),
        maxCardCols,
        unreadOnly: input?.unreadOnly === true,
        markOnScroll: input?.markOnScroll === true,
    };
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

/** Reading defaults the reader saved in Settings, or the built-in defaults. */
export function readDefaultViewSettings(): ViewSettings {
    try {
        const raw = localStorage.getItem(DEFAULT_VIEW_SETTINGS_KEY);
        if (!raw) return { ...DEFAULT_VIEW_SETTINGS };
        return normalizeViewSettings(JSON.parse(raw) as Partial<ViewSettings>);
    } catch {
        return { ...DEFAULT_VIEW_SETTINGS };
    }
}

export function saveDefaultViewSettings(settings: ViewSettings): void {
    try {
        localStorage.setItem(DEFAULT_VIEW_SETTINGS_KEY, JSON.stringify(normalizeViewSettings(settings)));
    } catch {
        // storage unavailable; the defaults just do not persist
    }
}

/** Settings a view should use: its own saved values, else the reading defaults. */
export function readViewSettingsFor(view: View): ViewSettings {
    return normalizeViewSettings(readViewSettings()[viewKeyOf(view)] ?? readDefaultViewSettings());
}

/**
 * Make the reading defaults apply to every view. Per-view overrides are
 * dropped, so a later default change reaches the views again. The caller
 * dispatches `view-settings-changed` if the open list should reload now.
 */
export function applyDefaultToAllViews(settings: ViewSettings): void {
    saveDefaultViewSettings(settings);
    try {
        localStorage.removeItem(VIEW_SETTINGS_KEY);
    } catch {
        // storage unavailable; the badges just keep their old overrides
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

function applyViewSettings(host: SettingsHost, saved: ViewSettings): void {
    const settings = normalizeViewSettings(saved);
    host.listView = settings.listView;
    host.sort = settings.sort;
    host.pageSize = settings.pageSize;
    host.maxCardCols = settings.maxCardCols;
    host.unreadOnly = settings.unreadOnly;
    host.markOnScroll = settings.markOnScroll;
    host.updateCols();
}

/**
 * Per-view layout and filters. A view with its own saved values keeps them;
 * any other view, including an Interesting smart folder, uses the reading
 * defaults from Settings. The background badge refresh uses the same lookup,
 * so the badge and the list agree.
 */
export function loadViewSettingsFor(host: SettingsHost): void {
    applyViewSettings(host, readViewSettingsFor(host.view));
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
