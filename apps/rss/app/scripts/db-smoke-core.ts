// db-smoke core phases: upsert/query basics and sort orders.
import {
    type ArticleCursor,
    deleteFeed,
    markAllRead,
    queryArticles,
    setArticleRead,
    setArticleStarred,
    upsertArticles,
} from '../src/db/db';
import { assert, makeArticle } from './db-smoke-helpers';

export async function runCrudPhase(now: number) {
    const articles = [
        makeArticle('feed-a', 'a1', now - 1000),
        makeArticle('feed-a', 'a2', now - 2000),
        makeArticle('feed-a', 'a3', now - 2000),
        makeArticle('feed-a', 'a4', now - 3000),
        makeArticle('feed-a', 'a5', now - 3000),
        makeArticle('feed-a', 'a6', now - 4000),
        makeArticle('feed-b', 'b1', now - 500),
    ];
    const inserted = await upsertArticles(articles);
    assert(inserted === 7, 'upsert inserts 7 new articles');

    const reinserted = await upsertArticles([articles[0]]);
    assert(reinserted === 0, 're-upsert does not double count (existing preserved)');

    const all = await queryArticles({ limit: 100 });
    assert(all.items.length === 7, 'all view returns all articles');
    assert(all.items[0].guid === 'b1', 'all view sorted newest first by default');
    assert(all.hasMore === false, 'all view hasMore false with small set');

    const allPage1 = await queryArticles({ limit: 3 });
    assert(allPage1.items.length === 3, 'all view page 1 has 3');
    const cursor: ArticleCursor = {
        key: allPage1.items[allPage1.items.length - 1].published,
        id: allPage1.items[allPage1.items.length - 1].id,
    };
    const allPage2 = await queryArticles({ cursor, limit: 3 });
    assert(allPage2.items.length === 3, 'all view page 2 has 3');
    const cursor2: ArticleCursor = {
        key: allPage2.items[allPage2.items.length - 1].published,
        id: allPage2.items[allPage2.items.length - 1].id,
    };
    const allPage3 = await queryArticles({ cursor: cursor2, limit: 3 });
    assert(allPage3.items.length === 1, 'all view page 3 has 1 (no dupes skipped)');
    const ids = [...allPage1.items, ...allPage2.items, ...allPage3.items].map((a) => a.id);
    assert(new Set(ids).size === 7, 'pagination visits every article exactly once (duplicate timestamps ok)');

    const feedAOnly = await queryArticles({ feedId: 'feed-a', limit: 100 });
    assert(feedAOnly.items.length === 6, 'feed view filters by feed');

    await setArticleRead('feed-a:a1', 1);
    await setArticleStarred('feed-a:a2', true);
    const unreadOnlyFeed = await queryArticles({ feedId: 'feed-a', unreadOnly: true, limit: 100 });
    assert(unreadOnlyFeed.items.length === 5, 'unread-only feed view excludes read');
    assert(
        unreadOnlyFeed.items.every((a) => a.read === 0),
        'unread-only returns only unread',
    );

    await markAllRead('feed-a');
    const feedAafter = await queryArticles({ feedId: 'feed-a', limit: 100 });
    assert(
        feedAafter.items.every((a) => a.read === 1),
        'mark all read sets feed articles read',
    );

    await deleteFeed('feed-b');
    const afterDelete = await queryArticles({ limit: 100 });
    assert(afterDelete.items.length === 6, 'delete feed removes its articles');
}

export async function runSortPhase(now: number) {
    // ---- sort tests ----
    const hotArticles = [
        { ...makeArticle('feed-a', 'h-old', now - 2 * 86_400_000, 0), popularity: 200, hot: 2_000_000_000 },
        { ...makeArticle('feed-a', 'h-mid', now - 60_000, 0), popularity: 10, hot: 1_999_000_000 },
        { ...makeArticle('feed-a', 'h-new', now, 0), popularity: 1, hot: 1_998_000_000 },
    ];
    const hotInserted = await upsertArticles(hotArticles);
    assert(hotInserted === 3, 'hot test articles inserted');

    const hotSorted = await queryArticles({ sort: 'hot', limit: 100 });
    assert(
        hotSorted.items
            .map((a) => a.id)
            .slice(0, 3)
            .join(',') === hotArticles.map((a) => a.id).join(','),
        'hot sort orders by hot desc',
    );
    assert(hotSorted.items[0].popularity === 200, 'hot sort keeps high-popularity article on top');

    const oldestSorted = await queryArticles({ sort: 'oldest', limit: 100 });
    const oldestFirst = oldestSorted.items[0];
    const oldestExpected = [...oldestSorted.items].sort(
        (a, b) => a.published - b.published || a.id.localeCompare(b.id),
    )[0];
    assert(oldestFirst.id === oldestExpected.id, 'oldest sort returns oldest first');

    const hotPage = await queryArticles({ sort: 'hot', limit: 2 });
    const hotCursor: ArticleCursor = {
        key: hotPage.items[hotPage.items.length - 1].hot,
        id: hotPage.items[hotPage.items.length - 1].id,
    };
    const hotPage2 = await queryArticles({ sort: 'hot', cursor: hotCursor, limit: 2 });
    assert(hotPage2.items.length === 2, 'hot sort paginates');
    assert(
        new Set([...hotPage.items, ...hotPage2.items].map((a) => a.id)).size === 4,
        'hot pagination does not repeat items',
    );

    const feedHot = await queryArticles({ feedId: 'feed-a', sort: 'hot', limit: 100 });
    assert(feedHot.items[0].id === 'feed-a:h-old', 'feed view hot sort uses byFeedHot index');
    const feedOldest = await queryArticles({ feedId: 'feed-a', sort: 'oldest', limit: 100 });
    assert(feedOldest.items[0].id === 'feed-a:h-old', 'feed view oldest sort uses byFeedDate asc');
    const feedHotCursor: ArticleCursor = {
        key: feedHot.items[1].hot,
        id: feedHot.items[1].id,
    };
    const feedHotPage2 = await queryArticles({ feedId: 'feed-a', sort: 'hot', cursor: feedHotCursor, limit: 1 });
    assert(
        feedHotPage2.items.length === 1 && feedHotPage2.items[0].id === 'feed-a:h-new',
        'feed hot pagination cursor works',
    );
}
