import { markShownRead, markShownUnread } from '../../mutations';
import { consumeCatchUpUndo, peekCatchUpUndo, rememberCatchUpUndo, saveCatchUpBudget } from '../../services/catch-up';
import { toastInfo } from '../../services/toast';
import { readMinutes } from '../../util';
import type { Article, View } from '../../types';

export interface CatchUpHost {
    items: Article[];
    view: View;
    catchUpBudget: number;
    reset(): Promise<void>;
}

/** Rank unread by interest, then shortest read; keep what fits the budget. */
export function pickCatchUpKeep(unread: Article[], budget: number): Set<string> {
    const ranked = [...unread].sort((a, b) => {
        const ia = a.scores?.interest ?? 0;
        const ib = b.scores?.interest ?? 0;
        if (ib !== ia) return ib - ia;
        return readMinutes(a.content, a.summary) - readMinutes(b.content, b.summary);
    });
    let used = 0;
    const keep = new Set<string>();
    for (const a of ranked) {
        const m = readMinutes(a.content, a.summary) || 1;
        if (used + m <= budget) {
            used += m;
            keep.add(a.id);
        }
    }
    return keep;
}

/** Mark everything outside the budget as read, after the reader confirms. */
export async function runCatchUpAction(host: CatchUpHost): Promise<void> {
    const unread = host.items.filter((a) => a.read === 0);
    if (!unread.length) return;
    const keep = pickCatchUpKeep(unread, host.catchUpBudget);
    const markRead = unread.filter((a) => !keep.has(a.id)).map((a) => a.id);
    if (!markRead.length) return;
    if (
        !window.confirm(
            `Mark ${markRead.length} article${markRead.length === 1 ? '' : 's'} as read, keeping ${keep.size} for a ${host.catchUpBudget}-minute catch-up? You can undo this once.`,
        )
    )
        return;
    if (!(await markShownRead(markRead))) return;
    rememberCatchUpUndo(host.view, markRead);
    await host.reset();
    toastInfo(`${markRead.length} article${markRead.length === 1 ? '' : 's'} marked read. Undo is available.`);
}

export function setCatchUpBudget(host: Pick<CatchUpHost, 'view' | 'catchUpBudget'>, minutes: number): void {
    host.catchUpBudget = minutes;
    saveCatchUpBudget(host.view, minutes);
}

export function canUndoCatchUp(view: View): boolean {
    return peekCatchUpUndo(view) !== null;
}

export async function undoCatchUpAction(host: Pick<CatchUpHost, 'view' | 'reset'>): Promise<void> {
    const snapshot = peekCatchUpUndo(host.view);
    if (!snapshot) return;
    if (!(await markShownUnread([...snapshot.ids]))) return;
    consumeCatchUpUndo(host.view, snapshot.id);
    await host.reset();
    toastInfo('Catch-up undone');
}
