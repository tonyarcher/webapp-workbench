// (no query imports needed)
import { markAllRead, markReadBefore, markShownRead, toggleStar } from '../../mutations';
import type { Article, Feed, ListViewType, View } from '../../types';
import { listShortcut } from '../../services/shortcuts';
import { isModalOpen } from '../../services/modal-guard';

interface OpenHost {
    items: Article[];
    cursor: number;
    dispatchEvent(e: Event): boolean;
    library: { data?: { feeds: Feed[]; folders: unknown } };
}

export async function openArticleAction(host: OpenHost, article: Article) {
    const index = host.items.findIndex((a) => a.id === article.id);
    host.cursor = index;
    host.dispatchEvent(
        new CustomEvent('open-article', {
            detail: { article, index, items: host.items },
            bubbles: true,
            composed: true,
        }),
    );
}

export async function toggleStarAction(host: { items: Article[]; pendingStarIds?: Set<string> }, article: Article) {
    host.pendingStarIds ??= new Set<string>();
    if (host.pendingStarIds.has(article.id)) return;
    const current = host.items.find((a) => a.id === article.id) ?? article;
    const previous = current.starred;
    const starred = !previous;
    host.pendingStarIds.add(article.id);
    host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred } : a));
    try {
        if (!(await toggleStar(article.id, starred))) {
            host.items = host.items.map((a) => (a.id === article.id ? { ...a, starred: previous } : a));
        }
    } finally {
        host.pendingStarIds.delete(article.id);
    }
}

export async function markShownReadAction(host: { items: Article[]; hideRead: boolean; reset(): Promise<void> }) {
    const ids = host.items.filter((a) => a.read === 0).map((a) => a.id);
    if (!ids.length) return;
    const ok = await markShownRead(ids);
    if (!ok) return;
    host.hideRead = true;
    await host.reset();
}

export async function markBeforeAction(
    host: { view: View; hideRead: boolean; reset(): Promise<void>; folderFeeds(): Feed[] },
    cutoff: number | null,
) {
    if (cutoff === null) {
        if (host.view.kind === 'feed') await markAllRead(host.view.id);
        else if (host.view.kind === 'folder' || host.view.kind === 'interesting')
            for (const feed of host.folderFeeds()) await markAllRead(feed.id);
        else await markAllRead();
    } else {
        const feedIds =
            host.view.kind === 'feed'
                ? [host.view.id]
                : host.view.kind === 'folder' || host.view.kind === 'interesting'
                  ? host.folderFeeds().map((f) => f.id)
                  : undefined;
        await markReadBefore(feedIds, cutoff);
    }
    host.hideRead = true;
    await host.reset();
}

/** Refresh jobs (the per-view "elevator button") live in article-list-refresh.ts. */

interface CursorHost {
    active: boolean;
    items: Article[];
    cursor: number;
    openArticle(article: Article): Promise<void>;
}

function isKeyHandlingIgnored(e: KeyboardEvent, host: CursorHost): boolean {
    if (!host.active) return true;
    if (e.key !== 'j' && e.key !== 'k') return true;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (isModalOpen()) return true;
    if (!host.items.length) return true;
    return false;
}

function nextCursorIndex(key: string, cursor: number, length: number): number {
    return Math.max(0, Math.min(cursor + (key === 'j' ? 1 : -1), length - 1));
}

export function handleCursorKey(host: CursorHost, e: KeyboardEvent): void {
    if (isKeyHandlingIgnored(e, host)) return;
    e.preventDefault();
    const next = nextCursorIndex(e.key, host.cursor, host.items.length);
    host.cursor = next;
    const article = host.items[next];
    if (article) void host.openArticle(article);
}

/** Typing or an open modal dialog: shortcuts stay out of the way. Native
 * dialogs live in shadow roots where document queries cannot see them, so
 * open dialogs announce themselves through the modal guard instead. */
function isShortcutIgnored(e: KeyboardEvent): boolean {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return isModalOpen();
}

export interface ListKeyHost extends CursorHost {
    toggleStarCursor(): void;
    toggleUnread(): void;
    onRefresh(): Promise<unknown>;
    setListView(view: ListViewType): void;
    toggleSelectCursor(): void;
    showShortcuts(): void;
}

/** Single-key shortcuts for the list. j/k keep their cursor behavior. */
export function handleListKey(host: ListKeyHost, e: KeyboardEvent): void {
    if (!host.active) return;
    if (e.key === 'j' || e.key === 'k') {
        handleCursorKey(host, e);
        return;
    }
    if (isShortcutIgnored(e)) return;
    const action = listShortcut(e.key);
    if (action === null || !host.items.length) return;
    e.preventDefault();
    switch (action) {
        case 'star':
            host.toggleStarCursor();
            break;
        case 'unread':
            host.toggleUnread();
            break;
        case 'refresh':
            void host.onRefresh();
            break;
        case 'view-detailed':
            host.setListView('detailed');
            break;
        case 'view-headline':
            host.setListView('headline');
            break;
        case 'view-cards':
            host.setListView('cards');
            break;
        case 'view-slideshow':
            host.setListView('slideshow');
            break;
        case 'select':
            host.toggleSelectCursor();
            break;
        case 'help':
            host.showShortcuts();
            break;
    }
}
