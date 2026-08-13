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
