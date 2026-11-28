// B5 snooze. A snoozed row disappears from normal lists until its local wake
// time, then reappears on the next refresh. Only an id and timestamp are stored.

import { safeLocalStorage } from './local-storage';
import type { Article } from '../types';

const KEY = 'times-up:snoozed';
export type SnoozeWindow = 'tonight' | 'tomorrow' | 'weekend';

export interface SnoozeEntry {
    id: string;
    until: number;
}

let runtimeEntries: SnoozeEntry[] | null = null;

export function parseSnoozeEntries(raw: string | null): SnoozeEntry[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (entry): entry is SnoozeEntry =>
                !!entry &&
                typeof entry === 'object' &&
                typeof (entry as SnoozeEntry).id === 'string' &&
                typeof (entry as SnoozeEntry).until === 'number',
        );
    } catch {
        return [];
    }
}

export function loadSnoozed(storage?: Storage | null): SnoozeEntry[] {
    if (storage !== undefined) {
        try {
            return parseSnoozeEntries(storage?.getItem(KEY) ?? null);
        } catch {
            return [];
        }
    }
    const store = safeLocalStorage();
    if (!store) return runtimeEntries ?? [];
    try {
        const entries = parseSnoozeEntries(store.getItem(KEY));
        runtimeEntries = entries;
        return entries;
    } catch {
        return runtimeEntries ?? [];
    }
}

export function saveSnoozed(entries: SnoozeEntry[], storage?: Storage | null): void {
    if (storage === undefined) runtimeEntries = entries;
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        store?.setItem(KEY, JSON.stringify(entries));
    } catch {
        // The current page still keeps the in-memory action result.
    }
}

export function snoozeArticle(article: Article, until: number, storage?: Storage | null): SnoozeEntry[] {
    const entries = [...loadSnoozed(storage).filter((entry) => entry.id !== article.id), { id: article.id, until }];
    saveSnoozed(entries, storage);
    return entries;
}

export function removeSnoozed(articleId: string, storage?: Storage | null): SnoozeEntry[] {
    const entries = loadSnoozed(storage).filter((entry) => entry.id !== articleId);
    saveSnoozed(entries, storage);
    return entries;
}

export function activeSnoozedIds(entries: SnoozeEntry[], now = Date.now()): Set<string> {
    return new Set(entries.filter((entry) => entry.until > now).map((entry) => entry.id));
}

function at(now: Date, dayOffset: number, hour: number): number {
    const next = new Date(now);
    next.setDate(next.getDate() + dayOffset);
    next.setHours(hour, 0, 0, 0);
    return next.getTime();
}

export function snoozeUntil(window: SnoozeWindow, now = new Date()): number {
    if (window === 'tonight') return at(now, now.getHours() >= 20 ? 1 : 0, 20);
    if (window === 'tomorrow') return at(now, 1, 9);
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    return at(now, daysUntilSaturday, 9);
}
