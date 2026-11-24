// Narrow client for lazily loaded snapshots. Lists never carry these bodies.
import { apiFetch } from './api-client';

export async function fetchSavedArticleContent(articleId: string): Promise<string | null> {
    const data = (await apiFetch(`/saved-articles/${encodeURIComponent(articleId)}/content`)) as {
        content?: string | null;
    };
    return data.content ?? null;
}
