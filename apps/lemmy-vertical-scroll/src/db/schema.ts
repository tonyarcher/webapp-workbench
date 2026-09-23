import type { DBSchema } from 'idb';
import { openDB } from 'idb';
import type { CommunitiesCacheEntry, PopularServer, PostsCacheEntry, ServerRecord } from '../types';

export interface LvsDB extends DBSchema {
    settings: {
        key: string;
        value: { key: string; value: unknown };
    };
    auth: {
        key: string;
        value: { key: string; jwt: string; username: string };
    };
    servers: {
        key: string;
        value: ServerRecord;
    };
    registry: {
        key: string;
        value: { key: string; servers: PopularServer[]; fetchedAt: number };
    };
    postsCache: {
        key: string;
        value: PostsCacheEntry;
    };
    communitiesCache: {
        key: string;
        value: CommunitiesCacheEntry;
    };
}

let dbPromise: Promise<import('idb').IDBPDatabase<LvsDB>> | null = null;

export function getDB(): Promise<import('idb').IDBPDatabase<LvsDB>> {
    if (!dbPromise) dbPromise = openLvsDb();
    return dbPromise;
}

function openLvsDb(): Promise<import('idb').IDBPDatabase<LvsDB>> {
    return openDB<LvsDB>('lemmy-vertical-scroll', 3, {
        upgrade(db) {
            upgradeLvs(db);
        },
    }).catch((error) => {
        // a failed open must not poison the session — allow a retry
        dbPromise = null;
        throw error;
    });
}

function upgradeLvs(db: import('idb').IDBPDatabase<LvsDB>): void {
    // guards make the upgrade idempotent for v1 → v2 → v3 migrations
    ensureCore(db);
    ensureAccounts(db);
}

function ensureCore(db: import('idb').IDBPDatabase<LvsDB>): void {
    if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('postsCache')) {
        db.createObjectStore('postsCache', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('communitiesCache')) {
        db.createObjectStore('communitiesCache', { keyPath: 'key' });
    }
}

function ensureAccounts(db: import('idb').IDBPDatabase<LvsDB>): void {
    if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
    }
    if (!db.objectStoreNames.contains('servers')) {
        db.createObjectStore('servers', { keyPath: 'host' });
    }
    if (!db.objectStoreNames.contains('registry')) {
        db.createObjectStore('registry', { keyPath: 'key' });
    }
}
