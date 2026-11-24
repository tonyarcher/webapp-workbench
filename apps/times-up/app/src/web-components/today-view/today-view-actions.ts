import type { Article, SavedArticleSnapshot } from '../../types';
import { toggleStar } from '../../mutations';
import { saveForLater, unsaveForLater } from '../../mutations-saved';
import { el, setBookmarkVisual, setStarVisual } from './today-view-dom';

export interface TodayActionsHost {
    articles: Article[];
    savedIds: Set<string>;
    root: HTMLDivElement | null;
    isConnected: boolean;
}

export function starButton(host: TodayActionsHost, article: Article, className = 'star'): HTMLElement {
    const button = el('button', className, article.starred ? '★' : '☆');
    button.type = 'button';
    button.dataset['articleId'] = article.id;
    button.setAttribute('aria-label', article.starred ? 'Unstar' : 'Star');
    button.addEventListener('click', (e) => onStar(host, e, article));
    return button;
}

export function bookmarkButton(host: TodayActionsHost, article: Article): HTMLElement {
    const button = el('button', 'bookmark-overlay');
    button.type = 'button';
    button.dataset['articleId'] = article.id;
    setBookmarkVisual(button, host.savedIds.has(article.id));
    button.addEventListener('click', (e) => void onBookmark(host, e, article));
    return button;
}

export function onStar(host: TodayActionsHost, e: Event, article: Article): void {
    e.stopPropagation();
    const button = e.currentTarget as HTMLButtonElement;
    const starred = !article.starred;
    article.starred = starred;
    setStarVisual(button, starred);
    void toggleStar(article.id, starred).then((ok) => {
        if (ok || !host.isConnected) return;
        article.starred = !starred;
        setStarVisual(button, !starred);
    });
    window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: article.id, starred } }));
}

export async function onBookmark(host: TodayActionsHost, e: Event, article: Article): Promise<void> {
    e.stopPropagation();
    const button = e.currentTarget as HTMLButtonElement;
    const saved = !host.savedIds.has(article.id);
    if (saved) host.savedIds.add(article.id);
    else host.savedIds.delete(article.id);
    setBookmarkVisual(button, saved);
    const ok = saved ? await saveForLater(article.id) : await unsaveForLater(article.id);
    if (ok || !host.isConnected) return;
    if (saved) host.savedIds.delete(article.id);
    else host.savedIds.add(article.id);
    setBookmarkVisual(button, !saved);
}

export function refreshBookmarks(host: TodayActionsHost, items: SavedArticleSnapshot[]): void {
    host.savedIds = new Set(items.map((item) => item.articleId).filter((id): id is string => Boolean(id)));
    for (const button of host.root?.querySelectorAll<HTMLButtonElement>('.bookmark-overlay') ?? []) {
        setBookmarkVisual(button, host.savedIds.has(button.dataset['articleId'] ?? ''));
    }
}

export function onArticleStarred(host: TodayActionsHost, e: Event): void {
    const { id, starred } = (e as CustomEvent<{ id: string; starred: boolean }>).detail;
    const article = host.articles.find((item) => item.id === id);
    if (article) article.starred = starred;
    const button = [...(host.root?.querySelectorAll<HTMLButtonElement>('.star') ?? [])].find(
        (item) => item.dataset['articleId'] === id,
    );
    if (button) setStarVisual(button, starred);
}
