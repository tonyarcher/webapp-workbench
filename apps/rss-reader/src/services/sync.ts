import { getDb, getFeed, putFeed, uid } from '../db/db';
import { parseFeedXml } from './parser';
import { fetchFeedText } from './proxy';
import { hotScore, normalizeLink, popularityScore } from './ranking';
import type { Article, Feed, ParsedFeed, ParsedItem } from '../types';

function buildArticle(feedId: string, item: ParsedItem, popularity: number): Article {
  const normLink = item.link ? normalizeLink(item.link) : undefined;
  return {
    id: `${feedId}:${item.guid}`,
    feedId,
    guid: item.guid,
    title: item.title,
    link: item.link,
    author: item.author,
    summary: item.summary,
    content: item.content,
    comments: item.comments,
    published: item.published,
    fetchedAt: Date.now(),
    read: 0,
    starred: false,
    normLink,
    popularity,
    hot: hotScore(popularity, item.published),
  };
}

/**
 * Upsert a parsed feed into IndexedDB, computing the popularity signals:
 *   - syndication: how many distinct subscribed feeds carry the same canonical link
 *   - comments: comment count reported by the feed itself
 * Also bumps the popularity of already-stored copies of the same story from
 * other feeds, since this feed's copy adds to their syndication.
 */
export async function ingestFeed(feed: Feed, parsed: ParsedFeed): Promise<{ inserted: number }> {
  const db = await getDb();
  const tx = db.transaction('articles', 'readwrite');
  const articleStore = tx.objectStore('articles');

  const links = new Set(
    parsed.items.map((item) => (item.link ? normalizeLink(item.link) : undefined)).filter((l): l is string => Boolean(l)),
  );

  const otherFeedCounts = new Map<string, number>();
  for (const link of links) {
    const keys = await articleStore.index('byLink').getAllKeys(link);
    const feeds = new Set(keys.map((k) => String(k).split(':')[0]));
    feeds.delete(feed.id);
    otherFeedCounts.set(link, feeds.size);
  }

  let inserted = 0;
  for (const item of parsed.items) {
    const normLink = item.link ? normalizeLink(item.link) : undefined;
    const otherFeeds = normLink ? (otherFeedCounts.get(normLink) ?? 0) : 0;
    const popularity = popularityScore(otherFeeds + 1, item.comments ?? 0);
    const article = buildArticle(feed.id, item, popularity);

    const existing = await articleStore.get(article.id);
    if (existing) {
      await articleStore.put({
        ...existing,
        ...article,
        read: existing.read,
        starred: existing.starred,
      });
    } else {
      await articleStore.put(article);
      inserted++;
    }
  }

  for (const link of links) {
    const matches = await articleStore.index('byLink').getAll(link);
    for (const other of matches) {
      if (other.feedId === feed.id) continue;
      other.popularity += 3;
      other.hot = hotScore(other.popularity, other.published);
      await articleStore.put(other);
    }
  }

  await tx.done;
  return { inserted };
}

export interface SyncResult {
  inserted: number;
  total: number;
  title: string;
}

export async function syncFeed(feedId: string): Promise<SyncResult> {
  const feed = await getFeed(feedId);
  if (!feed) throw new Error('Feed not found');

  const xml = await fetchFeedText(feed.url);
  const parsed = parseFeedXml(xml, Date.now());

  const { inserted } = await ingestFeed(feed, parsed);

  const updated: Feed = {
    ...feed,
    title: feed.title === feed.url ? parsed.title : feed.title,
    siteUrl: parsed.siteUrl || feed.siteUrl,
    lastFetchedAt: Date.now(),
    lastError: undefined,
    unread: feed.unread + inserted,
  };
  await putFeed(updated);

  return { inserted, total: parsed.items.length, title: parsed.title };
}

export async function addFeedFromUrl(url: string): Promise<Feed> {
  const xml = await fetchFeedText(url);
  const parsed = parseFeedXml(xml, Date.now());

  const feed: Feed = {
    id: uid(),
    title: parsed.title || url,
    url,
    siteUrl: parsed.siteUrl,
    folderIds: [],
    unread: 0,
    addedAt: Date.now(),
  };

  const { inserted } = await ingestFeed(feed, parsed);
  feed.unread = inserted;
  feed.lastFetchedAt = Date.now();
  await putFeed(feed);

  return feed;
}
