import { getAccessToken, refreshTokens } from './auth';
import { appConfig, resolveApiBase } from './config';

export const API_VERSION_HEADER: string = 'X-Api-Version';
export const API_VERSION: string = '1';

export class AuthError extends Error {
    constructor() {
        super('Sign in required');
        this.name = 'AuthError';
    }
}

function emitAuthRequired(): void {
    window.dispatchEvent(new CustomEvent('cal-auth-required'));
}

/** Build/dev `VITE_API_BASE`, or undefined where `import.meta.env` is unavailable. */
function viteApiBase(): string | undefined {
    try {
        const value: unknown = import.meta.env['VITE_API_BASE'];
        return typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

/** Vite's `BASE_URL`, or '/' where `import.meta.env` is unavailable (tests). */
function baseUrl(): string {
    try {
        const value: unknown = import.meta.env['BASE_URL'];
        return typeof value === 'string' ? value : '/';
    } catch {
        return '/';
    }
}

function apiBase(): string {
    // The runtime config — set once at boot from the document's `#app-config`
    // block, which the publish step renders for the asset-origin deploy — wins;
    // empty means "same origin", which then falls through VITE_API_BASE to the
    // relative `${BASE_URL}api` (the gateway's `/calendar-sync/api/` route).
    const configApiBase = appConfig().apiBase;
    if (configApiBase) return configApiBase;
    return resolveApiBase('', viteApiBase(), baseUrl());
}

export function apiUrl(path: string): string {
    return `${apiBase()}${path}`;
}

async function apiFetch(path: string, init?: RequestInit, retried = false): Promise<unknown> {
    const token = await getAccessToken();
    if (!token) {
        emitAuthRequired();
        throw new AuthError();
    }
    const res = await fetch(apiUrl(path), withAuthHeaders(init, token));
    if (res.status === 401 && !retried) return retryFetch(path, init);
    if (!res.ok) await throwForStatus(res);
    return res.json() as Promise<unknown>;
}

function withAuthHeaders(init: RequestInit | undefined, token: string): RequestInit {
    const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
    headers['Authorization'] = `Bearer ${token}`;
    headers[API_VERSION_HEADER] = API_VERSION;
    if (init?.body && typeof init.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return { ...init, headers };
}

async function retryFetch(path: string, init: RequestInit | undefined): Promise<unknown> {
    const next = await refreshTokens();
    if (next) return apiFetch(path, init, true);
    emitAuthRequired();
    throw new AuthError();
}

async function throwForStatus(res: Response): Promise<never> {
    if (res.status === 401) {
        emitAuthRequired();
        throw new AuthError();
    }
    throw new Error(await errorMessage(res));
}

async function errorMessage(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { error?: string };
        return body.error || res.statusText;
    } catch {
        return res.statusText;
    }
}

// ---- trakt vault ----

export interface TraktStatus {
    configured: boolean;
    authorized: boolean;
    expiresAt: number | null;
}

function asStatus(body: unknown): TraktStatus {
    const o = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    return {
        configured: o['configured'] === true,
        authorized: o['authorized'] === true,
        expiresAt: typeof o['expiresAt'] === 'number' ? o['expiresAt'] : null,
    };
}

/** Store this browser's Trakt app credentials in the server vault. */
export async function saveTraktCredentials(clientId: string, clientSecret: string): Promise<void> {
    await apiFetch('/trakt/credentials', {
        method: 'POST',
        body: JSON.stringify({ clientId, clientSecret }),
    });
}

/** Vault state: whether app credentials exist and whether Trakt authorized. */
export async function traktStatus(): Promise<TraktStatus> {
    return asStatus(await apiFetch('/trakt/credentials'));
}

/** Drop the vault row for this user. */
export async function clearTraktCredentials(): Promise<void> {
    await apiFetch('/trakt/credentials', { method: 'DELETE' });
}

export interface DeviceCode {
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

function requiredString(o: Record<string, unknown>, key: string): string | null {
    const value = o[key];
    return typeof value === 'string' && value ? value : null;
}

function asDeviceCode(body: unknown): DeviceCode | null {
    if (typeof body !== 'object' || body === null) return null;
    const o = body as Record<string, unknown>;
    const deviceCode = requiredString(o, 'deviceCode');
    const userCode = requiredString(o, 'userCode');
    const verificationUrl = requiredString(o, 'verificationUrl');
    const expiresIn = typeof o['expiresIn'] === 'number' ? o['expiresIn'] : null;
    const interval = typeof o['interval'] === 'number' ? o['interval'] : null;
    if (!deviceCode || !userCode || !verificationUrl || expiresIn === null || interval === null) return null;
    return { deviceCode, userCode, verificationUrl, expiresIn, interval };
}

/** Start a Trakt device flow; the user enters the code at the returned URL. */
export async function requestDeviceCode(): Promise<DeviceCode> {
    const code = asDeviceCode(await apiFetch('/trakt/device/code', { method: 'POST' }));
    if (!code) throw new Error('The server did not return a device code.');
    return code;
}

/**
 * One device-token poll. True when Trakt authorized; false while the user has
 * not entered the code yet. The caller loops this; server errors throw.
 */
export async function pollDeviceToken(deviceCode: string): Promise<boolean> {
    const body = (await apiFetch('/trakt/device/token', {
        method: 'POST',
        body: JSON.stringify({ deviceCode }),
    })) as Record<string, unknown>;
    return body['authorized'] === true;
}

/** Force a Trakt token refresh through the vault. */
export async function refreshTraktToken(): Promise<void> {
    await apiFetch('/trakt/token/refresh', { method: 'POST' });
}

// ---- trakt data (raw Trakt JSON, mapped by core) ----

async function getTraktJson(path: string): Promise<unknown[]> {
    const body = await apiFetch(path);
    return Array.isArray(body) ? (body as unknown[]) : [];
}

/** One calendar window of shows. */
export async function fetchCalendarShows(start: string, days: number): Promise<unknown[]> {
    return getTraktJson(`/trakt/calendars/shows?startDate=${encodeURIComponent(start)}&days=${days}`);
}

/** One calendar window of movies. */
export async function fetchCalendarMovies(start: string, days: number): Promise<unknown[]> {
    return getTraktJson(`/trakt/calendars/movies?startDate=${encodeURIComponent(start)}&days=${days}`);
}

/** One watch-history page. */
export async function fetchHistoryPage(kind: 'shows' | 'movies', page: number, limit: number): Promise<unknown[]> {
    return getTraktJson(`/trakt/history/${kind}?page=${page}&limit=${limit}`);
}
