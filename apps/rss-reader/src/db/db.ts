import {type DBSchema, type IDBPCursorWithValue, type IDBPDatabase, type IDBPTransaction, type StoreNames, openDB} from 'idb';
import {contentEngagement, hotScore} from '../services/ranking';
import {firstImageUrl} from '../services/parser';
import type {Article, Feed, Folder} from '../types';

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

type UpgradeTx = IDBPTransaction<ReaderDB, StoreNames<ReaderDB>[], 'versionchange'>;

type ArticleIndexName =
    | 'byFeedId'
    | 'byPublished'
    | 'byFeedDate'
    | 'byReadDate'
    | 'byFeedRead'
    | 'byLink'
    | 'byHot'
    | 'byFeedHot';

const ARTICLE_INDEXES: [ArticleIndexName, string | string[]][] = [
    ['byFeedId', 'feedId'],
    ['byPublished', ['published', 'id']],
    ['byFeedDate', ['feedId', 'published', 'id']],
    ['byReadDate', ['read', 'published']],
    ['byFeedRead', ['feedId', 'read']],
    ['byLink', 'normLink'],
    ['byHot', ['hot', 'id']],
    ['byFeedHot', ['feedId', 'hot', 'id']],
];

/**
 * Create missing stores/indexes without ever deleting existing ones. Older
 * builds wiped every store on upgrade, destroying subscriptions and read
 * state; this keeps user data and only adds whatever the current schema
 * needs.
 */
function ensureSchema(db: IDBPDatabase<ReaderDB>, tx: UpgradeTx) {
    if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', {keyPath: 'id'});
    }
    if (!db.objectStoreNames.contains('feeds')) {
        const feeds = db.createObjectStore('feeds', {keyPath: 'id'});
        feeds.createIndex('byFolderId', 'folderId');
    }
    if (!db.objectStoreNames.contains('articles')) {
        const articles = db.createObjectStore('articles', {keyPath: 'id'});
        for (const [name, keyPath] of ARTICLE_INDEXES) articles.createIndex(name, keyPath as never);
    }
    if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', {keyPath: 'key'});
    }

    const feeds = tx.objectStore('feeds');
    if (!feeds.indexNames.contains('byFolderId')) feeds.createIndex('byFolderId', 'folderId');
    const articles = tx.objectStore('articles');
    for (const [name, keyPath] of ARTICLE_INDEXES) {
        if (!articles.indexNames.contains(name)) articles.createIndex(name, keyPath as never);
    }
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | undefined;

export function getDb() {
    if (!dbPromise) {
        dbPromise = openDB<ReaderDB>('rss-reader', 4, {
            upgrade(db, _oldVersion, _newVersion, tx) {
                ensureSchema(db, tx);
            },
        });
    }
    return dbPromise;
}

/** Close the cached connection and drop it (used by tests to reopen fresh). */
export async function closeDb(): Promise<void> {
    const pending = dbPromise;
    dbPromise = undefined;
    if (pending) (await pending).close();
}

export const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export async function getFolders(): Promise<Folder[]> {
    const db = await getDb();
    const folders = await db.getAll('folders');
    if (folders.some((f) => f.sortOrder == null)) {
        folders.forEach((f, i) => {
            if (f.sortOrder == null) f.sortOrder = i;
        });
        const tx = db.transaction('folders', 'readwrite');
        for (const folder of folders) await tx.store.put(folder);
        await tx.done;
    }
    return folders.sort(
        (a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.createdAt - b.createdAt || a.title.localeCompare(b.title),
    );
}

export async function reorderFolders(folderIds: string[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('folders', 'readwrite');
    for (let i = 0; i < folderIds.length; i++) {
        const folder = await tx.store.get(folderIds[i]);
        if (folder) {
            folder.sortOrder = i;
            await tx.store.put(folder);
        }
    }
    await tx.done;
}

export async function putFolder(folder: Folder): Promise<void> {
    await (await getDb()).put('folders', folder);
}

export async function deleteFolder(id: string): Promise<void> {
    await (await getDb()).delete('folders', id);
}

/** Delete a folder and strip it from every feed in one transaction. */
export async function deleteFolderTx(folderId: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['folders', 'feeds'], 'readwrite');
    await tx.objectStore('folders').delete(folderId);
    let cursor = await tx.objectStore('feeds').openCursor();
    while (cursor) {
        // normalizeFeed guards legacy feeds stored with only `folderId`
        const feed = normalizeFeed(cursor.value);
        if (feed.folderIds.includes(folderId)) {
            feed.folderIds = feed.folderIds.filter((id) => id !== folderId);
            await cursor.update(feed);
        }
        cursor = await cursor.continue();
    }
    await tx.done;
}

export async function getFeeds(): Promise<Feed[]> {
    const feeds = await (await getDb()).getAll('feeds');
    return feeds
        .map(normalizeFeed)
        .sort(
            (a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}),
        );
}

