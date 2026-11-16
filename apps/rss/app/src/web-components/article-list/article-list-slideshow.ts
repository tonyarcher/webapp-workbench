import {
    markArticleRead,
    markArticleUnread,
    noteOriginal,
    saveForLater,
    toggleStar,
    unsaveForLater,
} from '../../mutations';
import { fetchSavedArticlesList } from '../../query';
import { toastApiError } from '../../services/toast';
import { safeHttpUrl } from '../../services/parser';
import { isModalOpen } from '../../services/modal-guard';
import type { Article } from '../../types';
import { loadNextPageAction } from './article-list-loading';

export interface SlideshowHost {
    items: Article[];
    cursor: number;
    listView: string;
    slideshowIndex: number;
    slideshowAutoAdvance: boolean;
    slideshowSavedIds: Set<string>;
    slideshowAutoTimer: ReturnType<typeof setTimeout> | null;
    slideshowMarked: Set<string>;
    slideshowSuppressRead: Set<string>;
    active: boolean;
    loading: boolean;
    pageSize: number;
    requestUpdate(): void;
    isConnected: boolean;
}

export function clampSlideshowIndex(host: SlideshowHost): void {
    if (!host.items.length) {
        host.slideshowIndex = 0;
        return;
    }
    host.slideshowIndex = Math.max(0, Math.min(host.slideshowIndex, host.items.length - 1));
}

export function enterSlideshow(host: SlideshowHost): void {
    if (!host.items.length) {
        host.slideshowIndex = 0;
        return;
    }
    const start = host.cursor >= 0 && host.cursor < host.items.length ? host.cursor : 0;
    host.slideshowIndex = start;
    host.cursor = start;
    host.slideshowMarked.clear();
    host.slideshowSuppressRead.clear();
}

export function currentSlideshowArticle(host: SlideshowHost): Article | null {
    return host.items[host.slideshowIndex] ?? null;
}

export function slideshowGoTo(host: SlideshowHost, index: number): void {
    if (!host.items.length) return;
    host.slideshowIndex = Math.max(0, Math.min(index, host.items.length - 1));
    host.cursor = host.slideshowIndex;
    maybeLoadMoreForSlideshow(host);
    void markSlideshowRead(host, currentSlideshowArticle(host));
    scheduleSlideshowAuto(host);
}

export function slideshowNext(host: SlideshowHost): void {
    if (host.slideshowIndex < host.items.length - 1) slideshowGoTo(host, host.slideshowIndex + 1);
    else maybeLoadMoreForSlideshow(host);
}

export function slideshowPrev(host: SlideshowHost): void {
    if (host.slideshowIndex > 0) slideshowGoTo(host, host.slideshowIndex - 1);
}

export function maybeLoadMoreForSlideshow(host: SlideshowHost): void {
    if (host.loading) return;
    if (host.slideshowIndex >= host.items.length - 2) {
        void loadNextPageAction(host as never);
    }
}

export async function markSlideshowRead(host: SlideshowHost, article: Article | null): Promise<void> {
    if (
        !article ||
        article.read === 1 ||
        host.slideshowMarked.has(article.id) ||
        host.slideshowSuppressRead.has(article.id)
    )
        return;
    host.slideshowMarked.add(article.id);
    try {
        const ok = await markArticleRead(article.id);
        if (ok && host.isConnected) {
            host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: 1 } : a));
            window.dispatchEvent(new CustomEvent('article-read', { detail: { id: article.id, read: 1 } }));
        } else if (!ok) {
            host.slideshowMarked.delete(article.id);
        }
    } catch (err) {
        host.slideshowMarked.delete(article.id);
        toastApiError(err, 'Could not mark read.');
    }
}

export async function toggleSlideshowStar(host: SlideshowHost): Promise<void> {
    const article = currentSlideshowArticle(host);
    if (!article) return;
    const next = !article.starred;
    host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred: next } : a));
    const ok = await toggleStar(article.id, next);
    if (!ok) {
        host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred: !next } : a));
    } else {
        window.dispatchEvent(new CustomEvent('article-starred', { detail: { id: article.id, starred: next } }));
    }
}

