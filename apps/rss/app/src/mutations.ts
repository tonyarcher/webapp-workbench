import {
    addFeed as apiAddFeed,
    addSavedSearch as apiAddSavedSearch,
    deleteFeed as apiDeleteFeed,
    deleteFolder as apiDeleteFolder,
    deleteSavedSearch as apiDeleteSavedSearch,
    exportOpml as apiExportOpml,
    importOpmlXml as apiImportOpml,
    readAll as apiReadAll,
    readBefore as apiReadBefore,
    reorderFolders as apiReorderFolders,
    reorderSavedSearches as apiReorderSavedSearches,
    recordAffinity,
    requestSync,
    saveArticleForLater as apiSaveArticleForLater,
    setFeedFolders as apiSetFeedFolders,
    unsaveArticleForLater as apiUnsaveArticleForLater,
    updateArticleState,
    updateSavedSearch as apiUpdateSavedSearch,
} from './services/api';
import { createCoalescer } from './services/coalesce';
import { allSyncKey } from './services/sync-keys';
import {
    invalidateArticles,
    invalidateFrontPage,
    invalidateLibrary,
    invalidateSavedArticles,
    updateArticlesInCache,
    libraryKey,
    queryClient,
    bustCounts,
    markCountsChanging,
    type LibraryData,
} from './query';
import type { Article, Feed } from './types';
import { accrueEngagement, adjustWordMap, isDeranked, setDeranked } from './services/interesting-settings';
import {
    DERANK_WORD_CAP,
    DERANK_WORD_WEIGHT,
    ORIGINAL_WORD_CAP,
    ORIGINAL_WORD_WEIGHT,
    SHARE_AFFINITY,
    SHARE_WORD_CAP,
    SHARE_WORD_WEIGHT,
    SUMMARY_AFFINITY,
    SUMMARY_WORD_CAP,
    SUMMARY_WORD_WEIGHT,
} from './services/engagement';
import { STAR_WORD_WEIGHT } from './services/interesting-words';
import { toastApiError } from './services/toast';

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
        const result = await requestSync({ feedIds: [feedId] });
        markCountsChanging();
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
    const result = await allSyncs.run(key, () => requestSync(feedIds ? { feedIds } : undefined));
    markCountsChanging();
    await invalidateLibrary();
    await invalidateArticles();
    onProgress?.(1, 1, '');
    return result.queued;
}

export async function refreshFolder(folderId: string) {
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    const feedIds = lib?.feeds.filter((f) => f.folderIds.includes(folderId)).map((f) => f.id) ?? [];
    if (!feedIds.length) return;
    await syncAllFeeds(undefined, feedIds);
}