export async function getFeed(id: string): Promise<Feed | undefined> {
    const feed = await (await getDb()).get('feeds', id);
    return feed ? normalizeFeed(feed) : undefined;
}

export async function putFeed(feed: Feed): Promise<void> {
    await (await getDb()).put('feeds', feed);
}

export function normalizeFeed(feed: Feed): Feed {
    if (Array.isArray(feed.folderIds)) return feed;
    const legacy = (feed as unknown as { folderId?: string | null }).folderId;
    return {...feed, folderIds: legacy ? [legacy] : []};
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

export async function setFeedFolders(feedId: string, folderIds: string[]): Promise<void> {
    const db = await getDb();
    const feed = await db.get('feeds', feedId);
    if (feed) {
        feed.folderIds = folderIds;
        await db.put('feeds', feed);
    }
}

// ---- meta (key/value signals, e.g. reading-affinity counters) ----

export async function getMeta(key: string): Promise<unknown> {
    const rec = await (await getDb()).get('meta', key);
    return rec?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
    await (await getDb()).put('meta', {key, value});
}

export async function getMetaMany(keys: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!keys.length) return out;
    const db = await getDb();
    const tx = db.transaction('meta', 'readonly');
    for (const key of keys) {
        const rec = await tx.store.get(key);
        if (rec) out.set(key, rec.value as number);
    }
    await tx.done;
    return out;
}

export async function incrementMeta(key: string, delta: number, decay = 1): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('meta', 'readwrite');
    const rec = await tx.store.get(key);
    const current = (rec?.value as number) ?? 0;
    await tx.store.put({key, value: Math.round(current * decay + delta)});
    await tx.done;
}

export async function getArticle(id: string): Promise<Article | undefined> {
    return (await getDb()).get('articles', id);
}

/** All stored copies of a canonical link (syndication lookup). */
export async function queryArticlesByLink(link: string): Promise<Article[]> {
    const db = await getDb();
    return db.getAllFromIndex('articles', 'byLink', link);
}

export interface BumpSpec {
    /** Article id of the copy to bump. */
    id: string;
    /** affinityBoostScore(...) computed for that copy's feed/domain/author. */
    affinityBoost: number;
    velocity: number;
}

export interface IngestResult {
    inserted: number;
    unread: number;
}

/**
 * Single-transaction feed ingest: upsert articles (preserving read/starred),
 * apply syndication bumps, and fold new articles into the feed's unread
 * counter together, so a failure mid-ingest can't leave counters and
 * articles out of sync. Copies are only bumped for links this ingest newly
 * inserted (syndication grew) — re-ingests are inert.
 *
 * Concurrency: the feed's unread counter is read inside the transaction
 * (never trusting the caller's snapshot), and each bump re-reads the current
 * copy before applying the +3 delta, so concurrent mark-read/star changes
 * or other syncs can't be overwritten by stale snapshots. If the feed was
 * deleted while a sync was in flight, the ingest is a no-op (no resurrection);
 * `createIfMissing` allows brand-new feeds (addFeedFromUrl) to be written.
 */
