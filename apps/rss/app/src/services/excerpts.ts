/**
 * Client cache for list-depth excerpts. Rows ask for text only when they
 * scroll into view; the stored body has its own, explicitly opened endpoint.
 */
import { fetchArticleExcerpt } from './api-excerpts';
import { authEpoch } from './auth';

const cache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

/** Epoch in the key keeps one account's excerpts unreachable after sign-out. */
function cacheKey(articleId: string): string {
    return `${authEpoch()}:${articleId}`;
}

export function cachedArticleExcerpt(articleId: string): string | null | undefined {
    return cache.get(cacheKey(articleId));
}

/** Load once per article, coalescing repeated visible-row callbacks. */
export function loadArticleExcerpt(articleId: string): Promise<string | null> {
    const key = cacheKey(articleId);
    const cached = cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const job = fetchArticleExcerpt(articleId)
        .then((text) => {
            const value = text && text.trim() ? text : null;
            if (value) cache.set(key, value);
            return value;
        })
        .catch(() => null)
        .finally(() => inFlight.delete(key));
    inFlight.set(key, job);
    return job;
}

export function clearArticleExcerpts(): void {
    cache.clear();
}
