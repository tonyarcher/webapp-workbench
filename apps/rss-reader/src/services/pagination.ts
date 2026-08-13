import type {Feed} from '../types';

export const MAX_LIST_ITEMS = 1000;

/**
 * Bound a list to MAX_LIST_ITEMS. The list simply stops growing at the cap:
 * once a page already holds MAX_LIST_ITEMS items, `canLoadMore()` returns
 * false so no further items are fetched, keeping the head of the current sort
 * order and avoiding unbounded memory growth.
 */
export function capItems<T>(items: T[]): T[] {
    return items.length > MAX_LIST_ITEMS ? items.slice(0, MAX_LIST_ITEMS) : items;
}

/**
 * Items to take from each feed so `pageSize` slots fill, preferring one
 * from each feed (diversity) then topping up when there are fewer feeds
 * than slots. Returns 0 when either input is not positive.
 */
export function perFeedLimit(pageSize: number, feedCount: number): number {
    if (pageSize <= 0 || feedCount <= 0) return 0;
    return Math.max(1, Math.min(pageSize, Math.ceil(pageSize / feedCount)));
}

/**
 * Return a stable, rotating window of at most `size` feeds starting at
 * `offset % feeds.length`, wrapping around the end of the list so every feed is
 * eventually visited across successive pages. When the feed set already fits in
 * `size`, the same `feeds` array is returned unchanged.
 */
export function feedWindow(feeds: Feed[], offset: number, size: number): Feed[] {
    if (feeds.length <= size) return feeds;
    const start = offset % feeds.length;
    const window = feeds.slice(start, start + size);
    if (window.length < size) {
        window.push(...feeds.slice(0, size - window.length));
    }
    return window;
}
