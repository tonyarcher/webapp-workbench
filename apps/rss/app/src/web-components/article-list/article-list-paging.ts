import { fetchArticlesPage } from '../../services/api';
import { capItems, feedWindow, perFeedLimit } from '../../services/pagination';
import { filterMutedArticles, loadMuteRules, type FeedFolderLookup } from '../../services/mute-rules';
import { interleaveArticles } from '../../util';
import type { Article, ArticleSort, Feed, View } from '../../types';

function mergeSorted(current: Article[], incoming: Article[], sort: ArticleSort): Article[] {
    const seen = new Map(current.map((a) => [a.id, a]));
    for (const article of incoming) seen.set(article.id, article);
    const cmp =
        sort === 'hot'
            ? (a: Article, b: Article) => b.hot - a.hot || a.id.localeCompare(b.id)
            : sort === 'oldest'
              ? (a: Article, b: Article) => a.published - b.published || a.id.localeCompare(b.id)
              : (a: Article, b: Article) => b.published - a.published || a.id.localeCompare(b.id);
    return Array.from(seen.values()).sort(cmp);
}

function lookupFromFeeds(feeds: readonly Feed[] | undefined): FeedFolderLookup {
    const out: Record<string, readonly string[]> = {};
    for (const feed of feeds ?? []) out[feed.id] = feed.folderIds;
    return out;
}

interface FeedFetchContext {
    cursors: Map<string, string | undefined>;
    unreadOnly: boolean;
    hideRead: boolean;
    sort: ArticleSort;
    gen: number;
    currentGen: () => number;
}

async function fetchOneFeed(
    feed: Feed,
    perFeed: number,
    ctx: FeedFetchContext,
    pages: Map<string, Article[]>,
    lastHasMore: Map<string, boolean>,
): Promise<void> {
    const acc = pages.get(feed.id) ?? [];
    const res = await fetchArticlesPage({
        scope: `feed:${feed.id}`,
        unreadOnly: ctx.unreadOnly || ctx.hideRead,
        sort: ctx.sort,
        limit: perFeed,
        cursor: ctx.cursors.get(feed.id),
    });
    pages.set(feed.id, [...acc, ...res.items]);
    lastHasMore.set(feed.id, res.nextCursor !== undefined);
    if (res.nextCursor) ctx.cursors.set(feed.id, res.nextCursor);
}

async function fetchFeeds(
    targets: Feed[],
    perFeed: number,
    ctx: FeedFetchContext,
    pages: Map<string, Article[]>,
    lastHasMore: Map<string, boolean>,
) {
    for (let i = 0; i < targets.length; i += 12) {
        if (ctx.gen !== ctx.currentGen()) return;
        await Promise.all(targets.slice(i, i + 12).map((feed) => fetchOneFeed(feed, perFeed, ctx, pages, lastHasMore)));
    }
}

function pickKept(
    windowFeeds: Feed[],
    pages: Map<string, Article[]>,
    existingIds: Set<string>,
    sort: ArticleSort,
    pageSize: number,
    lookup: FeedFolderLookup,
): { kept: Article[]; mutedHidden: number } {
    const rules = loadMuteRules();
    const fresh = windowFeeds.flatMap((f) => (pages.get(f.id) ?? []).filter((a) => !existingIds.has(a.id)));
    const mutedHidden = fresh.length - filterMutedArticles(fresh, rules, lookup).length;
    const visiblePages = windowFeeds.map((f) =>
        filterMutedArticles(pages.get(f.id) ?? [], rules, lookup).filter((a) => !existingIds.has(a.id)),
    );
    const picked =
        sort === 'hot'
            ? interleaveArticles(visiblePages, pageSize)
            : mergeSorted([], visiblePages.flat(), sort).slice(0, pageSize);
    const seen = new Set<string>();
    const visible: Article[] = [];
    for (const a of picked) {
        if (existingIds.has(a.id) || seen.has(a.id)) continue;
        seen.add(a.id);
        visible.push(a);
        if (visible.length >= pageSize) break;
    }
    return { kept: visible, mutedHidden };
}

export async function fetchSinglePage(
    feedId: string | undefined,
    cursors: Map<string, string | undefined>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    items: Article[],
    lookup: FeedFolderLookup = {},
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string | undefined; mutedHidden: number }> {
    const key = feedId ?? 'all';
    const cursor = cursors.get(key);
    const scope = feedId ? `feed:${feedId}` : undefined;
    const res = await fetchArticlesPage({ scope, unreadOnly: unreadOnly || hideRead, sort, limit: pageSize, cursor });
    const next = res.nextCursor;
    const merged = capItems(mergeSorted(items, res.items, sort), pageSize);
    const nextItems = filterMutedArticles(merged, loadMuteRules(), lookup);
    return {
        items: nextItems,
        hasMore: next !== undefined,
        nextCursor: next,
        mutedHidden: merged.length - nextItems.length,
    };
}

