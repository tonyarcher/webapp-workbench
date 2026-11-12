import { fetchArticlesPage } from '../../services/api';
import { buildWordMap, selectInteresting } from '../../services/interesting-words';
import { loadInterestingStrictness, loadWordMap, loadWordMapIds } from '../../services/interesting-settings';
import type { Article, View } from '../../types';

/** Bounded newest batch the ✨ Interesting folder view ranks at once. */
export const INTERESTING_BATCH = 200;

interface InterestingHost {
    view: View;
    items: Article[];
    unreadOnly: boolean;
    hideRead: boolean;
    pageSize: number;
    gen: number;
    hasMoreSingle: boolean;
    cursors: Map<string, string | undefined>;
    interestingStrictness?: number;
}

/** The ✨ view is its own route now, not a toolbar toggle on the folder. */
export function interestingActiveFor(view: View): boolean {
    return view.kind === 'interesting';
}

/**
 * Word map for ranking: the cache (every star toggle maintains it) plus
 * fresh weights for batch-starred articles the cache has not counted yet
 * (e.g. starred on another device). Counted ids are skipped so a star
 * visible in the batch never counts twice.
 */
export function interestingWordMapOf(batch: Article[]): Record<string, number> {
    const cached = loadWordMap();
    const counted = new Set(loadWordMapIds());
    const fresh = batch.filter((a) => a.starred && !counted.has(a.id));
    if (!fresh.length) return cached;
    const extra = buildWordMap(fresh, []);
    const merged: Record<string, number> = { ...cached };
    for (const [word, weight] of Object.entries(extra)) merged[word] = (merged[word] ?? 0) + weight;
    return merged;
}

/**
 * Interesting view: one bounded newest batch for the folder, ranked by
 * the learned word map and cut by the selectivity slider. The default
 * strictness keeps a bit over half of the positives plus an absolute
 * floor, so a broad map still hides something instead of showing all.
 * No cursors, no further paging — the batch is the whole list.
 * `toDecisionState` in interesting-words stays the documented
 * attach point if a server-side Jev ranking ever replaces this local one;
 * the key must stay server-side, so the browser never calls Jev directly.
 */
export async function loadInterestingBatchAction(host: InterestingHost, gen: number): Promise<void> {
    if (host.view.kind !== 'interesting') return;
    const res = await fetchArticlesPage({
        scope: `folder:${host.view.id}`,
        sort: 'newest',
        limit: INTERESTING_BATCH,
        unreadOnly: host.unreadOnly,
    });
    if (gen !== host.gen) return;
    const visible = host.hideRead ? res.items.filter((a) => a.read === 0) : res.items;
    const wordMap = interestingWordMapOf(visible);
    const strictness = host.interestingStrictness ?? loadInterestingStrictness(host.view.id);
    host.items = selectInteresting(visible, wordMap, strictness).slice(0, host.pageSize);
    host.hasMoreSingle = false;
    host.cursors.clear();
}
