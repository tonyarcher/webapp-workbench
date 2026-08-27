import type {AppSettings, GoogleSettings, NetflixSettings, TraktSettings} from '../types';

export const SETTINGS_KEY = 'calendar-sync.settings.v1';

export function defaultSettings(): AppSettings {
    return {
        version: 1,
        trakt: {
            clientId: '',
            clientSecret: '',
            includeCalendar: true,
            includeHistory: true,
        },
        google: {
            clientId: '',
            writtenUids: [],
        },
        netflix: {},
    };
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function parseTrakt(raw: unknown): TraktSettings {
    const rec = asRecord(raw);
    const trakt: TraktSettings = {
        clientId: rec ? asString(rec.clientId) ?? '' : '',
        clientSecret: rec ? asString(rec.clientSecret) ?? '' : '',
        includeCalendar: rec ? asBoolean(rec.includeCalendar, true) : true,
        includeHistory: rec ? asBoolean(rec.includeHistory, true) : true,
    };
    const accessToken = rec ? asString(rec.accessToken) : undefined;
    const refreshToken = rec ? asString(rec.refreshToken) : undefined;
    const accessExpiresAt = rec ? asNumber(rec.accessExpiresAt) : undefined;
    if (accessToken) trakt.accessToken = accessToken;
    if (refreshToken) trakt.refreshToken = refreshToken;
    if (accessExpiresAt !== undefined) trakt.accessExpiresAt = accessExpiresAt;
    return trakt;
}

function parseGoogle(raw: unknown): GoogleSettings {
    const rec = asRecord(raw);
    const written = rec && Array.isArray(rec.writtenUids)
        ? rec.writtenUids.filter((id): id is string => typeof id === 'string')
        : [];
    const google: GoogleSettings = {
        clientId: rec ? asString(rec.clientId) ?? '' : '',
        writtenUids: written,
    };
    const accessToken = rec ? asString(rec.accessToken) : undefined;
    const accessExpiresAt = rec ? asNumber(rec.accessExpiresAt) : undefined;
    const calendarId = rec ? asString(rec.calendarId) : undefined;
    if (accessToken) google.accessToken = accessToken;
    if (accessExpiresAt !== undefined) google.accessExpiresAt = accessExpiresAt;
    if (calendarId) google.calendarId = calendarId;
    return google;
}

function parseNetflix(raw: unknown): NetflixSettings {
    const rec = asRecord(raw);
    const netflix: NetflixSettings = {};
    const lastCount = rec ? asNumber(rec.lastCount) : undefined;
    const lastAt = rec ? asNumber(rec.lastAt) : undefined;
    if (lastCount !== undefined) netflix.lastCount = lastCount;
    if (lastAt !== undefined) netflix.lastAt = lastAt;
    return netflix;
}

export function parseSettings(raw: string | null): AppSettings | null {
    if (!raw) return null;
    try {
        const data: unknown = JSON.parse(raw);
        const rec = asRecord(data);
        if (!rec || rec.version !== 1) return null;
        const settings: AppSettings = {
            version: 1,
            trakt: parseTrakt(rec.trakt),
            google: parseGoogle(rec.google),
            netflix: parseNetflix(rec.netflix),
        };
        const last = asRecord(rec.lastSync);
        if (last) {
            const at = asNumber(last.at);
            const count = asNumber(last.count);
            const failed = asNumber(last.failed);
            const destination = last.destination === 'google' || last.destination === 'ics'
                ? last.destination
                : undefined;
            if (at !== undefined && count !== undefined && failed !== undefined && destination) {
                settings.lastSync = {at, count, failed, destination};
            }
        }
        return settings;
    } catch {
        return null;
    }
}

export function serializeSettings(settings: AppSettings): string {
    return JSON.stringify(settings);
}

export function loadSettings(): AppSettings {
    if (typeof localStorage === 'undefined') return defaultSettings();
    return parseSettings(localStorage.getItem(SETTINGS_KEY)) ?? defaultSettings();
}

export function saveSettings(settings: AppSettings): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SETTINGS_KEY, serializeSettings(settings));
}