export async function toggleSlideshowRead(host: SlideshowHost): Promise<void> {
    const article = currentSlideshowArticle(host);
    if (!article) return;
    const nextRead: 0 | 1 = article.read ? 0 : 1;
    if (nextRead === 0) {
        host.slideshowMarked.delete(article.id);
        host.slideshowSuppressRead.add(article.id);
    } else {
        host.slideshowSuppressRead.delete(article.id);
    }
    host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: nextRead } : a));
    const ok = nextRead === 1 ? await markArticleRead(article.id) : await markArticleUnread(article.id);
    if (!ok) {
        if (nextRead === 0) host.slideshowSuppressRead.delete(article.id);
        else host.slideshowMarked.delete(article.id);
        host.items = host.items.map((a) => (a.id === article.id ? { ...a, read: article.read } : a));
    } else {
        if (nextRead === 1) host.slideshowMarked.add(article.id);
        window.dispatchEvent(new CustomEvent('article-read', { detail: { id: article.id, read: nextRead } }));
    }
}

export async function refreshSlideshowSaved(host: SlideshowHost): Promise<void> {
    try {
        const items = await fetchSavedArticlesList();
        host.slideshowSavedIds = new Set(items.map((s) => s.articleId).filter((id): id is string => !!id));
        host.requestUpdate();
    } catch {
        // ignore
    }
}

export async function toggleSlideshowSave(host: SlideshowHost): Promise<void> {
    const article = currentSlideshowArticle(host);
    if (!article) return;
    const saved = host.slideshowSavedIds.has(article.id);
    const next = !saved;
    const ids = new Set(host.slideshowSavedIds);
    if (next) ids.add(article.id);
    else ids.delete(article.id);
    host.slideshowSavedIds = ids;
    const ok = next ? await saveForLater(article.id) : await unsaveForLater(article.id);
    if (!ok) {
        const revert = new Set(host.slideshowSavedIds);
        if (next) revert.delete(article.id);
        else revert.add(article.id);
        host.slideshowSavedIds = revert;
    }
    host.requestUpdate();
}

export function openSlideshowOriginal(article: Article | null): void {
    if (!article) return;
    noteOriginal(article.id, article.title);
    const link = safeHttpUrl(article.link);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
}

export function clearSlideshowAuto(host: SlideshowHost): void {
    if (host.slideshowAutoTimer !== null) {
        clearTimeout(host.slideshowAutoTimer);
        host.slideshowAutoTimer = null;
    }
}

export function scheduleSlideshowAuto(host: SlideshowHost): void {
    clearSlideshowAuto(host);
    if (!host.slideshowAutoAdvance || !host.isConnected || host.listView !== 'slideshow') return;
    if (host.slideshowIndex >= host.items.length - 1) return;
    host.slideshowAutoTimer = setTimeout(() => {
        host.slideshowAutoTimer = null;
        if (!host.isConnected || !host.slideshowAutoAdvance || host.listView !== 'slideshow') return;
        slideshowNext(host);
        host.requestUpdate();
    }, 12_000);
}

export function handleSlideshowWillUpdate(
    host: SlideshowHost & { cursor: number; loadViewSettings?: () => void },
    changed: Map<string, unknown>,
): void {
    if (changed.has('listView') && host.listView === 'slideshow') {
        enterSlideshow(host);
        void refreshSlideshowSaved(host);
    }
    if (changed.has('listView') && host.listView !== 'slideshow') {
        clearSlideshowAuto(host);
    }
    if (changed.has('items') && host.listView === 'slideshow') {
        clampSlideshowIndex(host);
    }
}

export function handleSlideshowUpdated(host: SlideshowHost, changed: Map<string, unknown>): void {
    if (host.listView !== 'slideshow') return;
    if (changed.has('items') || changed.has('slideshowIndex') || changed.has('listView') || changed.has('active')) {
        clampSlideshowIndex(host);
        maybeLoadMoreForSlideshow(host);
        if (host.active) void markSlideshowRead(host, currentSlideshowArticle(host));
        scheduleSlideshowAuto(host);
    }
}

export function handleSlideshowKeyDown(
    host: SlideshowHost & { requestUpdate(): void; cursor: number },
    e: KeyboardEvent,
    handleListKey: (h: never, e: KeyboardEvent) => void,
): boolean {
    if (host.listView !== 'slideshow' || !host.active) return false;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const target = (path[0] instanceof HTMLElement ? path[0] : e.target) as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
    if (isModalOpen()) return false;
    if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        slideshowNext(host);
        host.requestUpdate();
        return true;
    }
    if (e.key === 'k' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        slideshowPrev(host);
        host.requestUpdate();
        return true;
    }
    if (e.key === ' ' && !target?.closest?.('button,a,input,select,textarea,label')) {
        e.preventDefault();
        slideshowNext(host);
        host.requestUpdate();
        return true;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        host.cursor = host.slideshowIndex;
        (host as unknown as { setListView(v: string): void }).setListView('detailed');
        return true;
    }
    handleListKey(host as never, e);
    return true;
}