export async function importOpmlFile(xml: string) {
    const result = await apiImportOpml(xml);
    queryClient.setQueryData(libraryKey, (prev) => {
        const prior = (prev ?? { folders: [], feeds: [], savedSearches: [] }) as LibraryData;
        const folders = [...prior.folders];
        for (const folder of result.folders) {
            if (!folders.some((f) => f.id === folder.id)) folders.push(folder);
        }
        const feeds = [...prior.feeds];
        for (const feed of result.feeds) {
            if (!feeds.some((f) => f.id === feed.id)) feeds.push(feed);
        }
        return { folders, feeds, savedSearches: prior.savedSearches };
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
            feeds: prev.feeds.map((f) => (f.id === feedId ? { ...f, folderIds: folderId ? [folderId] : [] } : f)),
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

export async function createSavedSearch(title: string, query: string, scopeKind: string, scopeId?: string) {
    const created = await apiAddSavedSearch({ title, query, scopeKind, ...(scopeId ? { scopeId } : {}) });
    bustCounts();
    await invalidateLibrary();
    return created;
}

export async function renameSavedSearch(id: string, title: string) {
    const prev = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    if (prev) {
        queryClient.setQueryData(libraryKey, {
            ...prev,
            savedSearches: prev.savedSearches.map((s) => (s.id === id ? { ...s, title } : s)),
        });
    }
    try {
        await apiUpdateSavedSearch(id, { title });
    } finally {
        await invalidateLibrary();
    }
}

export async function removeSavedSearch(id: string) {
    const prev = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    if (prev) {
        queryClient.setQueryData(libraryKey, {
            ...prev,
            savedSearches: prev.savedSearches.filter((s) => s.id !== id),
        });
    }
    try {
        await apiDeleteSavedSearch(id);
    } finally {
        bustCounts();
        await invalidateLibrary();
    }
}

export async function reorderSavedSearches(ids: string[]) {
    const prev = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    if (prev) {
        const order = new Map(ids.map((id, i) => [id, i] as const));
        queryClient.setQueryData(libraryKey, {
            ...prev,
            savedSearches: [...prev.savedSearches].sort(
                (a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
            ),
        });
    }
    try {
        await apiReorderSavedSearches(ids);
    } finally {
        await invalidateLibrary();
    }
}

export async function markArticleRead(articleId: string): Promise<boolean> {
    updateArticlesInCache(articleId, { read: 1 });
    void recordAffinity(articleId, 1).catch(() => {});
    // Awaited so a subsequent unread-only refetch can't race this write.
    try {
        await updateArticleState([{ id: articleId, read: true }]);
    } catch (err) {
        console.error('markArticleRead failed', err);
        toastApiError(err, 'Could not mark the article as read. Check your connection and try again.');
        // Revert the optimistic paint: refetch truth instead of leaving a
        // read-looking row the server never recorded.
        await invalidateArticles();
        await invalidateFrontPage();
        bustCounts();
        await invalidateLibrary();
        return false;
    }
    bustCounts();
    await invalidateLibrary();
    await invalidateFrontPage();
    return true;
}

export async function markArticleUnread(articleId: string): Promise<boolean> {
    updateArticlesInCache(articleId, { read: 0 });
    try {
        await updateArticleState([{ id: articleId, read: false }]);
    } catch (err) {
        console.error('markArticleUnread failed', err);
        toastApiError(err, 'Could not mark the article as unread. Check your connection and try again.');
        await invalidateArticles();
        await invalidateFrontPage();
        bustCounts();
        await invalidateLibrary();
        return false;
    }
    bustCounts();
    await invalidateLibrary();
    await invalidateFrontPage();
    return true;
}

/** The caller supplies the toggled value — it always has the article in hand,
 *  and no shared cache holds article pages to read the prior state from.
 *  The write is awaited: today-view chains its refetch on this resolving,
 *  so a fire-and-forget would let the GET re-show the old star state. */
export async function toggleStar(articleId: string, nowStarred: boolean): Promise<boolean> {
    updateArticlesInCache(articleId, { starred: nowStarred });
    try {
        await updateArticleState([{ id: articleId, starred: nowStarred }]);
    } catch (err) {
        console.error('toggleStar failed', err);
        toastApiError(err, 'Could not save the star. Check your connection and try again.');
        await invalidateArticles();
        await invalidateFrontPage();
        return false;
    }
    if (nowStarred) void recordAffinity(articleId, 4).catch(() => {});
    // Teach the shadow word map from the toggled title when it is visible in
    // a cached page; the folder filter merges uncounted page stars from its
    // own batch for the rest.
    const title = findCachedArticleTitle(articleId);
    if (title !== undefined) adjustWordMap(title, nowStarred ? STAR_WORD_WEIGHT : -STAR_WORD_WEIGHT, articleId);
    await invalidateFrontPage();
    return true;
}

/**
 * Star a whole selection with one write. Titles come from the visible
 * items (the caller hands them over, like the toggle reads the cache).
 * Affinity stays per-article and fire-and-forget, matching toggleStar.
 */
export async function bulkStar(items: Array<{ id: string; title: string }>): Promise<boolean> {
    for (const item of items) updateArticlesInCache(item.id, { starred: true });
    try {
        await updateArticleState(items.map((item) => ({ id: item.id, starred: true })));
    } catch (err) {
        console.error('bulkStar failed', err);
        toastApiError(err, 'Could not star the selection. Check your connection and try again.');
        await invalidateArticles();
        await invalidateFrontPage();
        return false;
    }
    for (const item of items) {
        void recordAffinity(item.id, 4).catch(() => {});
        adjustWordMap(item.title, STAR_WORD_WEIGHT, item.id);
    }
    await invalidateFrontPage();
    return true;
}

/**
 * A share vouches for the story in public: the strongest local signal
 * (two stars) plus a server affinity touch so the front page and editions
 * feel it too. Fire-and-forget like the other affinity writes; the word
 * map update is what Interesting ranks on.
 */
export function noteShare(articleId: string, title: string): void {
    accrueEngagement(title, SHARE_WORD_WEIGHT, articleId, SHARE_WORD_CAP, 'share');
    void recordAffinity(articleId, SHARE_AFFINITY).catch(() => {});
}

/**
 * A completed summary means the reader spent model time on this story:
 * star-equivalent locally and on the server. Callers must only call this
 * for freshly produced summaries, not cache hits.
 */
export function noteSummary(articleId: string, title: string): void {
    accrueEngagement(title, SUMMARY_WORD_WEIGHT, articleId, SUMMARY_WORD_CAP, 'summary');
    void recordAffinity(articleId, SUMMARY_AFFINITY).catch(() => {});
}

/** Leaving the reader to read the original is real interest, local only. */
export function noteOriginal(articleId: string, title: string): void {
    accrueEngagement(title, ORIGINAL_WORD_WEIGHT, articleId, ORIGINAL_WORD_CAP, 'original');
}

/**
 * Explicit "not interesting" toggle. The anti-star: same magnitude as
 * STAR_WORD_WEIGHT, so one derank cancels one star on the same words.
 * Local only — it names a topic, and server affinity only speaks feed,
 * domain and author. Untoggling pays the weight back, capped like the rest.
 */
export function noteDerank(articleId: string, title: string, nowDeranked: boolean): void {
    if (isDeranked(articleId) === nowDeranked) return;
    accrueEngagement(
        title,
        nowDeranked ? -DERANK_WORD_WEIGHT : DERANK_WORD_WEIGHT,
        articleId,
        DERANK_WORD_CAP,
        'derank',
    );
    setDeranked(articleId, nowDeranked);
}

/** Title lookup across cached article pages (articles + front-page lists). */
function findCachedArticleTitle(articleId: string): string | undefined {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['articles'] })) {
        const data = query.state.data as { items: Article[] } | undefined;
        const found = data?.items.find((a) => a.id === articleId);
        if (found) return found.title;
    }
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['front-page'] })) {
        const data = query.state.data as Article[] | undefined;
        const found = data?.find((a) => a.id === articleId);
        if (found) return found.title;
    }
    return undefined;
}

