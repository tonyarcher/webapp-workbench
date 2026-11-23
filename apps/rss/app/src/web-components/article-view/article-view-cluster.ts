import type { ArticleCluster } from '../../services/api-clusters';
import { el } from './article-view-dom';

/** Small learned-topic line for the article panel. */
export function buildClusterLine(cluster: ArticleCluster | null): Node[] {
    if (!cluster || cluster.memberCount < 2) return [];
    const line = el('p', 'topic-cluster');
    line.setAttribute('aria-label', 'Topic cluster');
    line.appendChild(el('span', 'topic-cluster-label', cluster.label));
    line.appendChild(el('span', 'topic-cluster-count', `${cluster.memberCount} sources`));
    return [line];
}
