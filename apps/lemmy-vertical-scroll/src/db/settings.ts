import {DEFAULT_SETTINGS} from '../types'
import type {Settings} from '../types'
import {getDB} from './schema'

const SETTINGS_KEY = 'settings'

export async function loadSettings(): Promise<Settings> {
    const db = await getDB()
    const record = await db.get('settings', SETTINGS_KEY)
    return {...DEFAULT_SETTINGS, ...(record?.value as Partial<Settings> | undefined)}
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
    const db = await getDB()
    const current = await loadSettings()
    const merged: Settings = {...current, ...patch}
    const tx = db.transaction('settings', 'readwrite')
    await tx.store.put({key: SETTINGS_KEY, value: merged})
    await tx.done
}
