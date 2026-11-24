import { type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames, openDB } from 'idb';
import type { Article, Feed, Folder, SavedArticleSnapshot } from '../types';

export interface ReaderDB extends DBSchema {
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
    saved: {
        key: string;
        value: SavedArticleSnapshot;
    };
    meta: {
        key: string;
        value: { key: string; value: unknown };
    };
}

type UpgradeTx = IDBPTransaction<ReaderDB, StoreNames<ReaderDB>[], 'versionchange'>;

type ArticleIndexName =
    'byFeedId' | 'byPublished' | 'byFeedDate' | 'byReadDate' | 'byFeedRead' | 'byLink' | 'byHot' | 'byFeedHot';

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

export function ensureSchema(db: IDBPDatabase<ReaderDB>, tx: UpgradeTx) {
    if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('feeds')) {
        const feeds = db.createObjectStore('feeds', { keyPath: 'id' });
        feeds.createIndex('byFolderId', 'folderId');
    }
    if (!db.objectStoreNames.contains('articles')) {
        const articles = db.createObjectStore('articles', { keyPath: 'id' });
        for (const [name, keyPath] of ARTICLE_INDEXES) articles.createIndex(name, keyPath as never);
    }
    if (!db.objectStoreNames.contains('saved')) {
        db.createObjectStore('saved', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
    }
    const feeds = tx.objectStore('feeds');
    if (!feeds.indexNames.contains('byFolderId')) feeds.createIndex('byFolderId', 'folderId');
    const articles = tx.objectStore('articles');
    for (const [name, keyPath] of ARTICLE_INDEXES) {
        if (!articles.indexNames.contains(name)) articles.createIndex(name, keyPath as never);
    }
}

const LEGACY_DB = 'rss-reader';
const CURRENT_DB = 'times-up';
const LEGACY_MIGRATED_KEY = 'legacy-db-migrated';
const CLEAR_CHANNEL = 'times-up-db-clear';
const CLEAR_GRACE_MS = 300;

type ClearMessage = { type: 'close'; sender: string };

let clearChannel: BroadcastChannel | null = null;

function ensureClearChannel(): void {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    if (clearChannel) return;
    clearChannel = new BroadcastChannel(CLEAR_CHANNEL);
    clearChannel.onmessage = (event: MessageEvent<ClearMessage>) => {
        if (event.data.type === 'close') void closeDb().catch(() => {});
    };
}

async function askOtherTabsToClose(): Promise<void> {
    ensureClearChannel();
    if (!clearChannel) return;
    clearChannel.postMessage({ type: 'close', sender: uid() } satisfies ClearMessage);
    await new Promise<void>((resolve) => setTimeout(resolve, CLEAR_GRACE_MS));
}

function deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('database delete failed'));
        request.onblocked = () =>
            reject(new Error(`Could not clear ${name}. Close other Times Up tabs and reload before signing in again.`));
    });
}

async function copyLegacyRows(legacy: IDBPDatabase<ReaderDB>, current: IDBPDatabase<ReaderDB>): Promise<void> {
    for (const storeName of Array.from(legacy.objectStoreNames)) {
        const sourceTx = legacy.transaction(storeName as never, 'readonly');
        const source = sourceTx.objectStore(storeName as never);
        const [keys, values] = await Promise.all([source.getAllKeys(), source.getAll()]);
        await sourceTx.done;

        const targetTx = current.transaction(storeName as never, 'readwrite');
        const target = targetTx.objectStore(storeName as never);
        const existing = new Set(await target.getAllKeys());
        const missing: unknown[] = [];
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index];
            if (key === undefined || existing.has(key)) continue;
            const value = values[index];
            if (value === undefined) continue;
            missing.push(
                storeName === 'articles'
                    ? {
                          ...(value as Article),
                          popularity: (value as Article).popularity ?? 0,
                          engagement: (value as Article).engagement ?? 0,
                          hot: (value as Article).hot ?? 0,
                      }
                    : value,
            );
        }
        await Promise.all(missing.map((record) => target.put(record as never)));
        await targetTx.done;
    }
}

/** Copy legacy rows once without overwriting newer data or replaying later deletions. */
export async function migrateLegacyDatabase(): Promise<boolean> {
    if (!('databases' in indexedDB)) return false;
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === LEGACY_DB)) return false;
    const current = await openDB<ReaderDB>(CURRENT_DB, 5, {
        upgrade(db, _oldVersion, _newVersion, tx) {
            ensureSchema(db, tx);
        },
    });
    try {
        if ((await current.get('meta', LEGACY_MIGRATED_KEY))?.value === true) return true;
        const legacy = await openDB<ReaderDB>(LEGACY_DB);
        try {
            await copyLegacyRows(legacy, current);
        } finally {
            legacy.close();
        }
        const tx = current.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ key: LEGACY_MIGRATED_KEY, value: true });
        await tx.done;
        // Keep the old database as a read-only backup. Replaying it would bring
        // back rows the user deleted after the move; sign-out clears both names.
        return true;
    } finally {
        current.close();
    }
}

let dbPromise: Promise<IDBPDatabase<ReaderDB>> | undefined;
let clearPromise: Promise<void> | null = null;

export function getDb(): Promise<IDBPDatabase<ReaderDB>> {
    ensureClearChannel();
    if (clearPromise) return clearPromise.then(() => getDb());
    if (!dbPromise) {
        dbPromise = migrateLegacyDatabase().then(() =>
            openDB<ReaderDB>(CURRENT_DB, 5, {
                upgrade(db, _oldVersion, _newVersion, tx) {
                    ensureSchema(db, tx);
                },
            }),
        );
    }
    return dbPromise;
}

export async function closeDb(): Promise<void> {
    const pending = dbPromise;
    dbPromise = undefined;
    if (pending) (await pending).close();
}

export async function clearClientDb(): Promise<void> {
    if (clearPromise) return clearPromise;
    const clearing = performClear();
    clearPromise = clearing;
    try {
        await clearing;
    } finally {
        if (clearPromise === clearing) clearPromise = null;
    }
}

async function performClear(): Promise<void> {
    await closeDb();
    await askOtherTabsToClose();
    await deleteDatabase(LEGACY_DB);
    await deleteDatabase(CURRENT_DB);
}

export const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
