import { accrueEngagement } from '../../services/interesting-settings';
import { OPEN_READ_CAP, expandedReadWeight } from '../../services/engagement';

/** Open-article timing state. The shell owns one instance for its lifetime. */
export interface OpenTiming {
    openArticleId: string | null;
    openedAt: number;
}

export function initialOpenTiming(): OpenTiming {
    return { openArticleId: null, openedAt: 0 };
}

function bank(timing: OpenTiming, articleId: string, title: string, dismissed: boolean): void {
    const seconds = (Date.now() - timing.openedAt) / 1000;
    timing.openArticleId = null;
    timing.openedAt = 0;
    accrueEngagement(title, expandedReadWeight(seconds, dismissed), articleId, OPEN_READ_CAP, 'open');
}

/**
 * Start tracking an open article, banking the previous one as
 * not-dismissed: moving to the next story is still reading flow, so it
 * never counts as a bounce no matter how fast the reader moves.
 */
export function trackOpen(
    timing: OpenTiming,
    closing: { id: string; title: string } | null,
    opening: { id: string },
): void {
    if (closing && timing.openArticleId === closing.id && timing.openedAt > 0) {
        bank(timing, closing.id, closing.title, false);
    } else {
        timing.openArticleId = null;
        timing.openedAt = 0;
    }
    timing.openArticleId = opening.id;
    timing.openedAt = Date.now();
}

/**
 * Bank the open-to-close seconds into the learned map. Only an active
 * dismissal (Back, backdrop, Escape) can bounce; route changes just stop
 * the clock.
 */
export function endOpen(timing: OpenTiming, article: { id: string; title: string } | null, dismissed: boolean): void {
    if (!article || timing.openArticleId !== article.id || timing.openedAt <= 0) {
        timing.openArticleId = null;
        timing.openedAt = 0;
        return;
    }
    bank(timing, article.id, article.title, dismissed);
}
