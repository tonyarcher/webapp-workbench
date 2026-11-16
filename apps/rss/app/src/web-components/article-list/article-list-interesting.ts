import { fetchArticlesPage } from '../../services/api';
import { buildWordMap, selectInteresting } from '../../services/interesting-words';
import { loadInterestingStrictness, loadWordMap, loadWordMapIds } from '../../services/interesting-settings';
import { saveInterestingCount } from '../../services/interesting-counts';
import { filterMutedArticles, loadMuteRules, type FeedFolderLookup } from '../../services/mute-rules';
import type { Article, ArticleSort, Feed, View } from '../../types';

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
    mutedHidden: number;
    sort: ArticleSort;
    interestingStrictness?: number;
    library?: { data?: { feeds: Feed[] } };
}

function lookupFromFeeds(feeds: readonly Feed[] | undefined): FeedFolderLookup {
    const out: Record<string, readonly string[]> = {};
    for (const feed of feeds ?? []) out[feed.id] = feed.folderIds;
    return out;
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

function sortInteresting(items: Article[], sort: ArticleSort): Article[] {
    const out = [...items];
    if (sort === 'hot')
        return out.sort((a, b) => b.hot - a.hot || b.published - a.published || a.id.localeCompare(b.id));
    if (sort === 'oldest') return out.sort((a, b) => a.published - b.published || a.id.localeCompare(b.id));
    return out.sort((a, b) => b.published - a.published || a.id.localeCompare(b.id));
}

/**
 * Interesting view: filter a bounded recent batch by learned relevance
 * (selectivity/word map), then order the kept articles by the view sort.
 * Interestingness decides which articles qualify; `host.sort` decides their
 * display order. No cursors, no further paging — the batch is the whole list.
 * `toDecisionState` in interesting-words stays the documented attach point if
 * a server-side Jev ranking ever replaces this local one; the key must stay
 * server-side, so the browser never calls Jev directly.
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
    const lookup = lookupFromFeeds(host.library?.data?.feeds);
    const filtered = filterMutedArticles(visible, loadMuteRules(), lookup);
    host.mutedHidden = visible.length - filtered.length;
    const wordMap = interestingWordMapOf(filtered);
    const strictness = host.interestingStrictness ?? loadInterestingStrictness(host.view.id);
    const selected = selectInteresting(filtered, wordMap, strictness);
    const ordered = sortInteresting(selected, host.sort);
    host.items = ordered.slice(0, host.pageSize);
    // Badge is the whole visible set, not just the current page, so Mark shown
    // as read visibly lowers it instead of refilling to the page size.
    saveInterestingCount(host.view.id, ordered.length);
    host.hasMoreSingle = false;
    host.cursors.clear();
}
