import { decrementFeedUnread, deleteFeed as dbDeleteFeed, deleteFolder as dbDeleteFolder, getArticle, markAllRead as dbMarkAllRead, setArticleRead, setArticleStarred } from './db/db';
import { importOpml, exportOpml } from './services/opml';
import { addFeedFromUrl, syncFeed } from './services/sync';
import { invalidateArticles, invalidateLibrary, queryClient, updateArticlesInCache, type LibraryData } from './query';
import type { Feed, Folder } from './types';

export async function addFeed(url: string): Promise<Feed> {
  const feed = await addFeedFromUrl(url);
  await invalidateLibrary();
  await invalidateArticles();
  return feed;
}

export async function refreshFeed(feedId: string) {
  const result = await syncFeed(feedId);
  await invalidateLibrary();
  await invalidateArticles();
  return result;
}

export async function syncAllFeeds(onProgress?: (done: number, total: number, title: string) => void) {
  const { feeds } = queryClient.getQueryData<{ folders: Folder[]; feeds: Feed[] }>(['library']) ?? {
    folders: [],
    feeds: [],
  };
  let done = 0;
  for (const feed of feeds) {
    onProgress?.(done, feeds.length, feed.title);
    try {
      await syncFeed(feed.id);
    } catch {
      // keep going; individual failures are surfaced on the feed row
    }
    done++;
  }
  onProgress?.(done, feeds.length, '');
  await invalidateLibrary();
  await invalidateArticles();
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
  const library = queryClient.getQueryData<LibraryData>(['library']);
  const feeds = (library?.feeds ?? []).filter((f) => f.folderId === folderId);
  await dbDeleteFolder(folderId);
  await invalidateLibrary();
  await invalidateArticles();
  return feeds;
}

export async function markArticleRead(articleId: string) {
  const article = await getArticle(articleId);
  if (!article || article.read === 1) return;
  await setArticleRead(articleId, 1);
  await decrementFeedUnread(article.feedId);
  updateArticlesInCache(articleId, { read: 1 });
  await invalidateLibrary();
}

export async function toggleStar(articleId: string) {
  const article = await getArticle(articleId);
  if (!article) return;
  await setArticleStarred(articleId, !article.starred);
  updateArticlesInCache(articleId, { starred: !article.starred });
}

export async function markAllRead(feedId?: string) {
  await dbMarkAllRead(feedId);
  await invalidateArticles();
  await invalidateLibrary();
}
