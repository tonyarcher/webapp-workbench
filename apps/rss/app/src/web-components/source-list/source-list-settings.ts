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

/** Arrow-key step for the sidebar splitter, and the coarse step with Shift. */
export const SIDEBAR_KEY_STEP = 16;
export const SIDEBAR_KEY_STEP_LARGE = 64;

/** The width a drag or key press asks for, held inside the bounds. */
export function clampSidebarWidth(raw: number): number {
    return Math.round(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, raw)));
}

/**
 * The next sidebar width for a key press, per the WAI-ARIA window splitter:
 * arrows step, Home and End jump to the bounds. Null means the caller should
 * leave the key alone and not preventDefault.
 *
 * Extracted from the component so it is reachable without a DOM. The splitter is
 * the only way to set the sidebar width by keyboard, and the stepping and
 * clamping are exactly the part worth pinning.
 */
export function nextSidebarWidth(current: number, key: string, shiftKey: boolean): number | null {
    const step = shiftKey ? SIDEBAR_KEY_STEP_LARGE : SIDEBAR_KEY_STEP;
    if (key === 'ArrowRight') return clampSidebarWidth(current + step);
    if (key === 'ArrowLeft') return clampSidebarWidth(current - step);
    if (key === 'Home') return MIN_SIDEBAR_WIDTH;
    if (key === 'End') return MAX_SIDEBAR_WIDTH;
    return null;
}
