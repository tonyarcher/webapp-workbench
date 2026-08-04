import type {ServerRecord} from '../types'
import {getDB} from './schema'

export async function listServers(): Promise<ServerRecord[]> {
    const db = await getDB()
    return db.getAll('servers')
}

export async function getServer(host: string): Promise<ServerRecord | undefined> {
    const db = await getDB()
    return db.get('servers', host)
}

export async function putServer(record: ServerRecord): Promise<void> {
    const db = await getDB()
    await db.put('servers', record)
}

export async function deleteServer(host: string): Promise<void> {
    const db = await getDB()
    await db.delete('servers', host)
}
