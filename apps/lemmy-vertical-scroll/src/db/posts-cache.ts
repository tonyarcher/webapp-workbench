import type {CommunitiesCacheEntry, LemmyCommunity, LemmyPost} from '../types'
import {getDB} from './schema'

// ---- posts ----

export async function putPostsCache(key: string, posts: LemmyPost[]): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('postsCache', 'readwrite')
    await tx.store.put({key, posts, fetchedAt: Date.now()})
    await tx.done
}

export async function getPostsCache(key: string, ttlMs: number): Promise<LemmyPost[] | null> {
    const db = await getDB()
    const entry = await db.get('postsCache', key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt >= ttlMs) {
        void deletePostsCache(key)
        return null
    }
    return entry.posts
}

export async function deletePostsCache(key: string): Promise<void> {
    const db = await getDB()
    await db.delete('postsCache', key)
}

export async function clearPostsCache(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('postsCache', 'readwrite')
    await tx.store.clear()
    await tx.done
}

// ---- communities ----

export async function putCommunitiesCache(
    key: string,
    communities: LemmyCommunity[],
): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('communitiesCache', 'readwrite')
    await tx.store.put({key, communities, fetchedAt: Date.now()} satisfies CommunitiesCacheEntry)
    await tx.done
}

export async function getCommunitiesCache(
    key: string,
    ttlMs: number,
): Promise<LemmyCommunity[] | null> {
    const db = await getDB()
    const entry = await db.get('communitiesCache', key)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt >= ttlMs) {
        await db.delete('communitiesCache', key)
        return null
    }
    return entry.communities
}

export async function clearCommunitiesCache(): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('communitiesCache', 'readwrite')
    await tx.store.clear()
    await tx.done
}
