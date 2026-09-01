import type {IDBPObjectStore} from 'idb';
import type {ReaderDB} from './db-base';
import {getDb} from './db-base';

type ArticlesStore = IDBPObjectStore<ReaderDB, ['feeds', 'articles'], 'articles', 'readwrite'>;
type FeedsStore = IDBPObjectStore<ReaderDB, ['feeds', 'articles'], 'feeds', 'readwrite'>;

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

async function markFeedRead(articleStore: ArticlesStore, feedId: string) {
    let cursor = await articleStore.index('byFeedId').openCursor(feedId);
    while (cursor) {
        if (cursor.value.read === 0) await cursor.update({...cursor.value, read: 1 as const});
        cursor = await cursor.continue();
    }
}

async function markAllArticlesRead(articleStore: ArticlesStore) {
    let cursor = await articleStore.openCursor();
    while (cursor) {
        if (cursor.value.read === 0) await cursor.update({...cursor.value, read: 1 as const});
        cursor = await cursor.continue();
    }
}

async function zeroFeed(feedsStore: FeedsStore, feedId: string) {
    const feed = await feedsStore.get(feedId);
    if (feed) {
        feed.unread = 0;
        await feedsStore.put(feed);
    }
}

async function zeroAllFeeds(feedsStore: FeedsStore) {
    const feeds = await feedsStore.getAll();
    for (const feed of feeds) {
        feed.unread = 0;
        await feedsStore.put(feed);
    }
}

export async function markAllRead(feedId?: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    if (feedId) {
        await zeroFeed(feedStore, feedId);
        await markFeedRead(articleStore, feedId);
    } else {
        await markAllArticlesRead(articleStore);
        await zeroAllFeeds(feedStore);
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
    await applyUnreadDecrements(feedStore, unreadCounts);
    await tx.done;
}

async function applyUnreadDecrements(feedStore: FeedsStore, counts: Map<string, number>) {
    for (const [feedId, count] of counts) {
        const feed = await feedStore.get(feedId);
        if (feed) {
            feed.unread = Math.max(0, feed.unread - count);
            await feedStore.put(feed);
        }
    }
}

async function markBeforeForFeed(articleStore: ArticlesStore, feedId: string, cutoff: number, counts: Map<string, number>) {
    const lower: [string, number, string] = [feedId, Number.NEGATIVE_INFINITY, ''];
    const upper: [string, number, string] = [feedId, cutoff, ''];
    let cursor = await articleStore.index('byFeedDate').openCursor(IDBKeyRange.bound(lower, upper), 'next');
    while (cursor) {
        if (cursor.value.read === 0) {
            counts.set(feedId, (counts.get(feedId) ?? 0) + 1);
            await cursor.update({...cursor.value, read: 1});
        }
        cursor = await cursor.continue();
    }
}

async function markBeforeAll(articleStore: ArticlesStore, cutoff: number, counts: Map<string, number>) {
    const lower: [number, number] = [0, Number.NEGATIVE_INFINITY];
    const upper: [number, number] = [0, cutoff];
    let cursor = await articleStore.index('byReadDate').openCursor(IDBKeyRange.bound(lower, upper), 'next');
    while (cursor) {
        if (cursor.value.read === 0) {
            counts.set(cursor.value.feedId, (counts.get(cursor.value.feedId) ?? 0) + 1);
            await cursor.update({...cursor.value, read: 1});
        }
        cursor = await cursor.continue();
    }
}

export async function markReadBefore(feedId: string | undefined, cutoff: number): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['feeds', 'articles'], 'readwrite');
    const articleStore = tx.objectStore('articles');
    const feedStore = tx.objectStore('feeds');
    const unreadCounts = new Map<string, number>();
    if (feedId) await markBeforeForFeed(articleStore, feedId, cutoff, unreadCounts);
    else await markBeforeAll(articleStore, cutoff, unreadCounts);
    await applyUnreadDecrements(feedStore, unreadCounts);
    await tx.done;
}

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
