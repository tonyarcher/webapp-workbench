import {DEFAULT_SETTINGS} from '../types'
import type {Settings} from '../types'
import {getDB} from './schema'

const SETTINGS_KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
    const db = await getDB()
    const record = await db.get('settings', SETTINGS_KEY)
    return {...DEFAULT_SETTINGS, ...(record?.value as Partial<Settings> | undefined)}
}

/**
 * Read-modify-write inside one readwrite transaction so concurrent saves
 * never drop each other's patch.
 */
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
    const db = await getDB()
    const tx = db.transaction('settings', 'readwrite')
    const current = await tx.store.get(SETTINGS_KEY)
    const merged: Settings = {
        ...DEFAULT_SETTINGS,
        ...(current?.value as Partial<Settings> | undefined),
        ...patch,
    }
    await tx.store.put({key: SETTINGS_KEY, value: merged})
    await tx.done
}
