import {fetchArticlesPage} from '../../services/api';
import {capItems, feedWindow, perFeedLimit} from '../../services/pagination';
import {interleaveArticles} from '../../util';
import type {Article, ArticleSort, Feed} from '../../types';

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

async function fetchFeeds(targets: Feed[], perFeed: number, cursors: Map<string, string | undefined>, unreadOnly: boolean, hideRead: boolean, sort: ArticleSort, gen: number, currentGen: () => number, pages: Map<string, Article[]>, lastHasMore: Map<string, boolean>) {
    for (let i = 0; i < targets.length; i += 12) {
        if (gen !== currentGen()) return;
        await Promise.all(targets.slice(i, i + 12).map(async (feed) => {
            const acc = pages.get(feed.id) ?? [];
            const res = await fetchArticlesPage({scope: `feed:${feed.id}`, unreadOnly: unreadOnly || hideRead, sort, limit: perFeed, cursor: cursors.get(feed.id)});
            pages.set(feed.id, [...acc, ...res.items]);
            lastHasMore.set(feed.id, res.nextCursor !== undefined);
            if (res.nextCursor) cursors.set(feed.id, res.nextCursor);
        }));
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
            ? interleaveArticles(windowFeeds.map((f) => pages.get(f.id) ?? []), pageSize)
            : mergeSorted([], windowFeeds.flatMap((f) => pages.get(f.id) ?? []), sort).slice(0, pageSize);
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
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string }> {
    const key = feedId ?? 'all';
    const cursor = cursors.get(key);
    const scope = feedId ? `feed:${feedId}` : undefined;
    const res = await fetchArticlesPage({scope, unreadOnly: unreadOnly || hideRead, sort, limit: pageSize, cursor});
    const next = res.nextCursor;
    const nextItems = capItems(mergeSorted(items, res.items, sort), pageSize);
    return {items: nextItems, hasMore: next !== undefined, nextCursor: next};
}

export async function fetchFolderPage(
    folderKey: string,
    cursors: Map<string, string | undefined>,
    unreadOnly: boolean,
    hideRead: boolean,
    sort: ArticleSort,
    pageSize: number,
    items: Article[],
): Promise<{ items: Article[]; hasMore: boolean; nextCursor?: string }> {
    const cursor = cursors.get(folderKey);
    const res = await fetchArticlesPage({scope: folderKey, unreadOnly: unreadOnly || hideRead, sort, limit: pageSize, cursor});
    const next = res.nextCursor;
    const nextItems = capItems(mergeSorted(items, res.items, sort), pageSize);
    return {items: nextItems, hasMore: next !== undefined, nextCursor: next};
}

export async function fetchFeedSetWindow(windowFeeds: Feed[], cursors: Map<string, string | undefined>, _feedHasMore: Map<string, boolean>, unreadOnly: boolean, hideRead: boolean, sort: ArticleSort, pageSize: number, existingItems: Article[], gen: number, currentGen: () => number): Promise<{ kept: Article[]; hasMoreEntries: Array<[string, boolean]>; items: Article[] } | null> {
    const pages = new Map<string, Article[]>();
    const lastHasMore = new Map<string, boolean>();
    const perFeed = perFeedLimit(pageSize, windowFeeds.length);
    await fetchFeeds(windowFeeds, perFeed, cursors, unreadOnly, hideRead, sort, gen, currentGen, pages, lastHasMore);
    if (gen !== currentGen()) return null;
    const existingIds = new Set(existingItems.map((a) => a.id));
    let kept = pickKept(windowFeeds, pages, existingIds, sort, pageSize);
    if (kept.length < pageSize) {
        const more = windowFeeds.filter((f) => lastHasMore.get(f.id) === true);
        if (more.length) {
            await fetchFeeds(more, perFeedLimit(pageSize - kept.length, more.length), cursors, unreadOnly, hideRead, sort, gen, currentGen, pages, lastHasMore);
            if (gen !== currentGen()) return null;
            kept = pickKept(windowFeeds, pages, existingIds, sort, pageSize);
        }
    }
    const hasMoreEntries = windowFeeds.map((f) => [f.id, lastHasMore.get(f.id) ?? false] as [string, boolean]);
    if (!kept.length) return {kept, hasMoreEntries, items: existingItems};
    return {kept, hasMoreEntries, items: capItems(mergeSorted(existingItems, kept, sort), pageSize)};
}

export function getActiveFeeds(feeds: Feed[], feedHasMore: Map<string, boolean>): Feed[] {
    return feeds.filter((f) => feedHasMore.get(f.id) !== false);
}

export function nextWindow(feeds: Feed[], offset: number, pageSize: number): Feed[] {
    return feedWindow(feeds, offset, pageSize);
}
