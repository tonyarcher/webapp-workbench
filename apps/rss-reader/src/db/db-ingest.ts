import {contentEngagement, hotScore} from '../services/ranking';
import {firstImageUrl} from '../services/parser';
import type {Article, Feed} from '../types';
import {getDb, type ReaderDB} from './db-base';
import type {IDBPObjectStore} from 'idb';

export interface BumpSpec {
    id: string;
    affinityBoost: number;
    velocity: number;
}

export interface IngestResult {
    inserted: number;
    unread: number;
}

async function storeArticles(
    store: IDBPObjectStore<ReaderDB, ['articles', 'feeds'], 'articles', 'readwrite'>,
    items: Article[],
): Promise<{ inserted: number; insertedLinks: Set<string> }> {
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
    return {inserted, insertedLinks};
}

async function applyBumps(
    store: IDBPObjectStore<ReaderDB, ['articles', 'feeds'], 'articles', 'readwrite'>,
    insertedLinks: Set<string>,
    bumpsByLink: ReadonlyMap<string, ReadonlyMap<string, BumpSpec>>,
) {
    for (const link of insertedLinks) {
        const specs = bumpsByLink.get(link);
        if (!specs) continue;
        for (const spec of specs.values()) {
            const current = await store.get(spec.id);
            if (!current) continue;
            await store.put({
                ...current,
                popularity: current.popularity + 3,
                engagement: contentEngagement(current) + spec.affinityBoost + spec.velocity,
                hot: hotScore(current.popularity + 3, contentEngagement(current) + spec.affinityBoost + spec.velocity, current.published),
                image: current.image ?? firstImageUrl(current.content),
            });
        }
    }
}

function buildMergedFeed(currentFeed: Feed | undefined, feedPatch: Feed, unread: number): Feed {
    if (!currentFeed) return {...feedPatch, unread};
    return {
        ...currentFeed,
        title: feedPatch.title,
        siteUrl: feedPatch.siteUrl,
        lastFetchedAt: feedPatch.lastFetchedAt,
        lastError: feedPatch.lastError,
        unread,
    };
}

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
    const {inserted, insertedLinks} = await storeArticles(store, items);
    await applyBumps(store, insertedLinks, bumpsByLink);
    const unread = (currentFeed?.unread ?? 0) + inserted;
    const merged = buildMergedFeed(currentFeed, feedPatch, unread);
    await tx.objectStore('feeds').put(merged);
    await tx.done;
    return {inserted, unread};
}

export async function updateFeedErrorIfExists(feedId: string, lastError: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('feeds', 'readwrite');
    const feed = await tx.store.get(feedId);
    if (feed) await tx.store.put({...feed, lastError});
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
