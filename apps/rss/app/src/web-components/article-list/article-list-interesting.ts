import { fetchArticlesPage } from '../../services/api';
import { buildWordMap, rankInteresting } from '../../services/interesting-words';
import { loadInterestingShadow, loadWordMap, loadWordMapIds } from '../../services/interesting-settings';
import type { Article, View } from '../../types';

/** Bounded newest batch the ✨ Interesting folder filter ranks at once. */
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
}

/** The ✨ filter is offered only on folders opted into the shadow setting. */
export function shadowEnabledFor(view: View): boolean {
    if (view.kind !== 'folder') return false;
    return loadInterestingShadow()[view.id] === true;
}

export function interestingActiveFor(view: View, interestingOnly: boolean): boolean {
    return interestingOnly && shadowEnabledFor(view);
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
 * Interesting filter: one bounded newest batch for the folder, ranked by
 * the learned word map. No cursors, no further paging — the batch is the
 * whole list until the filter toggles off.
 */
export async function loadInterestingBatchAction(host: InterestingHost, gen: number): Promise<void> {
    if (host.view.kind !== 'folder') return;
    const res = await fetchArticlesPage({
        scope: `folder:${host.view.id}`,
        sort: 'newest',
        limit: INTERESTING_BATCH,
        unreadOnly: host.unreadOnly,
    });
    if (gen !== host.gen) return;
    const visible = host.hideRead ? res.items.filter((a) => a.read === 0) : res.items;
    host.items = rankInteresting(visible, interestingWordMapOf(visible)).slice(0, host.pageSize);
    host.hasMoreSingle = false;
    host.cursors.clear();
}
