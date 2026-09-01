import type {Feed, Folder} from '../types';
import {getDb} from './db-base';

export {closeDb, getDb, uid} from './db-base';
export type {ReaderDB} from './db-base';
export * from './db-ingest';
export * from './db-mutations';
export * from './db-query';

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

export async function deleteFolderTx(folderId: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['folders', 'feeds'], 'readwrite');
    await tx.objectStore('folders').delete(folderId);
    let cursor = await tx.objectStore('feeds').openCursor();
    while (cursor) {
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
        .sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}));
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
