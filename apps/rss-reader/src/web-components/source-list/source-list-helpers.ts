import type {Feed, FeedSort} from '../../types';

export function sortedFeeds(feeds: Feed[], feedSort: FeedSort): Feed[] {
    if (feedSort !== 'unread') return feeds;
    return [...feeds].sort(
        (a, b) => Number(b.unread > 0) - Number(a.unread > 0) || a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}),
    );
}

export function visibleFeeds(feeds: Feed[], hideReadByFolder: Record<string, boolean>, folderKey: string): Feed[] {
    return hideReadByFolder[folderKey] ? feeds.filter((f) => f.unread > 0) : feeds;
}

export function folderFeedsFor(
    allFeeds: Feed[],
    folderId: string,
    feedSort: FeedSort,
    hideReadByFolder: Record<string, boolean>,
): Feed[] {
    const feeds = allFeeds.filter((f) => f.folderIds.includes(folderId));
    const visible = visibleFeeds(feeds, hideReadByFolder, folderId);
    return sortedFeeds(visible, feedSort);
}

export function uncategorizedFor(allFeeds: Feed[], feedSort: FeedSort): Feed[] {
    return sortedFeeds(allFeeds.filter((f) => f.folderIds.length === 0), feedSort);
}

export function folderUnreadFor(allFeeds: Feed[], folderId: string): number {
    return allFeeds.filter((f) => f.folderIds.includes(folderId)).reduce((sum, f) => sum + f.unread, 0);
}

export function dropFolderId(
    draggingKind: 'folder' | 'feed' | null,
    target: HTMLElement | null,
    libraryFeeds: Feed[],
): string | null {
    const selector = draggingKind === 'feed' ? '[data-folder-id], [data-feed-id]' : '[data-folder-id]';
    const el = target?.closest<HTMLElement>(selector) ?? null;
    if (el?.dataset.folderId) return el.dataset.folderId;
    if (el?.dataset.feedId) {
        const feed = libraryFeeds.find((f) => f.id === el.dataset.feedId);
        return feed?.folderIds[0] ?? null;
    }
    return null;
}
