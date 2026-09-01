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

function optString(rec: Record<string, unknown> | null, key: string): string | undefined {
    if (!rec) return undefined;
    return asString(rec[key]);
}

function optNumber(rec: Record<string, unknown> | null, key: string): number | undefined {
    if (!rec) return undefined;
    return asNumber(rec[key]);
}

function baseTrakt(rec: Record<string, unknown> | null): TraktSettings {
    return {
        clientId: optString(rec, 'clientId') ?? '',
        clientSecret: optString(rec, 'clientSecret') ?? '',
        includeCalendar: rec ? asBoolean(rec.includeCalendar, true) : true,
        includeHistory: rec ? asBoolean(rec.includeHistory, true) : true,
    };
}

function applyTraktTokens(trakt: TraktSettings, rec: Record<string, unknown> | null): void {
    const accessToken = optString(rec, 'accessToken');
    const refreshToken = optString(rec, 'refreshToken');
    const accessExpiresAt = optNumber(rec, 'accessExpiresAt');
    if (accessToken) trakt.accessToken = accessToken;
    if (refreshToken) trakt.refreshToken = refreshToken;
    if (accessExpiresAt !== undefined) trakt.accessExpiresAt = accessExpiresAt;
}

function parseTrakt(raw: unknown): TraktSettings {
    const rec = asRecord(raw);
    const trakt = baseTrakt(rec);
    applyTraktTokens(trakt, rec);
    return trakt;
}

function googleWrittenUids(rec: Record<string, unknown> | null): string[] {
    if (!rec || !Array.isArray(rec.writtenUids)) return [];
    return rec.writtenUids.filter((id): id is string => typeof id === 'string');
}

function applyGoogleTokens(google: GoogleSettings, rec: Record<string, unknown> | null): void {
    const accessToken = optString(rec, 'accessToken');
    const accessExpiresAt = optNumber(rec, 'accessExpiresAt');
    const calendarId = optString(rec, 'calendarId');
    if (accessToken) google.accessToken = accessToken;
    if (accessExpiresAt !== undefined) google.accessExpiresAt = accessExpiresAt;
    if (calendarId) google.calendarId = calendarId;
}

function parseGoogle(raw: unknown): GoogleSettings {
    const rec = asRecord(raw);
    const google: GoogleSettings = {
        clientId: optString(rec, 'clientId') ?? '',
        writtenUids: googleWrittenUids(rec),
    };
    applyGoogleTokens(google, rec);
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

function parseDestination(value: unknown): 'google' | 'ics' | undefined {
    if (value === 'google' || value === 'ics') return value;
    return undefined;
}

function parseLastSync(raw: unknown): AppSettings['lastSync'] | undefined {
    const last = asRecord(raw);
    if (!last) return undefined;
    const at = asNumber(last.at);
    const count = asNumber(last.count);
    const failed = asNumber(last.failed);
    const destination = parseDestination(last.destination);
    if (at === undefined || count === undefined || failed === undefined || !destination) return undefined;
    return {at, count, failed, destination};
}

function buildSettings(rec: Record<string, unknown>): AppSettings {
    const settings: AppSettings = {
        version: 1,
        trakt: parseTrakt(rec.trakt),
        google: parseGoogle(rec.google),
        netflix: parseNetflix(rec.netflix),
    };
    const lastSync = parseLastSync(rec.lastSync);
    if (lastSync) settings.lastSync = lastSync;
    return settings;
}

export function parseSettings(raw: string | null): AppSettings | null {
    if (!raw) return null;
    try {
        const data: unknown = JSON.parse(raw);
        const rec = asRecord(data);
        if (!rec || rec.version !== 1) return null;
        return buildSettings(rec);
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
