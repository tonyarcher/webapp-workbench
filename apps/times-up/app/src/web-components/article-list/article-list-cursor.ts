import { toggleStarAction } from './article-list-actions';
import { rowClickAction, setAnchor, toggleSelectAction } from './article-list-selection';
import type { Article } from '../../types';

/**
 * Cursor-facing actions the component delegates to: row-click routing and the
 * cursor-key toggles. The j/k cursor walk itself is `handleCursorKey` in
 * article-list-actions.ts, next to the shortcut dispatch that calls it.
 */
interface CursorActionHost {
    items: Article[];
    cursor: number;
    openArticle(article: Article): Promise<void>;
}

export function onRowClickAction(host: CursorActionHost, e: MouseEvent, index: number): void {
    if (e.shiftKey) {
        rowClickAction(host as never, e, index);
        return;
    }
    setAnchor(host as never, index);
    const article = host.items[index];
    if (article) void host.openArticle(article);
}

export function toggleStarCursorAction(host: CursorActionHost): void {
    const article = host.items[host.cursor];
    if (article) void toggleStarAction(host as never, article);
}

export function toggleSelectCursorAction(host: CursorActionHost): void {
    if (host.cursor >= 0) toggleSelectAction(host as never, host.cursor);
}
