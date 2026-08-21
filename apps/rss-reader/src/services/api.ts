import type {Article, Feed, Folder} from '../types';

// ---- base fetch ----

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

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
    const url = apiUrl(path);
    const headers: Record<string, string> = {...(init?.headers as Record<string, string> ?? {})};
    if (init?.body && typeof init.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {...init, headers});
    if (!res.ok) {
        let message = res.statusText;
        try {
            const body = await res.json() as { error?: string };
            if (body.error) message = body.error;
        } catch {
            // ignore
        }
        throw new Error(message);
    }
    return res.json() as Promise<unknown>;
}

// ---- library ----

export async function getLibrary(): Promise<{ folders: Folder[]; feeds: Feed[] }> {
    return apiFetch('/library') as Promise<{ folders: Folder[]; feeds: Feed[] }>;
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
    scope?: string;
    unreadOnly?: boolean;
    sort?: 'hot' | 'newest' | 'oldest';
    cursor?: string;
    limit?: number;
    since?: number;
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

export async function exportOpml(): Promise<string> {
    const url = apiUrl('/opml');
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    return res.text();
}

export async function importOpmlXml(xml: string): Promise<{ addedFeeds: number; addedFolders: number }> {
    return apiFetch('/opml', {
        method: 'POST',
        body: JSON.stringify({xml}),
    }) as Promise<{ addedFeeds: number; addedFolders: number }>;
}

// ---- migration ----

export interface MigratePayload {
    folders: Array<{ title: string; sortOrder?: number }>;
    feeds: Array<{ url: string; title?: string; siteUrl?: string; folderTitles?: string[] }>;
    states: Array<{ feedUrl: string; guid?: string; link?: string; read: boolean; readAt?: number; starred: boolean }>;
    affinity: Array<{ key: string; value: number }>;
}

export async function migrateLibrary(payload: MigratePayload): Promise<{ feedsAdded: number; foldersAdded: number; statesQueued: number }> {
    return apiFetch('/migrate/library', {
        method: 'POST',
        body: JSON.stringify(payload),
    }) as Promise<{ feedsAdded: number; foldersAdded: number; statesQueued: number }>;
}
