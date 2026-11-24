import { getAccessToken, refreshTokens } from './auth';
import { appConfig, resolveApiBase } from './config';

// ---- base fetch ----

export const API_VERSION_HEADER: string = 'X-Api-Version';
export const API_VERSION: string = '1';

export class AuthError extends Error {
    constructor() {
        super('Sign in required');
        this.name = 'AuthError';
    }
}

function emitAuthRequired(): void {
    window.dispatchEvent(new CustomEvent('times-up-auth-required'));
}

/** Build/dev `VITE_API_BASE`, or undefined where `import.meta.env` is unavailable. */
function viteApiBase(): string | undefined {
    try {
        return import.meta.env.VITE_API_BASE;
    } catch {
        return undefined;
    }
}

/** Vite's `BASE_URL`, or '/' where `import.meta.env` is unavailable (tests). */
function baseUrl(): string {
    try {
        return import.meta.env.BASE_URL;
    } catch {
        return '/';
    }
}

function apiBase(): string {
    // The runtime config — set once at boot from the document's `#app-config`
    // block, which the publish step renders for the asset-origin deploy — wins;
    // empty means "same origin", which then falls through VITE_API_BASE to the
    // relative `${BASE_URL}api`.
    const configApiBase = appConfig().apiBase;
    if (configApiBase) return configApiBase;
    return resolveApiBase('', viteApiBase(), baseUrl());
}

export function apiUrl(path: string): string {
    return `${apiBase()}${path}`;
}

export async function apiFetch(path: string, init?: RequestInit, retried = false): Promise<unknown> {
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

export function withAuthHeaders(init: RequestInit | undefined, token: string): RequestInit {
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

export async function errorMessage(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { error?: string };
        return body.error || res.statusText;
    } catch {
        return res.statusText;
    }
}

export async function authedFetch(path: string, init?: RequestInit, retried = false): Promise<Response> {
    const token = await getAccessToken();
    if (!token) {
        emitAuthRequired();
        throw new AuthError();
    }
    const res = await fetch(apiUrl(path), withAuthHeaders(init, token));
    if (res.status === 401 && !retried) return retryFetchRaw(path, init);
    if (res.status === 401) {
        emitAuthRequired();
        throw new AuthError();
    }
    return res;
}

async function retryFetchRaw(path: string, init: RequestInit | undefined): Promise<Response> {
    const next = await refreshTokens();
    if (next) return authedFetch(path, init, true);
    emitAuthRequired();
    throw new AuthError();
}
