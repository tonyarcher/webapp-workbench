import {
    addFeed as apiAddFeed,
    deleteFeed as apiDeleteFeed,
    deleteFolder as apiDeleteFolder,
    readAll as apiReadAll,
    readBefore as apiReadBefore,
    reorderFolders as apiReorderFolders,
    recordAffinity,
    requestSync,
    setFeedFolders as apiSetFeedFolders,
    updateArticleState,
} from './services/api';
import {exportOpml, importOpml} from './services/opml';
import {createCoalescer} from './services/coalesce';
import {allSyncKey} from './services/sync-keys';
import {invalidateArticles, invalidateLibrary, updateArticlesInCache, getArticleFromCache, libraryKey, queryClient, type LibraryData} from './query';
import type {Feed} from './types';

// Elevator-button coalescing for refreshes: mashing Refresh joins the
// in-flight job rather than spawning a second sync.
const allSyncs = createCoalescer<string, { queued: number }>();
const feedSyncs = createCoalescer<string, { queued: number }>();

export async function addFeed(url: string): Promise<Feed> {
    const feed = await apiAddFeed(url);
    await invalidateLibrary();
    await invalidateArticles();
    return feed;
}

export async function refreshFeed(feedId: string) {
    return feedSyncs.run(feedId, async () => {
        const result = await requestSync({feedIds: [feedId]});
        await invalidateLibrary();
        await invalidateArticles();
        return result;
    });
}

export async function syncAllFeeds(
    onProgress?: (done: number, total: number, title: string) => void,
    feedIds?: string[],
) {
    const key = allSyncKey(feedIds);
    if (key === null) return 0;
    onProgress?.(0, 0, '');
    const result = await allSyncs.run(key, () => requestSync(feedIds ? {feedIds} : undefined));
    await invalidateLibrary();
    await invalidateArticles();
    onProgress?.(1, 1, '');
    return result.queued;
}

export async function refreshFolder(folderId: string) {
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    const feedIds = lib?.feeds
        .filter((f) => f.folderIds.includes(folderId))
        .map((f) => f.id) ?? [];
    if (!feedIds.length) return;
    await syncAllFeeds(undefined, feedIds);
}

export async function importOpmlFile(xml: string) {
    const result = await importOpml(xml);
    await invalidateLibrary();
    return result;
}

export async function exportOpmlFile(): Promise<string> {
    return exportOpml();
}

export async function deleteFeed(feedId: string) {
    await apiDeleteFeed(feedId);
    await invalidateLibrary();
    await invalidateArticles();
}

export async function deleteFolder(folderId: string) {
    await apiDeleteFolder(folderId);
    await invalidateLibrary();
    await invalidateArticles();
}

export async function moveFeed(feedId: string, folderId: string | null) {
    await apiSetFeedFolders(feedId, folderId ? [folderId] : []);
    await invalidateLibrary();
}

export async function setFeedFolderMembership(feedId: string, folderIds: string[]) {
    await apiSetFeedFolders(feedId, folderIds);
    await invalidateLibrary();
}

export async function reorderFolders(folderIds: string[]) {
    await apiReorderFolders(folderIds);
    await invalidateLibrary();
}

export async function markArticleRead(articleId: string) {
    updateArticlesInCache(articleId, {read: 1});
    void recordAffinity(articleId, 1).catch(() => {});
    void updateArticleState([{id: articleId, read: true}]).catch(() => {});
    await invalidateLibrary();
}

export async function toggleStar(articleId: string) {
    const article = getArticleFromCache(articleId);
    const nowStarred = !(article?.starred ?? false);
    updateArticlesInCache(articleId, {starred: nowStarred});
    void updateArticleState([{id: articleId, starred: nowStarred}]).catch(() => {});
    if (nowStarred) void recordAffinity(articleId, 4).catch(() => {});
}

export async function markAllRead(feedId?: string) {
    await apiReadAll(feedId);
    await invalidateArticles();
    await invalidateLibrary();
}

export async function markShownRead(articleIds: string[]) {
    for (const id of articleIds) updateArticlesInCache(id, {read: 1});
    // One batched write for the whole visible page.
    void updateArticleState(articleIds.map((id) => ({id, read: true}))).catch(() => {});
    await invalidateLibrary();
}

export async function markReadBefore(feedIds: string[] | undefined, cutoff: number) {
    await apiReadBefore(feedIds, cutoff);
    await invalidateArticles();
    await invalidateLibrary();
}
