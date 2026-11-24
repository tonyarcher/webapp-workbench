import { markShownRead } from '../../mutations';
import { readMinutes } from '../../util';
import type { Article } from '../../types';

/** Minute budget for one "catch me up" batch. */
const CATCH_UP_BUDGET_MIN = 5;

export interface CatchUpHost {
    items: Article[];
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
export async function catchMeUpAction(host: CatchUpHost): Promise<void> {
    const unread = host.items.filter((a) => a.read === 0);
    if (!unread.length) return;
    const keep = pickCatchUpKeep(unread, CATCH_UP_BUDGET_MIN);
    const markRead = unread.filter((a) => !keep.has(a.id)).map((a) => a.id);
    if (!markRead.length) return;
    if (
        !window.confirm(
            `Mark ${markRead.length} article${markRead.length === 1 ? '' : 's'} as read, keeping ${keep.size} for a ${CATCH_UP_BUDGET_MIN}-minute catch-up?`,
        )
    )
        return;
    await markShownRead(markRead);
}
