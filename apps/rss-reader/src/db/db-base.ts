import {type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames, openDB} from 'idb';
import type {Article, Feed, Folder} from '../types';

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

export function ensureSchema(db: IDBPDatabase<ReaderDB>, tx: UpgradeTx) {
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

export async function closeDb(): Promise<void> {
    const pending = dbPromise;
    dbPromise = undefined;
    if (pending) (await pending).close();
}

export const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
