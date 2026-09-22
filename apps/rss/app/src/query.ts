import {QueryClient, QueryObserver, type QueryObserverResult} from '@tanstack/query-core';
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {getLibraryCounts, getLibraryFeeds, getLibraryFolders} from './services/api';
import type {Article, Feed, Folder} from './types';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            // The server is the source of truth and mutates outside any
            // client event (poller ingests), so counts must refresh when
            // the user returns to the tab.
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});

export const libraryKey = ['library'] as const;
export type LibraryData = { folders: Folder[]; feeds: Feed[] };

/**
 * Badges tolerate staleness (the counts aggregate scans the articles table),
 * so background refetches reuse counts younger than this. Mutations that
 * change read state call bustCounts() first so the next refetch is exact.
 * Refresh-triggered badge changes converge on this window too: each feed is
 * re-ingested on its own backoff schedule, so exactness was never instant.
 */
export const COUNTS_STALE_MS = 5 * 60_000;
let lastCountsAt = 0;
let fetchSeq = 0;

export function bustCounts(): void {
    lastCountsAt = 0;
    fetchSeq += 1;
}

const cachedLibrary = () => queryClient.getQueryData(libraryKey) as LibraryData | undefined;

/**
 * Library fetch in three stages so the sidebar paints progressively: folders
 * first, feed names next (keeping previously seen badge counts so the 60s
 * refetch does not flash badges to zero), unread badges merged after.
 * Contract: a stage that fails resolves with whatever painted so far, except
 * when no feeds have painted yet — then it rejects so the Retry banner
 * appears. Once a non-empty feed list has painted, later failures resolve
 * with it. Overlapping fetches resolve last-starter-wins: a superseded
 * response paints nothing.
 */
export async function fetchLibrary(): Promise<LibraryData> {
    const prev = cachedLibrary();
    const prevUnread = new Map((prev?.feeds ?? []).map((f) => [f.id, f.unread] as const));
    // Last starter wins: a newer fetch or a mark (via bustCounts) supersedes
    // this one, so a late response can neither overwrite fresher badges nor
    // re-arm the counts throttle.
    const mySeq = ++fetchSeq;
    const ctx: FetchCtx = {prev, prevUnread, superseded: () => mySeq !== fetchSeq};
    const first = await fetchFoldersStage(ctx);
    if ('reuse' in first) return first.reuse;
    const paintedFolders: LibraryData = {folders: first.folders, feeds: prev?.feeds ?? []};
    if (ctx.superseded()) return cachedLibrary() ?? paintedFolders;
    queryClient.setQueryData(libraryKey, paintedFolders);
    return fetchFeedsStage(ctx, first.folders, paintedFolders);
}

interface FetchCtx {
    prev: LibraryData | undefined;
    prevUnread: Map<string, number>;
    superseded: () => boolean;
}

async function fetchFoldersStage(ctx: FetchCtx): Promise<{ folders: Folder[] } | { reuse: LibraryData }> {
    try {
        return {folders: (await getLibraryFolders()).folders};
    } catch (err) {
        if (!ctx.prev) throw err;
        return {reuse: ctx.prev};
    }
}

async function fetchFeedsStage(ctx: FetchCtx, folders: Folder[], paintedFolders: LibraryData): Promise<LibraryData> {
    const hadFeeds = (ctx.prev?.feeds.length ?? 0) > 0;
    try {
        const {feeds} = await getLibraryFeeds();
        if (ctx.superseded()) return cachedLibrary() ?? paintedFolders;
        const paintedFeeds: LibraryData = {
            folders,
            feeds: feeds.map((f) => ({...f, unread: ctx.prevUnread.get(f.id) ?? 0})),
        };
        queryClient.setQueryData(libraryKey, paintedFeeds);
        if (Date.now() - lastCountsAt < COUNTS_STALE_MS) return paintedFeeds;
        return fetchCountsStage(ctx, folders, paintedFeeds);
    } catch (err) {
        if (!hadFeeds) throw err;
        return paintedFolders;
    }
}