export async function ingestArticlesTx(
    items: Article[],
    bumpsByLink: ReadonlyMap<string, ReadonlyMap<string, BumpSpec>>,
    feedPatch: Feed,
    createIfMissing: boolean,
): Promise<IngestResult> {
    const db = await getDb();
    const tx = db.transaction(['articles', 'feeds'], 'readwrite');
    const currentFeed = await tx.objectStore('feeds').get(feedPatch.id);
    if (!currentFeed && !createIfMissing) {
        await tx.done;
        return {inserted: 0, unread: 0};
    }

    const store = tx.objectStore('articles');
    let inserted = 0;
    const insertedLinks = new Set<string>();
    for (const article of items) {
        const existing = await store.get(article.id);
        if (existing) {
            await store.put({...existing, ...article, read: existing.read, starred: existing.starred});
        } else {
            await store.put(article);
            inserted++;
            if (article.normLink) insertedLinks.add(article.normLink);
        }
    }
    // A copy carries exactly one canonical link, and specs are deduped by
    // article id per link (a feed can list the same story twice).
    for (const link of insertedLinks) {
        for (const spec of bumpsByLink.get(link)?.values() ?? []) {
            const current = await store.get(spec.id);
            if (!current) continue;
            const popularity = current.popularity + 3;
            const engagement = contentEngagement(current) + spec.affinityBoost + spec.velocity;
            await store.put({
                ...current,
                popularity,
                engagement,
                hot: hotScore(popularity, engagement, current.published),
                image: current.image ?? firstImageUrl(current.content),
            });
        }
    }
    const unread = (currentFeed?.unread ?? 0) + inserted;
    const merged = currentFeed
        ? {
            ...currentFeed,
            // Only the sync-managed fields; never revert concurrent edits
            // to folderIds/unread/read state made while the fetch was in flight.
            title: feedPatch.title,
            siteUrl: feedPatch.siteUrl,
            lastFetchedAt: feedPatch.lastFetchedAt,
            lastError: feedPatch.lastError,
            unread,
        }
        : {...feedPatch, unread};
    await tx.objectStore('feeds').put(merged);
    await tx.done;
    return {inserted, unread};
}

/**
 * Surface a sync error on a feed only if it still exists — a no-op when the
 * feed was deleted while its fetch was in flight, so failures can't
 * resurrect a deleted feed.
 */
export async function updateFeedErrorIfExists(feedId: string, lastError: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('feeds', 'readwrite');
    const feed = await tx.store.get(feedId);
    if (feed) {
        await tx.store.put({...feed, lastError});
    }
    await tx.done;
}

