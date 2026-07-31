import { openDB, type DBSchema, type IDBPDatabase, type IDBPCursorWithValue } from 'idb';
import type { Article, Feed, Folder } from '../types';

interface ReaderDB extends DBSchema {
  folders: {
    key: string;
    value: Folder;
  };
  feeds: {
    key: string;
    value: Feed;
    indexes: { byFolderId: string };
  };
  articles: {
    key: string;
    value: Article;
    indexes: {
      byFeedId: string;
      byPublished: [number, string];
      byFeedDate: [string, number, string];
      byReadDate: [number, number];
      byFeedRead: [string, number];
      byLink: string;
      byHot: [number, string];
      byFeedHot: [string, number, string];
    };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | undefined;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ReaderDB>('rss-reader', 4, {
      upgrade(db, _oldVersion, _newVersion, tx) {
        if (db.objectStoreNames.contains('folders')) db.deleteObjectStore('folders');
        if (db.objectStoreNames.contains('feeds')) db.deleteObjectStore('feeds');
        if (db.objectStoreNames.contains('articles')) db.deleteObjectStore('articles');
        if (db.objectStoreNames.contains('meta')) db.deleteObjectStore('meta');
        db.createObjectStore('folders', { keyPath: 'id' });
        const feeds = db.createObjectStore('feeds', { keyPath: 'id' });
        feeds.createIndex('byFolderId', 'folderId');
        const articles = db.createObjectStore('articles', { keyPath: 'id' });
        articles.createIndex('byFeedId', 'feedId');
        articles.createIndex('byPublished', ['published', 'id']);
        articles.createIndex('byFeedDate', ['feedId', 'published', 'id']);
        articles.createIndex('byReadDate', ['read', 'published']);
        articles.createIndex('byFeedRead', ['feedId', 'read']);
        articles.createIndex('byLink', 'normLink');
        articles.createIndex('byHot', ['hot', 'id']);
        articles.createIndex('byFeedHot', ['feedId', 'hot', 'id']);
        db.createObjectStore('meta', { keyPath: 'key' });
        void tx;
      },
    });
  }
  return dbPromise;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export async function getFolders(): Promise<Folder[]> {
  return (await getDb()).getAll('folders');
}

export async function putFolder(folder: Folder): Promise<void> {
  await (await getDb()).put('folders', folder);
}

export async function deleteFolder(id: string): Promise<void> {
  await (await getDb()).delete('folders', id);
}

export async function getFeeds(): Promise<Feed[]> {
  return (await getDb()).getAll('feeds');
}

export async function getFeed(id: string): Promise<Feed | undefined> {
  return (await getDb()).get('feeds', id);
}

export async function putFeed(feed: Feed): Promise<void> {
  await (await getDb()).put('feeds', feed);
}

export async function deleteFeed(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['feeds', 'articles'], 'readwrite');
  await tx.objectStore('feeds').delete(id);
  let cursor = await tx.objectStore('articles').index('byFeedId').openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function setFeedFolder(feedId: string, folderId: string | null): Promise<void> {
  const db = await getDb();
  const feed = await db.get('feeds', feedId);
  if (feed) {
    feed.folderId = folderId;
    await db.put('feeds', feed);
  }
}

export async function getArticle(id: string): Promise<Article | undefined> {
  return (await getDb()).get('articles', id);
}

export async function upsertArticles(articles: Article[]): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('articles', 'readwrite');
  let inserted = 0;
  for (const article of articles) {
    const existing = await tx.store.get(article.id);
    if (existing) {
      await tx.store.put({ ...existing, ...article, read: existing.read, starred: existing.starred });
    } else {
      await tx.store.put(article);
      inserted++;
    }
  }
  await tx.done;
  return inserted;
}

export interface ArticleCursor {
  key: number;
  id: string;
}

export type ArticleSort = 'hot' | 'newest' | 'oldest';

export interface ArticleQuery {
  feedId?: string;
  unreadOnly?: boolean;
  sort?: ArticleSort;
  cursor?: ArticleCursor;
  limit?: number;
}

function articleComparator(sort: ArticleSort) {
  switch (sort) {
    case 'hot':
      return (a: Article, b: Article) => b.hot - a.hot || a.id.localeCompare(b.id);
    case 'oldest':
      return (a: Article, b: Article) => a.published - b.published || a.id.localeCompare(b.id);
    case 'newest':
    default:
      return (a: Article, b: Article) => b.published - a.published || a.id.localeCompare(b.id);
  }
}