async function fetchCountsStage(ctx: FetchCtx, folders: Folder[], paintedFeeds: LibraryData): Promise<LibraryData> {
    try {
        const {counts} = await getLibraryCounts();
        if (ctx.superseded()) return cachedLibrary() ?? paintedFeeds;
        lastCountsAt = Date.now();
        const merged: LibraryData = {
            folders,
            feeds: paintedFeeds.feeds.map((f) => ({...f, unread: counts[f.id] ?? 0})),
        };
        queryClient.setQueryData(libraryKey, merged);
        return merged;
    } catch {
        return paintedFeeds;
    }
}

export function articlesKey(params: {
    feedId?: string;
    unreadOnly?: boolean;
    sort?: 'hot' | 'newest' | 'oldest';
    cursor?: string;
}) {
    return ['articles', params] as const;
}

export function frontPageKey(params: {
    since?: number;
    unreadOnly?: boolean;
    limit?: number;
    edition?: string;
}) {
    return ['front-page', params] as const;
}

export class QueryController<T = unknown> implements ReactiveController {
    result: QueryObserverResult<T, Error>;
    private host: ReactiveControllerHost;
    private getOptions: () => {
        queryKey: readonly unknown[];
        queryFn: () => Promise<T> | T;
    };
    private observer: QueryObserver<T, Error>;
    private unsubscribe: (() => void) | undefined;
    private lastKey = '';

    constructor(
        host: ReactiveControllerHost,
        getOptions: () => {
            queryKey: readonly unknown[];
            queryFn: () => Promise<T> | T;
        },
    ) {
        this.host = host;
        this.getOptions = getOptions;
        const options = getOptions();
        this.observer = new QueryObserver(queryClient, options as never);
        this.result = this.observer.getCurrentResult();
        host.addController(this);
    }

    get data(): T | undefined {
        return this.result.data;
    }

    get error(): Error | undefined {
        return this.result.error ?? undefined;
    }

    hostConnected() {
        this.unsubscribe = this.observer.subscribe((result) => {
            this.result = result as QueryObserverResult<T, Error>;
            this.host.requestUpdate();
        });
    }

    hostDisconnected() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    hostUpdate() {
        const options = this.getOptions();
        const key = JSON.stringify(options.queryKey);
        if (key !== this.lastKey) {
            this.lastKey = key;
            this.observer.setOptions(options as never);
            this.result = this.observer.getCurrentResult();
        }
    }
}

export function updateArticlesInCache(articleId: string, patch: Partial<Article>) {
    for (const query of queryClient.getQueryCache().findAll({queryKey: ['articles']})) {
        const data = query.state.data as { items: Article[] } | undefined;
        if (!data?.items) continue;
        const next = data.items.map((a) => (a.id === articleId ? {...a, ...patch} : a));
        if (next !== data.items) {
            queryClient.setQueryData(query.queryKey, {...data, items: next});
        }
    }
}

export function invalidateLibrary() {
    // Cancel first: on a cold cache TanStack joins an in-flight fetch instead
    // of restarting it, which would strand a bust-superseded queryFn with no
    // replacement. Canceled fetches fail their generation checks and paint
    // nothing; the invalidate below always starts a fresh one.
    return (async () => {
        await queryClient.cancelQueries({queryKey: libraryKey});
        return queryClient.invalidateQueries({queryKey: libraryKey});
    })();
}

export function invalidateArticles() {
    return queryClient.invalidateQueries({queryKey: ['articles']});
}

export function invalidateFrontPage() {
    return queryClient.invalidateQueries({queryKey: ['front-page']});
}

export function editionKey(params: { id?: string } = {}) {
    return ['edition', params] as const;
}

export function editionsKey(params: { limit?: number } = {}) {
    return ['editions', params] as const;
}

export function invalidateEdition() {
    return Promise.all([
        queryClient.invalidateQueries({queryKey: ['edition']}),
        queryClient.invalidateQueries({queryKey: ['editions']}),
    ]);
}
