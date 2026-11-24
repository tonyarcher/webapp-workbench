import { apiFetch } from './api-client';

/** A learned topic group. No article text is involved in this read. */
export interface ArticleCluster {
    id: string;
    label: string;
    memberCount: number;
}

/** Cluster for the open article, or null when it has no learned topic group. */
export async function fetchArticleCluster(articleId: string): Promise<ArticleCluster | null> {
    return (await apiFetch(`/articles/${encodeURIComponent(articleId)}/cluster`)) as ArticleCluster | null;
}
