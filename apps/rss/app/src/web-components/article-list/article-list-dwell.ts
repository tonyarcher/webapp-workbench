import { accrueEngagement } from '../../services/interesting-settings';
import {
    DWELL_CAP,
    DWELL_SECONDS_PER_STEP,
    DWELL_TICKS_PER_FLUSH,
    DWELL_TICK_MS,
    INPUT_IDLE_MS,
    dwellWeight,
} from '../../services/engagement';
import type { Article } from '../../types';

/**
 * Headline dwell with an active mouse, owned by the article list element.
 * Every pointer or wheel moment marks input and resolves the row (or card
 * row slice) under the pointer; a 5s tick then credits hovered articles
 * only while input is recent. The element starts the tracker on connect
 * and stops it (flushing first) on disconnect, so no timer outlives it.
 */
export class DwellTracker {
    private hover: Array<{ id: string; title: string }> = [];
    private pending = new Map<string, { seconds: number; title: string }>();
    private lastInputAt = 0;
    private timer: number | undefined;
    private ticks = 0;

    start(): void {
        this.stopTimer();
        this.timer = window.setInterval(this.onTick, DWELL_TICK_MS);
    }

    stop(): void {
        this.stopTimer();
        this.flush();
    }

    /** View changed: bank what the old view earned and forget its hover. */
    flushViewChange(): void {
        this.flush();
        this.hover = [];
    }

    /** Keyboard input counts as activity even without a pointer. */
    noteInput(): void {
        this.lastInputAt = Date.now();
    }

    trackEvent(e: Event, items: Article[], cols: number, root: { contains(node: Node | null): boolean } | null): void {
        this.lastInputAt = Date.now();
        this.hover = rowArticlesFromEvent(e, items, cols, root);
    }

    private stopTimer(): void {
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
    }

    private onTick = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - this.lastInputAt > INPUT_IDLE_MS) return;
        for (const hovered of this.hover) {
            const pending = this.pending.get(hovered.id) ?? { seconds: 0, title: hovered.title };
            pending.seconds += DWELL_TICK_MS / 1000;
            pending.title = hovered.title;
            this.pending.set(hovered.id, pending);
        }
        this.ticks += 1;
        if (this.ticks % DWELL_TICKS_PER_FLUSH === 0) this.flush();
    };

    /** Fold accrued dwell into the learned map, keeping the unpaid remainder. */
    private flush(): void {
        for (const [id, pending] of this.pending) {
            const weight = dwellWeight(pending.seconds);
            if (weight !== 0) {
                accrueEngagement(pending.title, weight, id, DWELL_CAP, 'dwell');
                pending.seconds = pending.seconds % DWELL_SECONDS_PER_STEP;
            }
            if (pending.seconds <= 0) this.pending.delete(id);
        }
    }
}

/** Articles under the event: one list row, or a card row's visible slice. */
function rowArticlesFromEvent(
    e: Event,
    items: Article[],
    cols: number,
    root: { contains(node: Node | null): boolean } | null,
): Array<{ id: string; title: string }> {
    const target = e.target as HTMLElement | null;
    const row = target?.closest?.('.row') ?? null;
    if (!row || !root?.contains(row)) return [];
    const indexAttr = row.getAttribute('data-index');
    if (indexAttr !== null) {
        const article = items[Number(indexAttr)];
        return article ? [{ id: article.id, title: article.title }] : [];
    }
    const rowAttr = row.getAttribute('data-row');
    if (rowAttr !== null) {
        const perRow = Math.max(1, cols);
        const start = Number(rowAttr) * perRow;
        return items.slice(start, start + perRow).map((a) => ({ id: a.id, title: a.title }));
    }
    return [];
}
