import type {CalEvent, FetchLike, SyncProgress} from './types';
import {asArray, asNumber, asString, isRecord, joinUrl, pad2, startOfUtcDay, utcYmd} from './util';

export const TRAKT_API_VERSION = '2';
export const TRAKT_MAX_CALENDAR_DAYS = 33;
export const TRAKT_HISTORY_PAGE_SIZE = 100;
export const TRAKT_HISTORY_MAX_PAGES = 50;
export const DEFAULT_CALENDAR_PAST_DAYS = 7;
export const DEFAULT_CALENDAR_FUTURE_DAYS = 90;
export const DEFAULT_EPISODE_MINUTES = 60;
export const DEFAULT_MOVIE_MINUTES = 120;
const DAY_MS = 86_400_000;

export class TraktHttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'TraktHttpError';
        this.status = status;
    }
}

export function traktHeaders(clientId: string, accessToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'trakt-api-version': TRAKT_API_VERSION,
        'trakt-api-key': clientId,
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
}

export function calendarShowsPath(startDate: string, days: number): string {
    return `/calendars/my/shows/${startDate}/${days}`;
}

export function calendarMoviesPath(startDate: string, days: number): string {
    return `/calendars/my/movies/${startDate}/${days}`;
}

export function historyPath(type: 'shows' | 'movies', page: number, limit: number): string {
    return `/sync/history/${type}?page=${page}&limit=${limit}`;
}

export function deviceCodePath(): string {
    return '/oauth/device/code';
}

export function deviceTokenPath(): string {
    return '/oauth/device/token';
}

export function refreshTokenPath(): string {
    return '/oauth/token';
}

export const TRAKT_VERIFICATION_URL = 'https://trakt.tv/activate';