export async function fetchFolderPage(
    folderKey: string,
    cursors: Map<string, string | undefined>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    items: Article[],
    lookup: FeedFolderLookup = {},
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string | undefined; mutedHidden: number }> {
    const cursor = cursors.get(folderKey);
    const res = await fetchArticlesPage({
        scope: folderKey,
        unreadOnly: unreadOnly || hideRead,
        sort,
        limit: pageSize,
        cursor,
    });
    const next = res.nextCursor;
    const merged = capItems(mergeSorted(items, res.items, sort), pageSize);
    const nextItems = filterMutedArticles(merged, loadMuteRules(), lookup);
    return {
        items: nextItems,
        hasMore: next !== undefined,
        nextCursor: next,
        mutedHidden: merged.length - nextItems.length,
    };
}

async function refillKept(
    windowFeeds: Feed[],
    ctx: FeedFetchContext,
    pages: Map<string, Article[]>,
    lastHasMore: Map<string, boolean>,
    pageSize: number,
    kept: Article[],
    existingIds: Set<string>,
    lookup: FeedFolderLookup,
): Promise<{ kept: Article[]; mutedHidden: number } | null> {
    let next = kept;
    let mutedHidden = 0;
    while (next.length < pageSize) {
        const more = windowFeeds.filter((f) => lastHasMore.get(f.id) === true);
        if (!more.length) break;
        const beforeCount = Array.from(pages.values()).reduce((sum, items) => sum + items.length, 0);
        const refillPerFeed = perFeedLimit(pageSize - next.length, more.length);
        await fetchFeeds(more, refillPerFeed, ctx, pages, lastHasMore);
        if (ctx.gen !== ctx.currentGen()) return null;
        const filled = pickKept(windowFeeds, pages, existingIds, ctx.sort, pageSize, lookup);
        mutedHidden = filled.mutedHidden;
        const afterCount = Array.from(pages.values()).reduce((sum, items) => sum + items.length, 0);
        if (filled.kept.length === next.length && afterCount === beforeCount) break;
        next = filled.kept;
    }
    if (mutedHidden === 0) {
        mutedHidden = pickKept(windowFeeds, pages, existingIds, ctx.sort, pageSize, lookup).mutedHidden;
    }
    return { kept: next, mutedHidden };
}

function finishFeedSetWindow(
    windowFeeds: Feed[],
    lastHasMore: Map<string, boolean>,
    kept: Article[],
    existingItems: Article[],
    sort: ArticleSort,
    pageSize: number,
    mutedHidden: number,
): { kept: Article[]; hasMoreEntries: Array<[string, boolean]>; items: Article[]; mutedHidden: number } {
    const hasMoreEntries = windowFeeds.map((f) => [f.id, lastHasMore.get(f.id) ?? false] as [string, boolean]);
    if (!kept.length) return { kept, hasMoreEntries, items: existingItems, mutedHidden };
    return {
        kept,
        hasMoreEntries,
        items: capItems(mergeSorted(existingItems, kept, sort), pageSize),
        mutedHidden,
    };
}

export async function fetchFeedSetWindow(
    windowFeeds: Feed[],
    cursors: Map<string, string | undefined>,
    _feedHasMore: Map<string, boolean>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    existingItems: Article[],
    gen: number,
    currentGen: () => number,
    lookup: FeedFolderLookup = {},
): Promise<{
    kept: Article[];
    hasMoreEntries: Array<[string, boolean]>;
    items: Article[];
    mutedHidden: number;
} | null> {
    const pages = new Map<string, Article[]>();
    const lastHasMore = new Map<string, boolean>();
    const perFeed = perFeedLimit(pageSize, windowFeeds.length);
    const ctx: FeedFetchContext = { cursors, unreadOnly, hideRead, sort, gen, currentGen };
    await fetchFeeds(windowFeeds, perFeed, ctx, pages, lastHasMore);
    if (gen !== currentGen()) return null;
    const existingIds = new Set(existingItems.map((a) => a.id));
    const initial = pickKept(windowFeeds, pages, existingIds, sort, pageSize, lookup);
    const refilled = await refillKept(
        windowFeeds,
        ctx,
        pages,
        lastHasMore,
        pageSize,
        initial.kept,
        existingIds,
        lookup,
    );
    if (refilled === null) return null;
    return finishFeedSetWindow(
        windowFeeds,
        lastHasMore,
        refilled.kept,
        existingItems,
        sort,
        pageSize,
        refilled.mutedHidden,
    );
}

