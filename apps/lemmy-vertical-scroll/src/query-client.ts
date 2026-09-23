import { QueryClient } from '@tanstack/query-core';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false },
    },
});
