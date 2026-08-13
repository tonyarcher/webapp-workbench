import {
    deleteFeed as dbDeleteFeed,
    deleteFolderTx as dbDeleteFolderTx,
    getArticle,
    getFeeds,
    incrementMeta,
    markAllRead as dbMarkAllRead,
    markArticleReadTx,
    markArticlesRead as dbMarkArticlesRead,
    markReadBefore as dbMarkReadBefore,
    reconcileUnreadCounts,
    reorderFolders as dbReorderFolders,
    setArticleStarred,
    setFeedFolders
} from './db/db';
import {exportOpml, importOpml} from './services/opml';
import {addFeedFromUrl, syncFeed} from './services/sync';
import {createCoalescer} from './services/coalesce';
import {ALL_SYNC_KEY, allSyncKey} from './services/sync-keys';
import {invalidateArticles, invalidateLibrary, updateArticlesInCache} from './query';
import {domainOf} from './util';
import type {Article, Feed} from './types';
import type {SyncResult} from './services/sync';

const AFFINITY_DECAY = 0.9;

// Elevator-button coalescing for refreshes: mashing Refresh joins the
// in-flight job rather than spawning a second sync.
const allSyncs = createCoalescer<string, string[]>();
const feedSyncs = createCoalescer<string, SyncResult>();

async function recordAffinity(article: Article, amount = 1) {
    await incrementMeta(`aff:feed:${article.feedId}`, amount, AFFINITY_DECAY);
    const host = domainOf(article.link);
    if (host) await incrementMeta(`aff:domain:${host}`, amount, AFFINITY_DECAY);
    if (article.author) await incrementMeta(`aff:author:${article.author.toLowerCase()}`, amount, AFFINITY_DECAY);
}

export async function addFeed(url: string): Promise<Feed> {
    const feed = await addFeedFromUrl(url);
    await invalidateLibrary();
    await invalidateArticles();
    return feed;
}

export async function refreshFeed(feedId: string) {
    // Same-feed mash only. Do not join an all/folder job — that would block
    // this button on feeds the user did not ask to refresh.
    return feedSyncs.run(feedId, async () => {
        const result = await syncFeed(feedId);
        await reconcileUnreadCounts();
        await invalidateLibrary();
        await invalidateArticles();
        return result;
    });
}

export async function syncAllFeeds(
    onProgress?: (done: number, total: number, title: string) => void,
    feedIds?: string[],
) {
    // Same-scope mash only (exact key). A folder refresh must not wait for
    // an in-flight all-sync, and vice versa. OPML import (onProgress) waits
    // out a covering all-job so newly added feeds still get their own run.
    const key = allSyncKey(feedIds);
    if (key === null) return [];
    if (onProgress && key === ALL_SYNC_KEY && allSyncs.has(ALL_SYNC_KEY)) {
        await allSyncs.get(ALL_SYNC_KEY)!;
    }
    return allSyncs.run(key, () => runSyncAllFeeds(onProgress, feedIds));
}

async function runSyncAllFeeds(
    onProgress?: (done: number, total: number, title: string) => void,
    feedIds?: string[],
) {
    const feeds = await getFeeds();
    const targets = feedIds ? feeds.filter((f) => feedIds.includes(f.id)) : feeds;
    const failed: string[] = [];
    let done = 0;
    for (const feed of targets) {
        onProgress?.(done, targets.length, feed.title);
        try {
            await syncFeed(feed.id);
        } catch {
            failed.push(feed.title);
        }
        done++;
        // Throttled refresh: keeps sidebar counts fresh during long syncs
        // without invalidating on every feed.
        if (done % 20 === 0) void invalidateLibrary();
        if (done < targets.length) {
            await new Promise((r) => setTimeout(r, 600));
        }
    }
    onProgress?.(done, targets.length, '');
    await reconcileUnreadCounts();
    await invalidateLibrary();
    await invalidateArticles();
    return failed;
}

export async function refreshFolder(folderId: string) {
    const feeds = await getFeeds();
    const feedIds = feeds
        .filter((f) => f.folderIds.includes(folderId))
        .map((f) => f.id);
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
    await dbDeleteFeed(feedId);
    await invalidateLibrary();
    await invalidateArticles();
}

export async function deleteFolder(folderId: string) {
    await dbDeleteFolderTx(folderId);
    await invalidateLibrary();
    await invalidateArticles();
}

export async function moveFeed(feedId: string, folderId: string | null) {
    await setFeedFolders(feedId, folderId ? [folderId] : []);
    await invalidateLibrary();
}

export async function setFeedFolderMembership(feedId: string, folderIds: string[]) {
    await setFeedFolders(feedId, folderIds);
    await invalidateLibrary();
}

export async function reorderFolders(folderIds: string[]) {
    await dbReorderFolders(folderIds);
    await invalidateLibrary();
}

export async function markArticleRead(articleId: string) {
    const article = await getArticle(articleId);
    if (!article || article.read === 1) return;
    const changed = await markArticleReadTx(articleId);
    if (changed) {
        await recordAffinity(article);
        updateArticlesInCache(articleId, {read: 1});
        await invalidateLibrary();
    }
}

export async function toggleStar(articleId: string) {
    const article = await getArticle(articleId);
    if (!article) return;
    const nowStarred = !article.starred;
    await setArticleStarred(articleId, nowStarred);
    if (nowStarred) await recordAffinity(article, 4);
    updateArticlesInCache(articleId, {starred: nowStarred});
}

export async function markAllRead(feedId?: string) {
    await dbMarkAllRead(feedId);
    await reconcileUnreadCounts();
    await invalidateArticles();
    await invalidateLibrary();
}

export async function markShownRead(articleIds: string[]) {
    await dbMarkArticlesRead(articleIds);
    for (const id of articleIds) updateArticlesInCache(id, {read: 1});
    await reconcileUnreadCounts();
    await invalidateLibrary();
}

export async function markReadBefore(feedIds: string[] | undefined, cutoff: number) {
    if (feedIds?.length) {
        for (const id of feedIds) await dbMarkReadBefore(id, cutoff);
    } else {
        await dbMarkReadBefore(undefined, cutoff);
    }
    await reconcileUnreadCounts();
    await invalidateArticles();
    await invalidateLibrary();
}
