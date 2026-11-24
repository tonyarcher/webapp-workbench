import { apiFetch } from './api-client';

/** Excerpt-only read for a row that scrolled into view. Never fetches a body. */
export async function fetchArticleExcerpt(articleId: string): Promise<string | null> {
    const res = (await apiFetch(`/articles/${encodeURIComponent(articleId)}/excerpt`)) as {
        excerpt?: string | null;
    };
    return typeof res.excerpt === 'string' ? res.excerpt : null;
}
