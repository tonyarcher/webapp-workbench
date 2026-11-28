import { fetchClusterMembers, type ArticleCluster, type ClusterMember } from '../../services/api-clusters';
import { el } from './article-view-dom';

interface ClusterHost {
    articleId(): string | null;
    paint(): void;
    openMember(id: string): void;
}

/** Expansion and member loading for the open article's learned topic group. */
export class ArticleClusterState {
    cluster: ArticleCluster | null = null;
    members: ClusterMember[] = [];
    open = false;
    loading = false;
    private articleId: string | null = null;
    private readonly host: ClusterHost;

    constructor(host: ClusterHost) {
        this.host = host;
    }

    reset(cluster: ArticleCluster | null, articleId: string | null): void {
        this.cluster = cluster;
        this.articleId = articleId;
        this.members = [];
        this.open = false;
        this.loading = false;
    }

    openMember(id: string): void {
        this.host.openMember(id);
    }

    async toggle(): Promise<void> {
        if (!this.cluster) return;
        this.open = !this.open;
        this.host.paint();
        if (!this.open || this.loading) return;
        this.loading = true;
        this.host.paint();
        const clusterId = this.cluster.id;
        const articleId = this.articleId;
        try {
            const members = await fetchClusterMembers(clusterId);
            if (this.articleId !== articleId || this.host.articleId() !== articleId) return;
            this.members = members;
        } catch {
            if (this.articleId === articleId) this.members = [];
        } finally {
            if (this.articleId === articleId && this.host.articleId() === articleId) {
                this.loading = false;
                this.host.paint();
            }
        }
    }
}

/** Learned-topic line with an on-demand member list. */
export function buildClusterLine(state: ArticleClusterState): Node[] {
    const cluster = state.cluster;
    if (!cluster || cluster.memberCount < 2) return [];
    const section = el('section', 'topic-cluster');
    section.setAttribute('aria-label', 'Topic cluster');
    const button = el('button', 'topic-cluster-toggle', `${cluster.label} · ${cluster.memberCount} sources`);
    button.setAttribute('aria-expanded', String(state.open));
    button.addEventListener('click', () => void state.toggle());
    section.appendChild(button);
    if (state.loading) section.appendChild(el('p', 'cluster-status', 'Loading sources…'));
    if (state.open && !state.loading) {
        if (!state.members.length) section.appendChild(el('p', 'cluster-status', 'No other sources in your library.'));
        else {
            const list = el('ul', 'cluster-members');
            for (const member of state.members) {
                const item = el('li');
                const open = el('button', 'cluster-member', member.title);
                open.addEventListener('click', () => state.openMember(member.id));
                item.appendChild(open);
                list.appendChild(item);
            }
            section.appendChild(list);
        }
    }
    return [section];
}
