import type {AuthSession} from '../types'
import {getDB} from './schema'

export interface StoredAuthSession {
    host: string
    jwt: string
    username: string
}

export async function getAuth(instance: string): Promise<AuthSession | null> {
    const db = await getDB()
    const record = await db.get('auth', instance)
    return record ? {jwt: record.jwt, username: record.username} : null
}

export async function listAuthSessions(): Promise<StoredAuthSession[]> {
    const db = await getDB()
    const records = await db.getAll('auth')
    return records.map((record) => ({host: record.key, jwt: record.jwt, username: record.username}))
}

export async function putAuth(instance: string, session: AuthSession): Promise<void> {
    const db = await getDB()
    await db.put('auth', {key: instance, ...session})
}

export async function deleteAuth(instance: string): Promise<void> {
    const db = await getDB()
    await db.delete('auth', instance)
}
