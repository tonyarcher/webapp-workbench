// The shared quiet-hours preference (S3). F3 owns the push subscription that
// reads it; K4 and F1 consume it too, so it lives here rather than in a view.
//
// Minutes are counted from local midnight and compared in local time: a reader
// on a laptop that travels expects "22:00 to 07:00" to follow the clock, not a
// fixed UTC offset. A window that starts and ends at the same minute is empty,
// because treating it as all day would silently mute every alert.

import { safeLocalStorage } from './local-storage';

export interface QuietHours {
    enabled: boolean;
    startMinute: number;
    endMinute: number;
}

export const QUIET_HOURS_KEY = 'times-up:quiet-hours';
const MINUTES_PER_DAY = 24 * 60;

export const DEFAULT_QUIET_HOURS: QuietHours = {
    enabled: false,
    startMinute: 22 * 60,
    endMinute: 7 * 60,
};

function validMinute(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MINUTES_PER_DAY
        ? value
        : fallback;
}

export function parseQuietHours(raw: string | null): QuietHours {
    if (!raw) return { ...DEFAULT_QUIET_HOURS };
    try {
        const parsed = JSON.parse(raw) as Partial<QuietHours> | null;
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_QUIET_HOURS };
        return {
            enabled: parsed.enabled === true,
            startMinute: validMinute(parsed.startMinute, DEFAULT_QUIET_HOURS.startMinute),
            endMinute: validMinute(parsed.endMinute, DEFAULT_QUIET_HOURS.endMinute),
        };
    } catch {
        return { ...DEFAULT_QUIET_HOURS };
    }
}

export function minutesOfDay(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
}

/** Half-open window: the start minute is quiet, the end minute is not. */
export function isQuietAt(minute: number, prefs: QuietHours): boolean {
    if (!prefs.enabled || prefs.startMinute === prefs.endMinute) return false;
    if (prefs.startMinute < prefs.endMinute) return minute >= prefs.startMinute && minute < prefs.endMinute;
    return minute >= prefs.startMinute || minute < prefs.endMinute;
}

export function formatMinute(minute: number): string {
    const value = validMinute(minute, 0);
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

/** `<input type="time">` value to minutes, or null when the value is not a time. */
export function parseTimeValue(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
}

export function loadQuietHours(storage?: Storage | null): QuietHours {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return { ...DEFAULT_QUIET_HOURS };
    try {
        return parseQuietHours(store.getItem(QUIET_HOURS_KEY));
    } catch {
        return { ...DEFAULT_QUIET_HOURS };
    }
}

export function saveQuietHours(prefs: QuietHours, storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return;
    try {
        store.setItem(
            QUIET_HOURS_KEY,
            JSON.stringify({
                enabled: prefs.enabled === true,
                startMinute: validMinute(prefs.startMinute, DEFAULT_QUIET_HOURS.startMinute),
                endMinute: validMinute(prefs.endMinute, DEFAULT_QUIET_HOURS.endMinute),
            }),
        );
    } catch {
        // A full or blocked store keeps the in-memory value for this page.
    }
}
