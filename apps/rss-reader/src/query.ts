import {QueryClient, QueryObserver, type QueryObserverResult} from '@tanstack/query-core';
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import type {Article, Feed, Folder} from './types';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

export const libraryKey = ['library'] as const;
export type LibraryData = { folders: Folder[]; feeds: Feed[] };

export function articlesKey(params: {
    feedId?: string;
    unreadOnly?: boolean;
    sort?: 'hot' | 'newest' | 'oldest';
    cursor?: { key: number; id: string };
}) {
    return ['articles', params] as const;
}

export class QueryController<T = unknown> implements ReactiveController {
    result: QueryObserverResult<T, Error>;
    private host: ReactiveControllerHost;
    private getOptions: () => {
        queryKey: readonly unknown[];
        queryFn: () => Promise<T> | T;
    };
    private observer: QueryObserver<T, Error>;
    private unsubscribe?: () => void;
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
    return queryClient.invalidateQueries({queryKey: libraryKey});
}

export function invalidateArticles() {
    return queryClient.invalidateQueries({queryKey: ['articles']});
}