export async function markAllRead(feedId?: string) {
    await apiReadAll(feedId);
    await invalidateArticles();
    bustCounts();
    await invalidateLibrary();
    await invalidateFrontPage();
}

export async function markShownRead(articleIds: string[]): Promise<boolean> {
    for (const id of articleIds) updateArticlesInCache(id, { read: 1 });
    // Awaited: callers refetch unread-only lists right after this returns,
    // and firing blind would let just-read articles reappear. Returns false
    // when the write failed so callers neither advance marks nor paint rows
    // as read — a failed write must stay retryable, never silently done.
    try {
        await updateArticleState(articleIds.map((id) => ({ id, read: true })));
    } catch (err) {
        console.error('markShownRead failed', err);
        toastApiError(err, 'Could not mark articles as read. Check your connection and try again.');
        await invalidateArticles();
        return false;
    }
    bustCounts();
    await invalidateLibrary();
    await invalidateFrontPage();
    return true;
}

export async function markReadBefore(feedIds: string[] | undefined, cutoff: number) {
    await apiReadBefore(feedIds, cutoff);
    await invalidateArticles();
    bustCounts();
    await invalidateLibrary();
    await invalidateFrontPage();
}

export async function saveForLater(articleId: string): Promise<boolean> {
    try {
        await apiSaveArticleForLater(articleId);
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not save article for later.');
        return false;
    }
}

export async function unsaveForLater(articleId: string): Promise<boolean> {
    try {
        await apiUnsaveArticleForLater(articleId);
        await invalidateSavedArticles();
        window.dispatchEvent(new CustomEvent('saved-articles-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not remove saved article.');
        return false;
    }
}