export async function upsertArticles(articles: Article[]): Promise<number> {
    const db = await getDb();
    const tx = db.transaction('articles', 'readwrite');
    let inserted = 0;
    for (const article of articles) {
        const existing = await tx.store.get(article.id);
        if (existing) {
            await tx.store.put({...existing, ...article, read: existing.read, starred: existing.starred});
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
        unreadOnly ? (a: Article) => a.read === 0 : undefined,
    );

    const hasMore = raw.length >= limit;
    return {items: raw, hasMore};
}

/**
 * Walk a cursor collecting up to `limit` values. When `keep` is provided, rows
 * that fail the predicate are skipped but still consume cursor progress, so
 * only kept rows count toward the limit and the cursor never re-reads them.
 */
async function takeFromCursor(
    cursorReq: Promise<
        | IDBPCursorWithValue<ReaderDB, ['articles'], 'articles', string, 'readonly'>
        | null
    >,
    limit: number,
    keep?: (article: Article) => boolean,
): Promise<Article[]> {
    const out: Article[] = [];
    let cursor = await cursorReq;
    while (cursor && out.length < limit) {
        const article = cursor.value as Article;
        if (!keep || keep(article)) {
            out.push(article);
        }
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
                const updated = {...cursor.value, read: 1 as const};
                await cursor.update(updated);
            }
            cursor = await cursor.continue();
        }
    } else {
        let cursor = await articleStore.openCursor();
        while (cursor) {
            if (cursor.value.read === 0) {
                const updated = {...cursor.value, read: 1 as const};
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

export async function markArticlesRead(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    const unreadCounts = new Map<string, number>();
    for (const id of ids) {
        const article = await articleStore.get(id);
        if (article && article.read === 0) {
            await articleStore.put({...article, read: 1});
            unreadCounts.set(article.feedId, (unreadCounts.get(article.feedId) ?? 0) + 1);
        }
    }
    for (const [feedId, count] of unreadCounts) {
        const feed = await feedStore.get(feedId);
        if (feed) {
            feed.unread = Math.max(0, feed.unread - count);
            await feedStore.put(feed);
        }
    }
    await tx.done;
}

export async function markReadBefore(feedId: string | undefined, cutoff: number): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    const unreadCounts = new Map<string, number>();

    if (feedId) {
        const lower: [string, number, string] = [feedId, Number.NEGATIVE_INFINITY, ''];
        const upper: [string, number, string] = [feedId, cutoff, ''];
        let cursor = await articleStore
            .index('byFeedDate')
            .openCursor(IDBKeyRange.bound(lower, upper), 'next');
        while (cursor) {
            if (cursor.value.read === 0) {
                unreadCounts.set(feedId, (unreadCounts.get(feedId) ?? 0) + 1);
                await cursor.update({...cursor.value, read: 1});
            }
            cursor = await cursor.continue();
        }
    } else {
        const lower: [number, number] = [0, Number.NEGATIVE_INFINITY];
        const upper: [number, number] = [0, cutoff];
        let cursor = await articleStore
            .index('byReadDate')
            .openCursor(IDBKeyRange.bound(lower, upper), 'next');
        while (cursor) {
            if (cursor.value.read === 0) {
                unreadCounts.set(cursor.value.feedId, (unreadCounts.get(cursor.value.feedId) ?? 0) + 1);
                await cursor.update({...cursor.value, read: 1});
            }
            cursor = await cursor.continue();
        }
    }

    for (const [feedId, count] of unreadCounts) {
        const feed = await feedStore.get(feedId);
        if (feed) {
            feed.unread = Math.max(0, feed.unread - count);
            await feedStore.put(feed);
        }
    }
    await tx.done;
}

/**
 * Mark one article read and decrement its feed's unread counter in a single
 * transaction, so concurrent callers can't double-decrement. Returns whether
 * the article was actually flipped (false if already read or missing).
 */
export async function markArticleReadTx(articleId: string): Promise<boolean> {
    const db = await getDb();
    const tx = db.transaction(['articles', 'feeds'], 'readwrite');
    const article = await tx.objectStore('articles').get(articleId);
    if (!article || article.read === 1) {
        await tx.done;
        return false;
    }
    article.read = 1;
    await tx.objectStore('articles').put(article);
    const feed = await tx.objectStore('feeds').get(article.feedId);
    if (feed && feed.unread > 0) {
        feed.unread -= 1;
        await tx.objectStore('feeds').put(feed);
    }
    await tx.done;
    return true;
}

export async function getAllArticlesCount(): Promise<number> {
    return (await getDb()).count('articles');
}

export async function queryRecentArticles(since: number, limit = 60): Promise<Article[]> {
    const db = await getDb();
    const tx = db.transaction('articles', 'readonly');
    const range = IDBKeyRange.lowerBound([since, ''], true);
    return takeFromCursor(
        tx.objectStore('articles').index('byPublished').openCursor(range, 'prev'),
        limit,
    );
}

export const HOT_VERSION = 4;

/**
 * One-time migration: recompute stored `hot` values after a ranking change and
 * backfill card images. Runs at startup (not during the DB upgrade, which wipes
 * stores). Existing articles get a content-based engagement estimate until
 * their feed re-syncs and fills in affinity/velocity terms.
 */
export async function recomputeHotIfNeeded(): Promise<void> {
    const db = await getDb();
    const stored = (await db.get('meta', 'hot-version'))?.value as number | undefined;
    if (stored === HOT_VERSION) return;

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

/**
 * Set each feed's `unread` counter to the actual number of unread articles,
 * so the sidebar badge always matches what the article list shows. Protects
 * against any drift in the increment/decrement counters.
 */
export async function reconcileUnreadCounts(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    const feeds = await feedStore.getAll();
    for (const feed of feeds) {
        const unread = (await articleStore
            .index('byFeedRead')
            .getAllKeys(IDBKeyRange.bound([feed.id, 0], [feed.id, 0]))).length;
        if (feed.unread !== unread) {
            feed.unread = unread;
            await feedStore.put(feed);
        }
    }
    await tx.done;
}
