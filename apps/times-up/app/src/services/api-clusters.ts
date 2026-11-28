import { apiFetch } from './api-client';

/** A learned topic group. No article text is involved in this read. */
export interface ArticleCluster {
    id: string;
    label: string;
    memberCount: number;
}

export interface ClusterMember {
    id: string;
    title: string;
    feedId: string;
    publishedAt: number;
}

/** Cluster for the open article, or null when it has no learned topic group. */
export async function fetchArticleCluster(articleId: string): Promise<ArticleCluster | null> {
    return (await apiFetch(`/articles/${encodeURIComponent(articleId)}/cluster`)) as ArticleCluster | null;
}

export function parseClusterMembers(value: unknown): ClusterMember[] {
    const items = (value as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return [];
    return items.filter(
        (item): item is ClusterMember =>
            !!item &&
            typeof item === 'object' &&
            typeof (item as ClusterMember).id === 'string' &&
            typeof (item as ClusterMember).title === 'string' &&
            typeof (item as ClusterMember).feedId === 'string' &&
            typeof (item as ClusterMember).publishedAt === 'number',
    );
}

/** Member summaries for one learned topic cluster, owned by the current reader. */
export async function fetchClusterMembers(clusterId: string): Promise<ClusterMember[]> {
    return parseClusterMembers(await apiFetch(`/clusters/${encodeURIComponent(clusterId)}/members`));
}
