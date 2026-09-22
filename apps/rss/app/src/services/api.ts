import type {Article, Edition, EditionMeta, EditionSection, EditionStatus, Feed, Folder} from '../types';
import type {SummaryLength} from '../ai';
import {getAccessToken, refreshTokens} from './auth';

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
    window.dispatchEvent(new CustomEvent('rss-auth-required'));
}

function apiBase(): string {
    try {
        return `${import.meta.env.BASE_URL}api`;
    } catch {
        return '/api';
    }
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
    const headers: Record<string, string> = {...(init?.headers as Record<string, string> ?? {})};
    headers['Authorization'] = `Bearer ${token}`;
    headers[API_VERSION_HEADER] = API_VERSION;
    if (init?.body && typeof init.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return {...init, headers};
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
        const body = await res.json() as { error?: string };
        return body.error || res.statusText;
    } catch {
        return res.statusText;
    }
}

// ---- library (progressive: folders, then names, then badges) ----

export async function getLibraryFolders(): Promise<{ folders: Folder[] }> {
    return apiFetch('/library/folders') as Promise<{ folders: Folder[] }>;
}

export async function getLibraryFeeds(): Promise<{ feeds: Feed[] }> {
    return apiFetch('/library/feeds') as Promise<{ feeds: Feed[] }>;
}

export async function getLibraryCounts(): Promise<{ counts: Record<string, number> }> {
    return apiFetch('/library/counts') as Promise<{ counts: Record<string, number> }>;
}

// ---- folders ----

export async function addFolder(title: string): Promise<Folder> {
    return apiFetch('/folders', {
        method: 'POST',
        body: JSON.stringify({title}),
    }) as Promise<Folder>;
}

export async function deleteFolder(id: string): Promise<{ ok: true }> {
    return apiFetch(`/folders/${id}`, {method: 'DELETE'}) as Promise<{ ok: true }>;
}

export async function reorderFolders(ids: string[]): Promise<{ ok: true }> {
    return apiFetch('/folders/reorder', {
        method: 'POST',
        body: JSON.stringify({ids}),
    }) as Promise<{ ok: true }>;
}

// ---- feeds ----

export async function addFeed(url: string, folderIds?: string[]): Promise<Feed> {
    return apiFetch('/feeds', {
        method: 'POST',
        body: JSON.stringify({url, folderIds}),
    }) as Promise<Feed>;
}

export async function deleteFeed(id: string): Promise<{ ok: true }> {
    return apiFetch(`/feeds/${id}`, {method: 'DELETE'}) as Promise<{ ok: true }>;
}

export async function setFeedFolders(id: string, folderIds: string[]): Promise<{ ok: true }> {
    return apiFetch(`/feeds/${id}/folders`, {
        method: 'PUT',
        body: JSON.stringify({folderIds}),
    }) as Promise<{ ok: true }>;
}

// ---- articles ----

export interface ArticlePageParams {
    scope?: string | undefined;
    unreadOnly?: boolean | undefined;
    sort?: 'hot' | 'newest' | 'oldest' | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    since?: number | undefined;
}

export async function fetchArticlesPage(params: ArticlePageParams = {}): Promise<{ items: Article[]; nextCursor?: string }> {
    const q = new URLSearchParams();
    if (params.scope) q.set('scope', params.scope);
    if (params.unreadOnly) q.set('unreadOnly', '1');
    if (params.sort) q.set('sort', params.sort);
    if (params.cursor) q.set('cursor', params.cursor);
    if (params.limit) q.set('limit', String(params.limit));
    if (params.since) q.set('since', String(params.since));
    return apiFetch(`/articles?${q}`) as Promise<{ items: Article[]; nextCursor?: string }>;
}

export interface ArticleStateUpdate {
    id: string;
    read?: boolean;
    starred?: boolean;
}

export async function updateArticleState(updates: ArticleStateUpdate[]): Promise<{ ok: true; updated: number }> {
    return apiFetch('/articles/state', {
        method: 'POST',
        body: JSON.stringify({updates}),
    }) as Promise<{ ok: true; updated: number }>;
}

export async function readBefore(feedIds: string[] | undefined, cutoff: number): Promise<{ ok: true }> {
    return apiFetch('/articles/read-before', {
        method: 'POST',
        body: JSON.stringify({feedIds, cutoff}),
    }) as Promise<{ ok: true }>;
}

export async function readAll(feedId?: string): Promise<{ ok: true }> {
    return apiFetch('/articles/read-all', {
        method: 'POST',
        body: JSON.stringify({feedId}),
    }) as Promise<{ ok: true }>;
}

// ---- affinity ----

