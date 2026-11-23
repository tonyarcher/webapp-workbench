import { fetchArticlesPage } from '../../services/api';
import { mergeStarredWordMap, selectInteresting } from '../../services/interesting-words';
import { loadInterestingStrictness, loadWordMap, loadWordMapIds } from '../../services/interesting-settings';
import { loadStarredTitles, type StarredSeed } from '../../services/interesting-starred';
import { isSignalEnabled } from '../../services/learning-signals';
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
 * Word map for ranking: the cache (every star toggle maintains it), every
 * like the server knows about (`starred` seeds, which is what keeps a folder
 * warm when its liked articles are older than the recent batch), plus fresh
 * weights for batch-starred articles the cache has not counted yet (e.g.
 * starred on another device). Likes are merged by word, so the same article
 * seen twice can never inflate the map.
 *
 * With star learning switched off the cached map is used as-is: the reader
 * keeps what stars taught before, but no like is newly folded in.
 */
export function interestingWordMapOf(
    batch: Article[],
    starred: ReadonlyArray<{ title: string }> = [],
): Record<string, number> {
    const cached = loadWordMap();
    if (!isSignalEnabled('star')) return cached;
    const counted = new Set(loadWordMapIds());
    const fresh = batch.filter((a) => a.starred && !counted.has(a.id));
    return mergeStarredWordMap(cached, [...starred, ...fresh]);
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
    // Interesting ranks recent articles by learned relevance. Server-side
    // unreadOnly filtering starves the candidate pool once items are read, so
    // always fetch the full recent batch and apply hide-read client-side.
    // Likes come from the cached global search in parallel: the model must see
    // older likes even when they fall outside this folder's recent batch.
    const [res, starred] = await Promise.all([
        fetchArticlesPage({
            scope: `folder:${host.view.id}`,
            sort: 'newest',
            limit: INTERESTING_BATCH,
            unreadOnly: false,
        }),
        loadStarredTitles().catch(() => [] as StarredSeed[]),
    ]);
    if (gen !== host.gen) return;
    const visible = res.items.filter((a) => a.read === 0);
    const lookup = lookupFromFeeds(host.library?.data?.feeds);
    const filtered = filterMutedArticles(visible, loadMuteRules(), lookup);
    host.mutedHidden = visible.length - filtered.length;
    const wordMap = interestingWordMapOf(filtered, starred);
    const strictness = host.interestingStrictness ?? loadInterestingStrictness(host.view.id);
    const selected = selectInteresting(filtered, wordMap, strictness);
    const ordered = sortInteresting(selected, host.sort);
    host.items = ordered.slice(0, host.pageSize);
    // The badge sits beside All (unread only), so count only unread rows even
    // though the ranking pool still holds read articles.
    saveInterestingCount(host.view.id, ordered.filter((a) => a.read === 0).length);
    host.hasMoreSingle = false;
    host.cursors.clear();
}
