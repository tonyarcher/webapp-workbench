import { loadArticleExcerpt } from '../../services/excerpts';

/** Owned by the list element; observing stops when that element disconnects. */
export function createRowExcerptObserver(host: RowExcerptHost, root: HTMLElement): IntersectionObserver | null {
    if (typeof IntersectionObserver === 'undefined') return null;
    let observer: IntersectionObserver | null = null;
    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer?.unobserve(entry.target);
                const id = (entry.target as HTMLElement).dataset['articleId'];
                if (id) loadRowExcerpt(host, id);
            }
        },
        { root, rootMargin: '120px' },
    );
    return observer;
}

export interface RowExcerptHost {
    isConnected: boolean;
    rowExcerpts: Record<string, string | null>;
    rowExcerptPending: Set<string>;
    requestUpdate(): void;
}

/** Load the excerpt once per visible row, coalescing repeated observer hits. */
export function loadRowExcerpt(host: RowExcerptHost, articleId: string): void {
    if (host.rowExcerpts[articleId] !== undefined || host.rowExcerptPending.has(articleId)) return;
    host.rowExcerptPending.add(articleId);
    void loadArticleExcerpt(articleId).then((text) => {
        host.rowExcerptPending.delete(articleId);
        if (!host.isConnected) return;
        host.rowExcerpts = { ...host.rowExcerpts, [articleId]: text };
        host.requestUpdate();
    });
}

/** Virtual rows are rebuilt on paint, so watch the new nodes each time. */
export function observeVisibleRows(observer: IntersectionObserver | null, root: HTMLElement): void {
    if (!observer) return;
    // Virtual rows are replaced on paint. Drop the old targets so the observer
    // does not keep detached rows alive across a long scroll.
    observer.disconnect();
    for (const node of root.querySelectorAll<HTMLElement>('[data-article-id]')) observer.observe(node);
}
