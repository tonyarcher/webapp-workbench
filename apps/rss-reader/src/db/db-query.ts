import type {IDBPCursorWithValue} from 'idb';
import {contentEngagement, hotScore} from '../services/ranking';
import {firstImageUrl} from '../services/parser';
import type {Article} from '../types';
import {getDb} from './db-base';
import type {ReaderDB} from './db-base';

export async function getArticle(id: string): Promise<Article | undefined> {
    return (await getDb()).get('articles', id);
}

export async function queryArticlesByLink(link: string): Promise<Article[]> {
    const db = await getDb();
    return db.getAllFromIndex('articles', 'byLink', link);
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

function pickIndex(feedId: string | undefined, sort: ArticleSort): string {
    if (feedId) return sort === 'hot' ? 'byFeedHot' : 'byFeedDate';
    return sort === 'hot' ? 'byHot' : 'byPublished';
}

function feedRange(
    feedId: string,
    cursor: ArticleCursor | undefined,
    descending: boolean,
): IDBKeyRange {
    const lower: [string, number, string] = [feedId, Number.NEGATIVE_INFINITY, ''];
    const upper: [string, number, string] = [feedId, Number.POSITIVE_INFINITY, ''];
    if (!cursor) return IDBKeyRange.bound(lower, upper);
    const c: [string, number, string] = [feedId, cursor.key, cursor.id];
    if (descending) return IDBKeyRange.bound(lower, c, true, true);
    return IDBKeyRange.bound(c, upper, true, true);
}

function globalRange(cursor: ArticleCursor | undefined, descending: boolean): IDBKeyRange | undefined {
    if (!cursor) return undefined;
    if (descending) return IDBKeyRange.upperBound([cursor.key, cursor.id], true);
    return IDBKeyRange.lowerBound([cursor.key, cursor.id], true);
}

function buildRange(
    feedId: string | undefined,
    cursor: ArticleCursor | undefined,
    descending: boolean,
): IDBKeyRange | undefined {
    if (feedId) return feedRange(feedId, cursor, descending);
    return globalRange(cursor, descending);
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
    const indexName = pickIndex(feedId, sort);
    const descending = sort !== 'oldest';
    const range = buildRange(feedId, cursor, descending);
    const raw = await takeFromCursor(
        store.index(indexName as never).openCursor(range as never, descending ? 'prev' : 'next'),
        limit,
        unreadOnly ? (a: Article) => a.read === 0 : undefined,
    );
    const hasMore = raw.length >= limit;
    return {items: raw, hasMore};
}

async function takeFromCursor(
    cursorReq: Promise<IDBPCursorWithValue<ReaderDB, ['articles'], 'articles', string, 'readonly'> | null>,
    limit: number,
    keep?: (article: Article) => boolean,
): Promise<Article[]> {
    const out: Article[] = [];
    let cursor = await cursorReq;
    while (cursor && out.length < limit) {
        const article = cursor.value as Article;
        if (!keep || keep(article)) out.push(article);
        cursor = await cursor.continue();
    }
    return out;
}

export async function getAllArticlesCount(): Promise<number> {
    return (await getDb()).count('articles');
}

export async function queryRecentArticles(since: number, limit = 60): Promise<Article[]> {
    const db = await getDb();
    const tx = db.transaction('articles', 'readonly');
    const range = IDBKeyRange.lowerBound([since, ''], true);
    return takeFromCursor(tx.objectStore('articles').index('byPublished').openCursor(range, 'prev'), limit);
}

export async function queryTodayArticles(since: number, maxScan = 10_000): Promise<Article[]> {
    const db = await getDb();
    const tx = db.transaction('articles', 'readonly');
    const range = IDBKeyRange.lowerBound([since, ''], true);
    const out: Article[] = [];
    let cursor = await tx.objectStore('articles').index('byPublished').openCursor(range, 'prev');
    while (cursor && out.length < maxScan) {
        out.push(cursor.value as Article);
        cursor = await cursor.continue();
    }
    await tx.done;
    return out;
}

export const HOT_VERSION = 4;

export async function recomputeHotIfNeeded(): Promise<void> {
    const db = await getDb();
    const stored = (await db.get('meta', 'hot-version'))?.value as number | undefined;
    if (stored === HOT_VERSION) return;
    await recomputeAllHot(db);
}

async function recomputeAllHot(db: Awaited<ReturnType<typeof getDb>>) {
    const tx = db.transaction(['articles', 'meta'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    let cursor = await articleStore.openCursor();
    while (cursor) {
        const article = cursor.value;
        const engagement = article.engagement ?? contentEngagement(article);
        article.engagement = engagement;
        article.hot = hotScore(article.popularity, engagement, article.published);
        article.image ??= firstImageUrl(article.content);
        await cursor.update(article);
        cursor = await cursor.continue();
    }
    await tx.objectStore('meta').put({key: 'hot-version', value: HOT_VERSION});
    await tx.done;
}

export async function reconcileUnreadCounts(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    const feeds = await feedStore.getAll();
    for (const feed of feeds) {
        const unread = (await articleStore.index('byFeedRead').getAllKeys(IDBKeyRange.bound([feed.id, 0], [feed.id, 0]))).length;
        if (feed.unread !== unread) {
            feed.unread = unread;
            await feedStore.put(feed);
        }
    }
    await tx.done;
}
