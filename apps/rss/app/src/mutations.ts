import {
    addFeed as apiAddFeed,
    deleteFeed as apiDeleteFeed,
    deleteFolder as apiDeleteFolder,
    exportOpml as apiExportOpml,
    importOpmlXml as apiImportOpml,
    readAll as apiReadAll,
    readBefore as apiReadBefore,
    reorderFolders as apiReorderFolders,
    recordAffinity,
    requestSync,
    setFeedFolders as apiSetFeedFolders,
    updateArticleState,
} from './services/api';
import {createCoalescer} from './services/coalesce';
import {allSyncKey} from './services/sync-keys';
import {invalidateArticles, invalidateLibrary, updateArticlesInCache, libraryKey, queryClient, bustCounts, type LibraryData} from './query';
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
    const result = await apiImportOpml(xml);
    queryClient.setQueryData(libraryKey, (prev) => {
        const prior = (prev ?? {folders: [], feeds: []}) as LibraryData;
        const folders = [...prior.folders];
        for (const folder of result.folders) {
            if (!folders.some((f) => f.id === folder.id)) folders.push(folder);
        }
        const feeds = [...prior.feeds];
        for (const feed of result.feeds) {
            if (!feeds.some((f) => f.id === feed.id)) feeds.push(feed);
        }
        return {folders, feeds};
    });
    await invalidateLibrary();
    return result;
}

export async function exportOpmlFile(): Promise<string> {
    return apiExportOpml();
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
    // Optimistic: the row moves in this frame; the server confirms after.
    const prev = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    if (prev) {
        queryClient.setQueryData(libraryKey, {
            ...prev,
            feeds: prev.feeds.map((f) => (f.id === feedId ? {...f, folderIds: folderId ? [folderId] : []} : f)),
        });
    }
    try {
        await apiSetFeedFolders(feedId, folderId ? [folderId] : []);
    } finally {
        await invalidateLibrary();
    }
}

export async function setFeedFolderMembership(feedId: string, folderIds: string[]) {
    await apiSetFeedFolders(feedId, folderIds);
    await invalidateLibrary();
}

export async function reorderFolders(folderIds: string[]) {
    // Optimistic: folders reorder in this frame; the server confirms after.
    const prev = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    if (prev) {
        const order = new Map(folderIds.map((id, i) => [id, i] as const));
        queryClient.setQueryData(libraryKey, {
            ...prev,
            folders: [...prev.folders].sort(
                (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
            ),
        });
    }
    try {
        await apiReorderFolders(folderIds);
    } finally {
        await invalidateLibrary();
    }
}

export async function markArticleRead(articleId: string): Promise<boolean> {
    updateArticlesInCache(articleId, {read: 1});
    void recordAffinity(articleId, 1).catch(() => {});
    // Awaited so a subsequent unread-only refetch can't race this write.
    try {
        await updateArticleState([{id: articleId, read: true}]);
    } catch (err) {
        console.error('markArticleRead failed', err);
        // Revert the optimistic paint: refetch truth instead of leaving a
        // read-looking row the server never recorded.
        await invalidateArticles();
        bustCounts();
        await invalidateLibrary();
        return false;
    }
    bustCounts();
    await invalidateLibrary();
    return true;
}

/** The caller supplies the toggled value — it always has the article in hand,
 *  and no shared cache holds article pages to read the prior state from.
 *  The write is awaited: today-view chains its refetch on this resolving,
 *  so a fire-and-forget would let the GET re-show the old star state. */
export async function toggleStar(articleId: string, nowStarred: boolean): Promise<boolean> {
    updateArticlesInCache(articleId, {starred: nowStarred});
    try {
        await updateArticleState([{id: articleId, starred: nowStarred}]);
    } catch (err) {
        console.error('toggleStar failed', err);
        await invalidateArticles();
        return false;
    }
    if (nowStarred) void recordAffinity(articleId, 4).catch(() => {});
    return true;
}

export async function markAllRead(feedId?: string) {
    await apiReadAll(feedId);
    await invalidateArticles();
    bustCounts();
    await invalidateLibrary();
}

export async function markShownRead(articleIds: string[]) {
    for (const id of articleIds) updateArticlesInCache(id, {read: 1});
    // Awaited: callers refetch unread-only lists right after this returns,
    // and firing blind would let just-read articles reappear.
    try {
        await updateArticleState(articleIds.map((id) => ({id, read: true})));
    } catch (err) {
        console.error('markShownRead failed', err);
        await invalidateArticles();
    }
    bustCounts();
    await invalidateLibrary();
}

export async function markReadBefore(feedIds: string[] | undefined, cutoff: number) {
    await apiReadBefore(feedIds, cutoff);
    await invalidateArticles();
    bustCounts();
    await invalidateLibrary();
}