export async function recordAffinity(articleId: string, amount: number): Promise<{ ok: true }> {
    return apiFetch('/affinity', {
        method: 'POST',
        body: JSON.stringify({articleId, amount}),
    }) as Promise<{ ok: true }>;
}

// ---- sync ----

export async function requestSync(scope?: 'all' | { feedIds: string[] }): Promise<{ queued: number }> {
    return apiFetch('/sync', {
        method: 'POST',
        body: JSON.stringify({scope}),
    }) as Promise<{ queued: number }>;
}

// ---- OPML ----

async function apiFetchText(path: string, retried = false): Promise<string> {
    const token = await getAccessToken();
    if (!token) {
        emitAuthRequired();
        throw new AuthError();
    }
    const res = await fetch(apiUrl(path), {headers: {Authorization: `Bearer ${token}`, [API_VERSION_HEADER]: API_VERSION}});
    if (res.status === 401 && !retried) {
        const next = await refreshTokens();
        if (next) return apiFetchText(path, true);
        emitAuthRequired();
        throw new AuthError();
    }
    if (!res.ok) {
        if (res.status === 401) {
            emitAuthRequired();
            throw new AuthError();
        }
        throw new Error(res.statusText);
    }
    return res.text();
}

export async function exportOpml(): Promise<string> {
    return apiFetchText('/opml');
}

export interface OpmlImportResult {
    addedFeeds: number;
    addedFolders: number;
    subscribedFeeds: number;
    skippedFeeds: number;
    folders: Folder[];
    feeds: Feed[];
}

export async function importOpmlXml(xml: string): Promise<OpmlImportResult> {
    return apiFetch('/opml', {
        method: 'POST',
        body: JSON.stringify({xml}),
    }) as Promise<OpmlImportResult>;
}

// ---- front page ----

export interface FrontPageParams {
    since?: number | undefined;
    unreadOnly?: boolean | undefined;
    limit?: number | undefined;
}

export interface FrontPageJson {
    generatedAt: number;
    articles: Article[];
}

export async function fetchFrontPage(params: FrontPageParams = {}): Promise<FrontPageJson> {
    const q = new URLSearchParams();
    if (params.since) q.set('since', String(params.since));
    if (params.unreadOnly) q.set('unreadOnly', '1');
    if (params.limit) q.set('limit', String(params.limit));
    return apiFetch(`/front-page?${q}`) as Promise<FrontPageJson>;
}

// ---- server AI (admin provider setting; hidden when unavailable) ----

export interface ServerAiStatus {
    available: boolean;
    provider: string;
    model: string;
}

export async function aiStatus(): Promise<ServerAiStatus> {
    return apiFetch('/ai/status') as Promise<ServerAiStatus>;
}

export async function requestServerSummary(title: string | undefined, text: string, length: SummaryLength = 'standard'): Promise<{ summary: string }> {
    return apiFetch('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({title, text, length}),
    }) as Promise<{ summary: string }>;
}

// ---- migration ----

export interface MigratePayload {
    folders: Array<{ title: string; sortOrder?: number | undefined }>;
    feeds: Array<{ url: string; title?: string | undefined; siteUrl?: string | undefined; folderTitles?: string[] | undefined }>;
    states: Array<{ feedUrl: string; guid?: string | undefined; link?: string | undefined; read: boolean; readAt?: number | undefined; starred: boolean }>;
    affinity: Array<{ key: string; value: number }>;
}

export async function migrateLibrary(payload: MigratePayload): Promise<{ feedsAdded: number; foldersAdded: number; statesQueued: number }> {
    return apiFetch('/migrate/library', {
        method: 'POST',
        body: JSON.stringify(payload),
    }) as Promise<{ feedsAdded: number; foldersAdded: number; statesQueued: number }>;
}

// ---- editions (front page newspaper) ----

/** apiFetch twin that preserves the HTTP status so callers can map 404/429. */
export class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/** Thrown by buildEdition when the server answers 429 (build quota spent). */
export class QuotaError extends Error {
    constructor(message = 'Edition build quota reached — try again later.') {
        super(message);
        this.name = 'QuotaError';
    }
}

async function authedFetch(path: string, init?: RequestInit, retried = false): Promise<Response> {
    const token = await getAccessToken();
    if (!token) {
        emitAuthRequired();
        throw new AuthError();
    }
    const res = await fetch(apiUrl(path), withAuthHeaders(init, token));
    if (res.status === 401 && !retried) return retryFetchRaw(path, init);
    return res;
}

async function retryFetchRaw(path: string, init: RequestInit | undefined): Promise<Response> {
    const next = await refreshTokens();
    if (next) return authedFetch(path, init, true);
    emitAuthRequired();
    throw new AuthError();
}

