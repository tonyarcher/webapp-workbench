import { fetchArticlesPage } from '../../services/api';
import { capItems, feedWindow, perFeedLimit } from '../../services/pagination';
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
): Article[] {
    const picked =
        sort === 'hot'
            ? interleaveArticles(
                  windowFeeds.map((f) => pages.get(f.id) ?? []),
                  pageSize,
              )
            : mergeSorted(
                  [],
                  windowFeeds.flatMap((f) => pages.get(f.id) ?? []),
                  sort,
              ).slice(0, pageSize);
    return picked.filter((a) => !existingIds.has(a.id));
}

export async function fetchSinglePage(
    feedId: string | undefined,
    cursors: Map<string, string | undefined>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    items: Article[],
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string | undefined }> {
    const key = feedId ?? 'all';
    const cursor = cursors.get(key);
    const scope = feedId ? `feed:${feedId}` : undefined;
    const res = await fetchArticlesPage({ scope, unreadOnly: unreadOnly || hideRead, sort, limit: pageSize, cursor });
    const next = res.nextCursor;
    const nextItems = capItems(mergeSorted(items, res.items, sort), pageSize);
    return { items: nextItems, hasMore: next !== undefined, nextCursor: next };
}

export async function fetchFolderPage(
    folderKey: string,
    cursors: Map<string, string | undefined>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    items: Article[],
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string | undefined }> {
    const cursor = cursors.get(folderKey);
    const res = await fetchArticlesPage({
        scope: folderKey,
        unreadOnly: unreadOnly || hideRead,
        sort,
        limit: pageSize,
        cursor,
    });
    const next = res.nextCursor;
    const nextItems = capItems(mergeSorted(items, res.items, sort), pageSize);
    return { items: nextItems, hasMore: next !== undefined, nextCursor: next };
}

async function refillKept(
    windowFeeds: Feed[],
    ctx: FeedFetchContext,
    pages: Map<string, Article[]>,
    lastHasMore: Map<string, boolean>,
    pageSize: number,
    kept: Article[],
    existingIds: Set<string>,
): Promise<Article[] | null> {
    let next = kept;
    if (next.length < pageSize) {
        const more = windowFeeds.filter((f) => lastHasMore.get(f.id) === true);
        if (more.length) {
            const refillPerFeed = perFeedLimit(pageSize - next.length, more.length);
            await fetchFeeds(more, refillPerFeed, ctx, pages, lastHasMore);
            if (ctx.gen !== ctx.currentGen()) return null;
            next = pickKept(windowFeeds, pages, existingIds, ctx.sort, pageSize);
        }
    }
    return next;
}

function finishFeedSetWindow(
    windowFeeds: Feed[],
    lastHasMore: Map<string, boolean>,
    kept: Article[],
    existingItems: Article[],
    sort: ArticleSort,
    pageSize: number,
): { kept: Article[]; hasMoreEntries: Array<[string, boolean]>; items: Article[] } {
    const hasMoreEntries = windowFeeds.map((f) => [f.id, lastHasMore.get(f.id) ?? false] as [string, boolean]);
    if (!kept.length) return { kept, hasMoreEntries, items: existingItems };
    return { kept, hasMoreEntries, items: capItems(mergeSorted(existingItems, kept, sort), pageSize) };
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
): Promise<{ kept: Article[]; hasMoreEntries: Array<[string, boolean]>; items: Article[] } | null> {
    const pages = new Map<string, Article[]>();
    const lastHasMore = new Map<string, boolean>();
    const perFeed = perFeedLimit(pageSize, windowFeeds.length);
    const ctx: FeedFetchContext = { cursors, unreadOnly, hideRead, sort, gen, currentGen };
    await fetchFeeds(windowFeeds, perFeed, ctx, pages, lastHasMore);
    if (gen !== currentGen()) return null;
    const existingIds = new Set(existingItems.map((a) => a.id));
    const initial = pickKept(windowFeeds, pages, existingIds, sort, pageSize);
    const kept = await refillKept(windowFeeds, ctx, pages, lastHasMore, pageSize, initial, existingIds);
    if (kept === null) return null;
    return finishFeedSetWindow(windowFeeds, lastHasMore, kept, existingItems, sort, pageSize);
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
    library: { data?: { feeds: Feed[] } };
}

export async function loadSinglePageAction(host: PageHost, gen: number): Promise<void> {
    const feedId = host.view.kind === 'feed' ? host.view.id : undefined;
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
    );
    if (gen !== host.gen) return;
    host.hasMoreSingle = res.hasMore;
    host.items = res.items;
    if (res.nextCursor) host.cursors.set(feedId ?? 'all', res.nextCursor);
}

export async function loadFolderPageAction(host: PageHost, gen: number): Promise<void> {
    if (host.view.kind !== 'folder') return;
    const key = `folder:${host.view.id}`;
    const res = await fetchFolderPage(
        key,
        host.cursors,
        host.unreadOnly,
        host.hideRead,
        host.sort,
        host.pageSize,
        host.items,
    );
    if (gen !== host.gen) return;
    host.hasMoreSingle = res.hasMore;
    host.items = res.items;
    if (res.nextCursor) host.cursors.set(key, res.nextCursor);
}

function applyHasMoreEntries(host: PageHost, entries: Array<[string, boolean]>): void {
    for (const [id, hasMore] of entries) host.feedHasMore.set(id, hasMore);
}

function fetchWindowForHost(host: PageHost, windowFeeds: Feed[], gen: number) {
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
    );
}

async function stepFeedSetPage(host: PageHost, feeds: Feed[], gen: number): Promise<boolean> {
    const active = getActiveFeeds(feeds, host.feedHasMore);
    if (!active.length) return true;
    const windowFeeds = nextWindow(active, host.feedWindowOffset, host.pageSize);
    host.feedWindowOffset += windowFeeds.length;
    const result = await fetchWindowForHost(host, windowFeeds, gen);
    if (!result || gen !== host.gen) return true;
    applyHasMoreEntries(host, result.hasMoreEntries);
    if (result.kept.length) {
        host.items = result.items;
        return true;
    }
    return false;
}

export async function loadFeedSetPageAction(host: PageHost, feeds: Feed[], gen: number): Promise<void> {
    while (true) {
        if (await stepFeedSetPage(host, feeds, gen)) return;
    }
}