export function getActiveFeeds(feeds: Feed[], feedHasMore: Map<string, boolean>): Feed[] {
    return feeds.filter((f) => feedHasMore.get(f.id) !== false);
}

export function nextWindow(feeds: Feed[], offset: number, pageSize: number): Feed[] {
    return feedWindow(feeds, offset, pageSize);
}

/** Paging state the load actions read and update on the component (`this as never`). */
export interface PageHost {
    view: View;
    sort: ArticleSort;
    unreadOnly: boolean;
    hideRead: boolean;
    pageSize: number;
    items: Article[];
    gen: number;
    hasMoreSingle: boolean;
    cursors: Map<string, string | undefined>;
    feedHasMore: Map<string, boolean>;
    feedWindowOffset: number;
    mutedHidden: number;
    library: { data?: { feeds: Feed[] } };
}

export async function loadSinglePageAction(host: PageHost, gen: number): Promise<void> {
    const feedId = host.view.kind === 'feed' ? host.view.id : undefined;
    const lookup = lookupFromFeeds(host.library.data?.feeds);
    if (host.view.kind === 'all' && host.sort === 'hot') {
        await loadFeedSetPageAction(host, host.library.data?.feeds ?? [], gen);
        return;
    }
    const res = await fetchSinglePage(
        feedId,
        host.cursors,
        host.unreadOnly,
        host.hideRead,
        host.sort,
        host.pageSize,
        host.items,
        lookup,
    );
    if (gen !== host.gen) return;
    host.hasMoreSingle = res.hasMore;
    host.items = res.items;
    host.mutedHidden = res.mutedHidden;
    if (res.nextCursor) host.cursors.set(feedId ?? 'all', res.nextCursor);
}

export async function loadFolderPageAction(host: PageHost, gen: number): Promise<void> {
    if (host.view.kind !== 'folder' && host.view.kind !== 'interesting') return;
    const key = `folder:${host.view.id}`;
    const lookup = lookupFromFeeds(host.library.data?.feeds);
    const res = await fetchFolderPage(
        key,
        host.cursors,
        host.unreadOnly,
        host.hideRead,
        host.sort,
        host.pageSize,
        host.items,
        lookup,
    );
    if (gen !== host.gen) return;
    host.hasMoreSingle = res.hasMore;
    host.items = res.items;
    host.mutedHidden = res.mutedHidden;
    if (res.nextCursor) host.cursors.set(key, res.nextCursor);
}

function applyHasMoreEntries(host: PageHost, entries: Array<[string, boolean]>): void {
    for (const [id, hasMore] of entries) host.feedHasMore.set(id, hasMore);
}

function fetchWindowForHost(host: PageHost, windowFeeds: Feed[], gen: number, lookup: FeedFolderLookup) {
    return fetchFeedSetWindow(
        windowFeeds,
        host.cursors,
        host.feedHasMore,
        host.unreadOnly,
        host.hideRead,
        host.sort,
        host.pageSize,
        host.items,
        gen,
        () => host.gen,
        lookup,
    );
}

async function stepFeedSetPage(
    host: PageHost,
    feeds: Feed[],
    gen: number,
    lookup: FeedFolderLookup,
    mutedHidden: number,
): Promise<{ done: boolean; mutedHidden: number }> {
    const active = getActiveFeeds(feeds, host.feedHasMore);
    if (!active.length) return { done: true, mutedHidden };
    const windowFeeds = nextWindow(active, host.feedWindowOffset, host.pageSize);
    host.feedWindowOffset += windowFeeds.length;
    const result = await fetchWindowForHost(host, windowFeeds, gen, lookup);
    if (!result || gen !== host.gen) return { done: true, mutedHidden };
    applyHasMoreEntries(host, result.hasMoreEntries);
    const nextHidden = mutedHidden + result.mutedHidden;
    if (result.kept.length) {
        host.items = result.items;
        host.mutedHidden = nextHidden;
        return { done: true, mutedHidden: nextHidden };
    }
    return { done: false, mutedHidden: nextHidden };
}

export async function loadFeedSetPageAction(host: PageHost, feeds: Feed[], gen: number): Promise<void> {
    const lookup = lookupFromFeeds(feeds);
    let mutedHidden = 0;
    while (true) {
        const step = await stepFeedSetPage(host, feeds, gen, lookup, mutedHidden);
        mutedHidden = step.mutedHidden;
        if (step.done) {
            if (gen === host.gen) host.mutedHidden = mutedHidden;
            return;
        }
    }
}