export interface TraktDeviceCode {
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

export interface TraktToken {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    createdAt?: number;
}

/** Only accept a Trakt-hosted https URL; anything else falls back to the
 *  canonical activation URL so an untrusted value can never reach an `href`. */
function safeVerificationUrl(value: string | undefined): string {
    if (value) {
        try {
            const url = new URL(value);
            if (url.protocol === 'https:' && (url.hostname === 'trakt.tv' || url.hostname.endsWith('.trakt.tv'))) {
                return url.href;
            }
        } catch {
            // fall through to the safe constant
        }
    }
    return TRAKT_VERIFICATION_URL;
}

export function parseDeviceCodeResponse(json: unknown): TraktDeviceCode | null {
    if (!isRecord(json)) return null;
    const deviceCode = asString(json.device_code);
    const userCode = asString(json.user_code);
    const expiresIn = asNumber(json.expires_in);
    const interval = asNumber(json.interval);
    if (!deviceCode || !userCode || expiresIn === undefined || interval === undefined) {
        return null;
    }
    return {
        deviceCode,
        userCode,
        verificationUrl: safeVerificationUrl(asString(json.verification_url)),
        expiresIn,
        interval,
    };
}

export function parseTokenResponse(json: unknown): TraktToken | null {
    if (!isRecord(json)) return null;
    const accessToken = asString(json.access_token);
    const refreshToken = asString(json.refresh_token);
    const expiresIn = asNumber(json.expires_in);
    if (!accessToken || !refreshToken || expiresIn === undefined) return null;
    const createdAt = asNumber(json.created_at);
    return createdAt === undefined
        ? {accessToken, refreshToken, expiresIn}
        : {accessToken, refreshToken, expiresIn, createdAt};
}

export type DevicePollResult =
    | {status: 'pending'}
    | {status: 'slow_down'}
    | {status: 'denied'}
    | {status: 'expired'}
    | {status: 'token'; token: TraktToken};

export function parseDevicePollResponse(httpStatus: number, json: unknown): DevicePollResult {
    const token = parseTokenResponse(json);
    if (token) return {status: 'token', token};
    const error = isRecord(json) ? asString(json.error) : undefined;
    if (error === 'slow_down' || httpStatus === 429) return {status: 'slow_down'};
    if (error === 'access_denied' || error === 'denied') return {status: 'denied'};
    if (error === 'expired_token' || error === 'expired') return {status: 'expired'};
    return {status: 'pending'};
}

export function calendarWindows(
    fromMs: number,
    toMs: number,
    maxDays = TRAKT_MAX_CALENDAR_DAYS,
): Array<{start: string; days: number}> {
    const windows: Array<{start: string; days: number}> = [];
    let cursor = startOfUtcDay(fromMs);
    const end = Math.max(cursor + DAY_MS, toMs);
    while (cursor < end) {
        const remaining = Math.max(1, Math.ceil((end - cursor) / DAY_MS));
        const days = Math.min(maxDays, remaining);
        windows.push({start: utcYmd(cursor), days});
        cursor += days * DAY_MS;
    }
    return windows;
}

function idsTrakt(ids: unknown): number | undefined {
    if (!isRecord(ids)) return undefined;
    return asNumber(ids.trakt);
}

function idsSlug(ids: unknown): string | undefined {
    if (!isRecord(ids)) return undefined;
    return asString(ids.slug);
}

function runtimeMs(runtime: unknown, fallbackMinutes: number): number {
    const minutes = asNumber(runtime);
    return (minutes && minutes > 0 ? minutes : fallbackMinutes) * 60_000;
}

function parseInstant(raw: unknown): number | undefined {
    const s = asString(raw);
    if (!s) return undefined;
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : undefined;
}

export function mapCalendarShow(item: unknown): CalEvent | null {
    if (!isRecord(item)) return null;
    const start = parseInstant(item.first_aired);
    if (start === undefined) return null;
    const episode = isRecord(item.episode) ? item.episode : undefined;
    const show = isRecord(item.show) ? item.show : undefined;
    if (!episode || !show) return null;
    const showId = idsTrakt(show.ids);
    const season = asNumber(episode.season);
    const number = asNumber(episode.number);
    if (showId === undefined || season === undefined || number === undefined) return null;
    const showTitle = asString(show.title) ?? 'Show';
    const epTitle = asString(episode.title);
    const title = epTitle
        ? `${showTitle} S${pad2(season)}E${pad2(number)}: ${epTitle}`
        : `${showTitle} S${pad2(season)}E${pad2(number)}`;
    const end = start + runtimeMs(episode.runtime ?? show.runtime, DEFAULT_EPISODE_MINUTES);
    const slug = idsSlug(show.ids);
    const url = slug
        ? `https://trakt.tv/shows/${slug}/seasons/${season}/episodes/${number}`
        : undefined;
    return {
        uid: `cal-sync:trakt:air:show:${showId}:s${season}e${number}`,
        source: 'trakt',
        title,
        start,
        end,
        allDay: false,
        url,
    };
}

export function mapCalendarMovie(item: unknown): CalEvent | null {
    if (!isRecord(item)) return null;
    const movie = isRecord(item.movie) ? item.movie : undefined;
    if (!movie) return null;
    const movieId = idsTrakt(movie.ids);
    if (movieId === undefined) return null;
    const released = asString(item.released);
    const start = released ? Date.parse(`${released}T00:00:00Z`) : parseInstant(item.first_aired);
    if (start === undefined || !Number.isFinite(start)) return null;
    const year = asNumber(movie.year);
    const name = asString(movie.title) ?? 'Movie';
    const title = year !== undefined ? `${name} (${year})` : name;
    const slug = idsSlug(movie.ids);
    return {
        uid: `cal-sync:trakt:air:movie:${movieId}:${utcYmd(start)}`,
        source: 'trakt',
        title,
        start,
        end: start + DAY_MS,
        allDay: true,
        url: slug ? `https://trakt.tv/movies/${slug}` : undefined,
    };
}

export function mapHistoryItem(item: unknown): CalEvent | null {
    if (!isRecord(item)) return null;
    const start = parseInstant(item.watched_at);
    if (start === undefined) return null;
    const type = asString(item.type);
    if (type === 'episode' || isRecord(item.episode)) {
        const episode = isRecord(item.episode) ? item.episode : undefined;
        const show = isRecord(item.show) ? item.show : undefined;
        if (!episode || !show) return null;
        const showId = idsTrakt(show.ids);
        const season = asNumber(episode.season);
        const number = asNumber(episode.number);
        if (showId === undefined || season === undefined || number === undefined) return null;
        const showTitle = asString(show.title) ?? 'Show';
        const epTitle = asString(episode.title);
        const title = epTitle
            ? `${showTitle} S${pad2(season)}E${pad2(number)}: ${epTitle}`
            : `${showTitle} S${pad2(season)}E${pad2(number)}`;
        const slug = idsSlug(show.ids);
        return {
            uid: `cal-sync:trakt:watch:show:${showId}:s${season}e${number}:${start}`,
            source: 'trakt',
            title,
            start,
            end: start + runtimeMs(episode.runtime ?? show.runtime, DEFAULT_EPISODE_MINUTES),
            allDay: false,
            description: 'Watched',
            url: slug
                ? `https://trakt.tv/shows/${slug}/seasons/${season}/episodes/${number}`
                : undefined,
        };
    }
    const movie = isRecord(item.movie) ? item.movie : undefined;
    if (!movie) return null;
    const movieId = idsTrakt(movie.ids);
    if (movieId === undefined) return null;
    const year = asNumber(movie.year);
    const name = asString(movie.title) ?? 'Movie';
    const slug = idsSlug(movie.ids);
    return {
        uid: `cal-sync:trakt:watch:movie:${movieId}:${start}`,
        source: 'trakt',
        title: year !== undefined ? `${name} (${year})` : name,
        start,
        end: start + runtimeMs(movie.runtime, DEFAULT_MOVIE_MINUTES),
        allDay: false,
        description: 'Watched',
        url: slug ? `https://trakt.tv/movies/${slug}` : undefined,
    };
}

async function traktGet(
    fetchImpl: FetchLike,
    url: string,
    headers: Record<string, string>,
): Promise<{status: number; json: unknown; headers: {get(name: string): string | null}}> {
    const res = await fetchImpl(url, {method: 'GET', headers});
    let json: unknown;
    try {
        json = await res.json();
    } catch {
        json = undefined;
    }
    if (!res.ok) {
        const msg = isRecord(json) ? asString(json.error) ?? asString(json.message) : undefined;
        throw new TraktHttpError(res.status, msg ?? `Trakt HTTP ${res.status}`);
    }
    return {status: res.status, json, headers: res.headers};
}

export async function fetchTraktEvents({
    fetch: fetchImpl,
    baseUrl,
    clientId,
    accessToken,
    includeCalendar = true,
    includeHistory = true,
    now = Date.now(),
    onProgress,
    onTruncate,
}: {
    fetch: FetchLike;
    baseUrl: string;
    clientId: string;
    accessToken: string;
    includeCalendar?: boolean;
    includeHistory?: boolean;
    now?: number;
    onProgress?: (progress: SyncProgress) => void;
    onTruncate?: (info: {type: 'shows' | 'movies'; page: number}) => void;
}): Promise<CalEvent[]> {
    const headers = traktHeaders(clientId, accessToken);
    const events: CalEvent[] = [];
    let processed = 0;

    if (includeCalendar) {
        const from = now - DEFAULT_CALENDAR_PAST_DAYS * DAY_MS;
        const to = now + DEFAULT_CALENDAR_FUTURE_DAYS * DAY_MS;
        const windows = calendarWindows(from, to);
        const total = windows.length * 2;
        for (const window of windows) {
            onProgress?.({
                phase: 'fetch',
                done: processed,
                total,
                label: `calendar ${window.start}`,
            });
            const shows = await traktGet(
                fetchImpl,
                joinUrl(baseUrl, calendarShowsPath(window.start, window.days)),
                headers,
            );
            for (const item of asArray(shows.json) ?? []) {
                const event = mapCalendarShow(item);
                if (event) events.push(event);
            }
            processed++;
            const movies = await traktGet(
                fetchImpl,
                joinUrl(baseUrl, calendarMoviesPath(window.start, window.days)),
                headers,
            );
            for (const item of asArray(movies.json) ?? []) {
                const event = mapCalendarMovie(item);
                if (event) events.push(event);
            }
            processed++;
            onProgress?.({phase: 'fetch', done: processed, total, label: `calendar ${window.start}`});
        }
    }

    if (includeHistory) {
        for (const type of ['shows', 'movies'] as const) {
            for (let page = 1; page <= TRAKT_HISTORY_MAX_PAGES; page++) {
                onProgress?.({
                    phase: 'fetch',
                    done: page - 1,
                    label: `history ${type} page ${page}`,
                });
                const res = await traktGet(
                    fetchImpl,
                    joinUrl(baseUrl, historyPath(type, page, TRAKT_HISTORY_PAGE_SIZE)),
                    headers,
                );
                const items = asArray(res.json) ?? [];
                for (const item of items) {
                    const event = mapHistoryItem(item);
                    if (event) events.push(event);
                }
                const pageCount = Number(res.headers.get('x-pagination-page-count'));
                onProgress?.({
                    phase: 'fetch',
                    done: page,
                    total: Number.isFinite(pageCount) && pageCount > 0 ? pageCount : undefined,
                    label: `history ${type} page ${page}`,
                });
                if (items.length === 0) break;
                if (Number.isFinite(pageCount) && page >= pageCount) break;
                if (items.length < TRAKT_HISTORY_PAGE_SIZE) break;
                if (page === TRAKT_HISTORY_MAX_PAGES) {
                    onTruncate?.({type, page});
                    break;
                }
            }
        }
    }

    onProgress?.({phase: 'convert', done: events.length, total: events.length});
    return events;
}
