import type {DBSchema} from 'idb'
import {openDB} from 'idb'
import type {CommunitiesCacheEntry, PostsCacheEntry} from '../types'

export interface LvsDB extends DBSchema {
    settings: {
        key: string
        value: {key: string; value: unknown}
    }
    postsCache: {
        key: string
        value: PostsCacheEntry
    }
    communitiesCache: {
        key: string
        value: CommunitiesCacheEntry
    }
}

let dbPromise: Promise<import('idb').IDBPDatabase<LvsDB>> | null = null

export function getDB(): Promise<import('idb').IDBPDatabase<LvsDB>> {
    if (!dbPromise) {
        dbPromise = openDB<LvsDB>('lemmy-vertical-scroll', 1, {
            upgrade(db) {
                db.createObjectStore('settings', {keyPath: 'key'})
                db.createObjectStore('postsCache', {keyPath: 'key'})
                db.createObjectStore('communitiesCache', {keyPath: 'key'})
            },
        })
    }
    return dbPromise
}
