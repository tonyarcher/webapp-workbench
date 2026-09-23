import { QueryClient } from '@tanstack/query-core';

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
    if (browserQueryClient === undefined) {
        browserQueryClient = new QueryClient({
            defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
        });
    }
    return browserQueryClient;
}
