import { bulkStar, markShownRead, noteDerank } from '../../mutations';
import type { Article } from '../../types';

/** Selection, bulk actions, and mark-on-scroll. The element keeps the
 * reactive `selectedIds`; everything here mutates an explicit host. */

/** Ids of unread articles above `firstIndex`: what mark-on-scroll claims. */
export function unreadIdsBefore(items: Article[], firstIndex: number): string[] {
    return items
        .slice(0, Math.max(0, firstIndex))
        .filter((a) => a.read === 0)
        .map((a) => a.id);
}

interface MarkAboveHost {
    items: Article[];
    lastAutoMark: number;
    markOnScroll: boolean;
    listView: string;
    cols: number;
    virtualizer?: { getVirtualItems(): Array<{ index: number }> } | null;
}

/** First visible row index, cards-aware (rows hold `cols` articles). */
export function firstVisibleIndex(host: MarkAboveHost): number {
    const first = host.virtualizer?.getVirtualItems()[0]?.index;
    if (first === undefined) return 0;
    return host.listView === 'cards' ? first * Math.max(1, host.cols) : first;
}

/** Mark-on-scroll: everything scrolled past counts as read. */
export async function markAboveViewport(host: MarkAboveHost): Promise<void> {
    if (!host.markOnScroll) return;
    const first = firstVisibleIndex(host);
    if (first <= host.lastAutoMark) return;
    host.lastAutoMark = await markAboveAction(host, first);
}

interface ListHost {
    items: Article[];
    lastAutoMark: number;
}

interface SelectionHost extends ListHost {
    selectedIds: string[];
    selectAnchor: number;
    cursor: number;
}

export function setAnchor(host: SelectionHost, index: number): void {
    host.selectAnchor = index;
}

/** Ids currently selected, in list order. */
export function selectedItems(host: { items: Article[]; selectedIds: string[] }): Article[] {
    const ids = new Set(host.selectedIds);
    return host.items.filter((a) => ids.has(a.id));
}

export function toggleSelectAction(host: SelectionHost, index: number): void {
    const article = host.items[index];
    if (!article) return;
    const ids = new Set(host.selectedIds);
    if (ids.has(article.id)) ids.delete(article.id);
    else ids.add(article.id);
    host.selectedIds = [...ids];
    host.selectAnchor = index;
    host.cursor = index;
}

export function selectRangeAction(host: SelectionHost, index: number): void {
    let anchor = host.selectAnchor >= 0 ? host.selectAnchor : host.cursor;
    if (anchor < 0) anchor = index;
    const from = Math.max(0, Math.min(anchor, index));
    const ids = new Set(host.selectedIds);
    for (let i = from; i <= Math.max(anchor, index) && i < host.items.length; i++) {
        const id = host.items[i]?.id;
        if (id) ids.add(id);
    }
    host.selectedIds = [...ids];
    host.selectAnchor = index;
    host.cursor = index;
}

export function clearSelectionAction(host: SelectionHost): void {
    host.selectedIds = [];
    host.selectAnchor = -1;
}

export function rowClickAction(host: SelectionHost, e: MouseEvent, index: number): void {
    if (e.shiftKey) {
        e.preventDefault();
        selectRangeAction(host, index);
    }
}

export async function markAboveAction(host: ListHost, firstIndex: number): Promise<number> {
    // Advance only on a confirmed write: a failed write stays unclaimed so
    // the next scroll retries it instead of painting rows read that are not.
    if (firstIndex <= host.lastAutoMark) return host.lastAutoMark;
    const ids = unreadIdsBefore(host.items, firstIndex);
    if (!ids.length) {
        host.lastAutoMark = firstIndex;
        return host.lastAutoMark;
    }
    if (!(await markShownRead(ids))) return host.lastAutoMark;
    host.lastAutoMark = firstIndex;
    for (const id of ids) window.dispatchEvent(new CustomEvent('article-read', { detail: id }));
    return host.lastAutoMark;
}

export async function bulkMarkReadAction(host: SelectionHost & { clearSelection(): void }): Promise<void> {
    const ids = selectedItems(host).map((a) => a.id);
    if (!ids.length) return;
    // Keep the selection on failure so the reader can retry the same bulk action.
    if (!(await markShownRead(ids))) return;
    for (const id of ids) window.dispatchEvent(new CustomEvent('article-read', { detail: id }));
    host.clearSelection();
}

export async function bulkStarAction(
    host: SelectionHost & { clearSelection(): void; requestUpdate(): void },
): Promise<void> {
    const targets = selectedItems(host).map((a) => ({ id: a.id, title: a.title }));
    if (!targets.length) return;
    // Keep the selection on failure so the same bulk action can be retried.
    if (!(await bulkStar(targets))) return;
    const starred = new Set(targets.map((t) => t.id));
    host.items = host.items.map((a) => (starred.has(a.id) ? { ...a, starred: true } : a));
    host.requestUpdate();
    host.clearSelection();
}

export function bulkDerankAction(host: SelectionHost & { clearSelection(): void }): void {
    for (const item of selectedItems(host)) noteDerank(item.id, item.title, true);
    host.clearSelection();
}
