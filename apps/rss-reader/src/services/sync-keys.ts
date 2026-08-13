/** Key for a full-library sync. */
export const ALL_SYNC_KEY = 'all';

export const SET_PREFIX = 'set:';

/**
 * Coalescer key for syncAllFeeds. undefined = whole library. Empty array
 * returns null so a folder with no feeds does not claim the global slot.
 */
export function allSyncKey(feedIds?: string[]): string | null {
    if (feedIds === undefined) return ALL_SYNC_KEY;
    if (feedIds.length === 0) return null;
    return SET_PREFIX + [...feedIds].sort().join('\0');
}

/** True when `key` is a feed-set key (not the whole-library key). */
export function isSetSyncKey(key: string): boolean {
    return key.startsWith(SET_PREFIX);
}

/** True when `key` is a feed-set key whose NUL-joined ids include feedId. */
export function setKeyIncludesFeed(key: string, feedId: string): boolean {
    if (!isSetSyncKey(key)) return false;
    return key.slice(SET_PREFIX.length).split('\0').includes(feedId);
}
