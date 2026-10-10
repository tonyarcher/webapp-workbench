import type { GenerateBody, GenerateResult, Playlist, PlaylistEntry } from '../types';
import { appConfig, resolveApiBase } from './config';

/** Build/dev `VITE_API_BASE`, or undefined where `import.meta.env` is unavailable. */
function viteApiBase(): string | undefined {
    try {
        return import.meta.env['VITE_API_BASE'];
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
    // The runtime config block (rendered by the publish step for the
    // asset-origin deploy) wins; empty means "same origin", which then falls
    // through VITE_API_BASE to the relative `${BASE_URL}api`.
    const configApiBase = appConfig().apiBase;
    if (configApiBase) return configApiBase;
    return resolveApiBase('', viteApiBase(), baseUrl());
}

export function apiUrl(path: string): string {
    return `${apiBase()}${path}`;
}

const API_VERSION_HEADERS: Record<string, string> = { 'X-Api-Version': '1' };

const FETCH_TIMEOUT_MS = 20_000;

function withTimeout(signal: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export interface FetchOptions {
    signal?: AbortSignal;
}

async function readError(res: Response): Promise<string> {
    try {
        const body = (await res.json()) as { error?: string };
        return body.error ?? res.statusText;
    } catch {
        return res.statusText;
    }
}

async function json<T>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<T>;
}

export function createPlaylist(body: GenerateBody, opts?: FetchOptions): Promise<GenerateResult> {
    return fetch(apiUrl('/playlists'), {
        method: 'POST',
        headers: { ...API_VERSION_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: withTimeout(opts?.signal),
    }).then((res) => json<GenerateResult>(res));
}

export function fetchPlaylist(id: string, opts?: FetchOptions): Promise<Playlist> {
    return fetch(apiUrl(`/playlists/${id}`), {
        headers: API_VERSION_HEADERS,
        signal: withTimeout(opts?.signal),
    }).then((res) => json<Playlist>(res));
}

export function fetchEntries(id: string, opts?: FetchOptions): Promise<PlaylistEntry[]> {
    return fetch(apiUrl(`/playlists/${id}/entries`), {
        headers: API_VERSION_HEADERS,
        signal: withTimeout(opts?.signal),
    }).then((res) => json<PlaylistEntry[]>(res));
}

export async function restorePlaylist(id: string, opts?: FetchOptions): Promise<GenerateResult> {
    const signal = withTimeout(opts?.signal);
    const [playlist, entries] = await Promise.all([fetchPlaylist(id, { signal }), fetchEntries(id, { signal })]);
    return { playlist, entries };
}