async function apiFetchWithStatus(path: string, init?: RequestInit): Promise<unknown> {
    const res = await authedFetch(path, init);
    if (res.status === 401) {
        emitAuthRequired();
        throw new AuthError();
    }
    if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
    return res.json() as Promise<unknown>;
}

const EDITION_STATUSES: readonly string[] = ['ready', 'building', 'failed'];

function editionStatusOf(value: unknown): EditionStatus {
    return typeof value === 'string' && EDITION_STATUSES.includes(value) ? (value as EditionStatus) : 'failed';
}

function stringArrayOf(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Shape guard for server edition JSON. Missing sections become [], unknown
 * statuses become 'failed', so a half-formed payload renders an empty paper
 * instead of crashing the view.
 */
export function normalizeEditionJson(json: unknown): Edition {
    const o = (json ?? {}) as Record<string, unknown>;
    const rawSections = Array.isArray(o['sections']) ? o['sections'] : [];
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        generatedAt: typeof o['generatedAt'] === 'number' ? o['generatedAt'] : 0,
        windowHours: typeof o['windowHours'] === 'number' ? o['windowHours'] : 0,
        status: editionStatusOf(o['status']),
        ...(typeof o['model'] === 'string' ? {model: o['model']} : {}),
        ...(typeof o['opinion'] === 'string' ? {opinion: o['opinion']} : {}),
        sections: rawSections.map(normalizeSectionJson),
    };
}

function normalizeSectionJson(json: unknown): EditionSection {
    const o = (json ?? {}) as Record<string, unknown>;
    const scores = o['scores'] as Record<string, unknown> | undefined;
    const worthy = scores?.['worthy'];
    const interest = scores?.['interest'];
    const newness = scores?.['newness'];
    const popularity = scores?.['popularity'];
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        ...(typeof o['topic'] === 'string' ? {topic: o['topic']} : {}),
        title: typeof o['title'] === 'string' ? o['title'] : '(untitled)',
        ...(typeof o['summary'] === 'string' ? {summary: o['summary']} : {}),
        ...(typeof o['opinion'] === 'string' ? {opinion: o['opinion']} : {}),
        articleIds: stringArrayOf(o['articleIds']),
        ...(typeof worthy === 'number' && typeof interest === 'number'
            ? {
                scores: {
                    worthy,
                    interest,
                    ...(typeof newness === 'number' ? {newness} : {}),
                    ...(typeof popularity === 'number' ? {popularity} : {}),
                },
            }
            : {}),
        ...(typeof o['verified'] === 'boolean' ? {verified: o['verified']} : {}),
    };
}

export function normalizeEditionMeta(json: unknown): EditionMeta {
    const o = (json ?? {}) as Record<string, unknown>;
    return {
        id: typeof o['id'] === 'string' ? o['id'] : '',
        generatedAt: typeof o['generatedAt'] === 'number' ? o['generatedAt'] : 0,
        windowHours: typeof o['windowHours'] === 'number' ? o['windowHours'] : 0,
        status: editionStatusOf(o['status']),
    };
}

/** Latest generated edition, or null when none exists yet (404). */
export async function fetchLatestEdition(): Promise<Edition | null> {
    try {
        return normalizeEditionJson(await apiFetchWithStatus('/editions/latest'));
    } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
    }
}

/** One edition by id (used by the history switcher). */
export async function fetchEdition(id: string): Promise<Edition> {
    return normalizeEditionJson(await apiFetchWithStatus(`/editions/${encodeURIComponent(id)}`));
}

/** Recent edition metadata, newest first. */
export async function fetchEditions(limit = 10): Promise<EditionMeta[]> {
    const json = (await apiFetchWithStatus(`/editions?limit=${limit}`)) as { editions?: unknown } | unknown[];
    const list = Array.isArray(json) ? json : json.editions;
    if (!Array.isArray(list)) return [];
    return list.map(normalizeEditionMeta);
}

/** Queue a build over the last windowHours of articles. 429 → QuotaError. */
export async function buildEdition(windowHours: number, sectionCount: number): Promise<{ id: string; status: string }> {
    try {
        const json = (await apiFetchWithStatus(`/editions/build?windowHours=${windowHours}&sectionCount=${sectionCount}`, {
            method: 'POST',
        })) as { id?: unknown; status?: unknown };
        return {
            id: typeof json.id === 'string' ? json.id : '',
            status: typeof json.status === 'string' ? json.status : 'building',
        };
    } catch (err) {
        if (err instanceof ApiError && err.status === 429) throw new QuotaError();
        throw err;
    }
}
