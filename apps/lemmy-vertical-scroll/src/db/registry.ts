import type {PopularServer} from '../types'
import {getDB} from './schema'

const REGISTRY_KEY = 'popular'

export async function getRegistryCache(ttlMs: number): Promise<PopularServer[] | null> {
    const db = await getDB()
    const entry = await db.get('registry', REGISTRY_KEY)
    if (!entry) return null
    if (Date.now() - entry.fetchedAt >= ttlMs) {
        await db.delete('registry', REGISTRY_KEY)
        return null
    }
    return entry.servers
}

export async function putRegistryCache(servers: PopularServer[]): Promise<void> {
    const db = await getDB()
    await db.put('registry', {key: REGISTRY_KEY, servers, fetchedAt: Date.now()})
}
