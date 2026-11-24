import type { Article, ArticleSort, ListViewType } from '../../types';

export interface ResumeHost {
    items: Article[];
    cursor: number;
    listView: ListViewType;
    cols: number;
    resumeApplied: boolean;
    resumeArticleId: string | null;
    deepLinkArticleId: string | null;
    openArticle(article: Article): Promise<void>;
    virtualizer: { scrollToIndex(index: number, options: { align: 'center' }): void } | null | undefined;
}

export function applyResumeAction(host: ResumeHost): void {
    if (host.resumeApplied) return;
    const targetId = host.deepLinkArticleId ?? host.resumeArticleId;
    if (targetId == null) return;
    const index = host.items.findIndex((article) => article.id === targetId);
    if (index < 0) return;
    host.resumeApplied = true;
    host.cursor = index;
    const target = host.listView === 'cards' ? Math.floor(index / Math.max(1, host.cols)) : index;
    host.virtualizer?.scrollToIndex(target, { align: 'center' });
    if (host.deepLinkArticleId) {
        const article = host.items[index];
        if (article) void host.openArticle(article);
    }
}

export function insertArticleForReveal(items: Article[], article: Article, sort: ArticleSort): Article[] {
    if (items.some((item) => item.id === article.id)) return items;
    const compare = (a: Article, b: Article): number =>
        sort === 'hot'
            ? b.hot - a.hot || a.id.localeCompare(b.id)
            : sort === 'oldest'
              ? a.published - b.published || a.id.localeCompare(b.id)
              : b.published - a.published || a.id.localeCompare(b.id);
    return [...items, article].sort(compare);
}

interface TargetHost {
    resumeApplied: boolean;
    resumeArticleId: string | null;
    deepLinkArticleId: string | null;
    deepLinkArticle: Article | null;
}

export function prepareArticleTarget(host: TargetHost, changed: Map<string, unknown>): void {
    if (!changed.has('resumeArticleId') && !changed.has('deepLinkArticleId')) return;
    host.resumeApplied = false;
    const targetId = host.deepLinkArticleId ?? host.resumeArticleId;
    if (host.deepLinkArticle && host.deepLinkArticle.id !== targetId) host.deepLinkArticle = null;
}

interface RevealHost extends TargetHost {
    items: Article[];
    sort: ArticleSort;
    requestUpdate(): void;
}

export function revealArticleAction(host: RevealHost, article: Article): void {
    host.deepLinkArticle = article;
    host.items = insertArticleForReveal(host.items, article, host.sort);
    host.resumeApplied = false;
    host.requestUpdate();
}
