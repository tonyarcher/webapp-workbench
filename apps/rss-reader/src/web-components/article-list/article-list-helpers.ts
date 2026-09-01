import {elementScroll, observeElementOffset, observeElementRect, type Virtualizer} from '@tanstack/virtual-core';
import type {ArticleSort, Feed, Folder, ListViewType, View} from '../../types';

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
    return 'all';
}

export function viewTitleOf(view: View, library: { feeds: Feed[]; folders: Folder[] } | undefined): string {
    if (!library) return 'Articles';
    if (view.kind === 'feed') return library.feeds.find((f) => f.id === view.id)?.title ?? 'Feed';
    if (view.kind === 'folder') return library.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
    return 'All';
}

export function feedTitleOf(feedId: string, library: { feeds: Feed[] } | undefined): string | undefined {
    return library?.feeds.find((f) => f.id === feedId)?.title;
}

export function scopeLabelOf(view: View, library: { feeds: Feed[]; folders: Folder[] } | undefined): string {
    if (!library) return '';
    if (view.kind === 'feed') return library.feeds.find((f) => f.id === view.id)?.title ?? 'Feed';
    if (view.kind === 'folder') return library.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
    return 'All feeds';
}

export function folderFeedsOf(view: View, library: { feeds: Feed[] } | undefined): Feed[] {
    if (view.kind !== 'folder' || !library) return [];
    const id = view.id;
    return library.feeds.filter((f) => f.folderIds.includes(id));
}

export function viewRefreshKeyOf(view: View): string {
    if (view.kind === 'feed') return `feed:${view.id}`;
    if (view.kind === 'folder') return `folder:${view.id}`;
    return 'all';
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
        measureElement: (element: HTMLDivElement, entry: ResizeObserverEntry | undefined, instance: Virtualizer<HTMLDivElement, HTMLDivElement>) => {
            const box = entry?.borderBoxSize?.[0];
            if (box && box.blockSize > 0) return Math.round(box.blockSize);
            const height = element.offsetHeight;
            if (height > 0) return height;
            return instance.options.estimateSize(instance.indexFromElement(element));
        },
        onChange: () => host.requestUpdate(),
    };
}