export async function queryArticles({
  feedId,
  unreadOnly,
  sort = 'newest',
  cursor,
  limit = 100,
}: ArticleQuery): Promise<{ items: Article[]; hasMore: boolean }> {
  const db = await getDb();
  const tx = db.transaction('articles', 'readonly');
  const store = tx.objectStore('articles');

  const indexName = feedId
    ? sort === 'hot'
      ? 'byFeedHot'
      : 'byFeedDate'
    : sort === 'hot'
      ? 'byHot'
      : 'byPublished';
  const descending = sort !== 'oldest';

  if (unreadOnly) {
    const all = feedId
      ? await store.index('byFeedRead').getAll(IDBKeyRange.bound([feedId, 0], [feedId, 0]))
      : await store
          .index('byReadDate')
          .getAll(IDBKeyRange.bound([0, Number.NEGATIVE_INFINITY], [0, Number.POSITIVE_INFINITY]));
    const sorted = [...all].sort(articleComparator(sort));
    let list = sorted;
    if (cursor) {
      const idx = list.findIndex((a) => a.id === cursor.id);
      if (idx >= 0) list = list.slice(idx + 1);
    }
    return { items: list.slice(0, limit), hasMore: false };
  }

  let range: IDBKeyRange | undefined;
  if (feedId) {
    const lower: [string, number, string] = [feedId, Number.NEGATIVE_INFINITY, ''];
    const upper: [string, number, string] = [feedId, Number.POSITIVE_INFINITY, ''];
    if (cursor) {
      const c: [string, number, string] = [feedId, cursor.key, cursor.id];
      range = descending
        ? IDBKeyRange.bound(lower, c, true, true)
        : IDBKeyRange.bound(c, upper, true, true);
    } else {
      range = IDBKeyRange.bound(lower, upper);
    }
  } else {
    range = cursor
      ? descending
        ? IDBKeyRange.upperBound([cursor.key, cursor.id], true)
        : IDBKeyRange.lowerBound([cursor.key, cursor.id], true)
      : undefined;
  }

  const raw = await takeFromCursor(
    store.index(indexName).openCursor(range, descending ? 'prev' : 'next'),
    limit,
  );

  const hasMore = raw.length >= limit;
  return { items: raw, hasMore };
}

async function takeFromCursor(
  cursorReq: Promise<
    | IDBPCursorWithValue<ReaderDB, ['articles'], 'articles', string, 'readonly'>
    | null
  >,
  limit: number,
): Promise<Article[]> {
  const out: Article[] = [];
  let cursor = await cursorReq;
  while (cursor && out.length < limit) {
    out.push(cursor.value as Article);
    cursor = await cursor.continue();
  }
  return out;
}

export async function setArticleRead(id: string, read: 0 | 1): Promise<void> {
  const db = await getDb();
  const article = await db.get('articles', id);
  if (article) {
    article.read = read;
    await db.put('articles', article);
  }
}

export async function setArticleStarred(id: string, starred: boolean): Promise<void> {
  const db = await getDb();
  const article = await db.get('articles', id);
  if (article) {
    article.starred = starred;
    await db.put('articles', article);
  }
}

export async function markAllRead(feedId?: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['feeds', 'articles'], 'readwrite');
  const articleStore = tx.objectStore('articles');

  if (feedId) {
    const feed = await tx.objectStore('feeds').get(feedId);
    if (feed) {
      feed.unread = 0;
      await tx.objectStore('feeds').put(feed);
    }
    let cursor = await articleStore.index('byFeedId').openCursor(feedId);
    while (cursor) {
      if (cursor.value.read === 0) {
        const updated = { ...cursor.value, read: 1 as const };
        await cursor.update(updated);
      }
      cursor = await cursor.continue();
    }
  } else {
    let cursor = await articleStore.openCursor();
    while (cursor) {
      if (cursor.value.read === 0) {
        const updated = { ...cursor.value, read: 1 as const };
        await cursor.update(updated);
      }
      cursor = await cursor.continue();
    }
    const feeds = await tx.objectStore('feeds').getAll();
    for (const feed of feeds) {
      feed.unread = 0;
      await tx.objectStore('feeds').put(feed);
    }
  }
  await tx.done;
}

export async function decrementFeedUnread(feedId: string): Promise<void> {
  const db = await getDb();
  const feed = await db.get('feeds', feedId);
  if (feed && feed.unread > 0) {
    feed.unread -= 1;
    await db.put('feeds', feed);
  }
}

export async function getAllArticlesCount(): Promise<number> {
  return (await getDb()).count('articles');
}
