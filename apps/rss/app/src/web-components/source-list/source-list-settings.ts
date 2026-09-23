import type { FeedSort } from '../../types';

export const COLLAPSED_KEY = 'rss-reader:collapsed-folders';
export const AUTO_HIDE_KEY = 'rss-reader:auto-hide-sidebar';
export const SIDEBAR_WIDTH_KEY = 'rss-reader:sidebar-width';
export const FEED_SORT_KEY = 'rss-reader:feed-sort';
export const HIDE_READ_KEY = 'rss-reader:hide-read-by-folder';
export const MIN_SIDEBAR_WIDTH = 140;
export const MAX_SIDEBAR_WIDTH = 480;

export function loadCollapsed(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

export function saveCollapsed(next: Record<string, boolean>): void {
    try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
        // storage unavailable; collapse state just won't persist
    }
}

export function loadFeedSort(): FeedSort {
    try {
        return localStorage.getItem(FEED_SORT_KEY) === 'unread' ? 'unread' : 'alpha';
    } catch {
        return 'alpha';
    }
}

export function saveFeedSort(sort: FeedSort): void {
    try {
        localStorage.setItem(FEED_SORT_KEY, sort);
    } catch {
        // storage unavailable; sort preference just won't persist
    }
}

export function loadHideReadByFolder(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(HIDE_READ_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

export function saveHideReadByFolder(map: Record<string, boolean>): void {
    try {
        localStorage.setItem(HIDE_READ_KEY, JSON.stringify(map));
    } catch {
        // storage unavailable; filter preference just won't persist
    }
}

export function loadAutoHide(): boolean {
    try {
        return localStorage.getItem(AUTO_HIDE_KEY) === '1';
    } catch {
        return false;
    }
}

export function saveAutoHide(autoHide: boolean): void {
    try {
        localStorage.setItem(AUTO_HIDE_KEY, autoHide ? '1' : '0');
    } catch {
        // storage unavailable; auto-hide state just won't persist
    }
}

export function loadSidebarWidth(): number {
    try {
        const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
        const width = raw ? Number(raw) : NaN;
        return Number.isFinite(width) ? width : 280;
    } catch {
        return 280;
    }
}

export function saveSidebarWidth(width: number): void {
    try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
        // storage unavailable; sidebar width just won't persist
    }
}
