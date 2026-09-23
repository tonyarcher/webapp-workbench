// db-smoke query phases: unread pagination, equal-published pagination,
// recent/today queries, and bounded unread queries on a large feed set.
import {
    type ArticleCursor,
    putFeed,
    queryArticles,
    queryRecentArticles,
    queryTodayArticles,
    upsertArticles,
} from '../src/db/db';
import type { Article, Feed } from '../src/types';
import { assert, makeArticle, resetDb } from './db-smoke-helpers';

export async function runUnreadPaginationPhase(feedA: Feed) {
    // ---- unread pagination reports hasMore accurately ----
    await resetDb();
    const feedU: Feed = { ...feedA, id: 'feed-u', title: 'Feed U' };
    await putFeed(feedU);
    await upsertArticles(
        Array.from({ length: 5 }, (_, i) => makeArticle('feed-u', `u${i}`, Date.now() - i * 1_000, 0)),
    );
    const unreadPage1 = await queryArticles({ unreadOnly: true, limit: 2 });
    assert(
        unreadPage1.items.length === 2 && unreadPage1.hasMore === true,
        'unread query reports hasMore when more remain',
    );
    const unreadCursor: ArticleCursor = {
        key: unreadPage1.items[unreadPage1.items.length - 1].published,
        id: unreadPage1.items[unreadPage1.items.length - 1].id,
    };
    const unreadPage2 = await queryArticles({ unreadOnly: true, limit: 2, cursor: unreadCursor });
    assert(unreadPage2.items.length === 2 && unreadPage2.hasMore === true, 'unread pagination continues');
    const unreadCursor2: ArticleCursor = {
        key: unreadPage2.items[unreadPage2.items.length - 1].published,
        id: unreadPage2.items[unreadPage2.items.length - 1].id,
    };
    const unreadPage3 = await queryArticles({ unreadOnly: true, limit: 2, cursor: unreadCursor2 });
    assert(
        unreadPage3.items.length === 1 && unreadPage3.hasMore === false,
        'unread pagination ends with hasMore false',
    );
}

export async function runEqualPublishedPhase(feedA: Feed) {
    // ---- equal-published unread pagination: id-descending tie-break is self-consistent ----
    await resetDb();
    const feedEq: Feed = { ...feedA, id: 'feed-eq', title: 'Feed EQ' };
    await putFeed(feedEq);
    const eqTs = Date.now();
    await upsertArticles(Array.from({ length: 25 }, (_, i) => makeArticle('feed-eq', `eq${i}`, eqTs, 0)));
    const eqSeen: string[] = [];
    let eqCursor: ArticleCursor | undefined;
    let eqHasMore = true;
    while (eqHasMore) {
        const res = await queryArticles({ unreadOnly: true, limit: 7, cursor: eqCursor });
        eqSeen.push(...res.items.map((a) => a.id));
        eqHasMore = res.hasMore;
        const last = res.items[res.items.length - 1];
        eqCursor = last ? { key: last.published, id: last.id } : undefined;
    }
    assert(eqSeen.length === 25, 'equal-published unread pagination visits every article (no skips)');
    assert(new Set(eqSeen).size === 25, 'equal-published unread pagination has no duplicates');
    assert(eqHasMore === false, 'equal-published unread pagination ends with hasMore false');
}

export async function runRecentArticlesPhase(feedA: Feed) {
    await resetDb();
    const feedE: Feed = { ...feedA, id: 'feed-e', title: 'Feed E' };
    await putFeed(feedE);
    const briefNow = Date.now();
    const recent = [
        makeArticle('feed-e', 'old', briefNow - 48 * 86_400_000, 0),
        makeArticle('feed-e', 'yesterday', briefNow - 5 * 3_600_000, 0),
        makeArticle('feed-e', 'today-new', briefNow - 3_600_000, 0),
        makeArticle('feed-e', 'today-old', briefNow - 20 * 3_600_000, 0),
    ];
    await upsertArticles(recent);
    const since = briefNow - 24 * 3_600_000;
    const recentList = await queryRecentArticles(since, 10);
    assert(recentList.length === 3, 'queryRecentArticles returns articles since cutoff');
    assert(recentList[0].id === 'feed-e:today-new', 'queryRecentArticles newest first');
    assert(!recentList.some((a) => a.id === 'feed-e:old'), 'queryRecentArticles excludes articles older than cutoff');
}

export async function runLargeUnreadPhase(feedA: Feed) {
    // ---- bounded unread queries on a large feed set (regression) ----
    await resetDb();
    const feedU2: Feed = { ...feedA, id: 'feed-u2', title: 'Feed U2' };
    await putFeed(feedU2);
    const u2Base = Date.now();
    // 1200 deterministic articles: even indices unread, odd indices read, unique
    // published ascending with index (u0 oldest, u1199 newest). hot descends as
    // index ascends, so u0 is hottest.
    const u2Articles: Article[] = Array.from({ length: 1200 }, (_, i) => ({
        ...makeArticle('feed-u2', `u${i}`, u2Base + i * 1_000, i % 2 === 0 ? 0 : 1),
        hot: (1200 - i) * 10,
    }));
    assert((await upsertArticles(u2Articles)) === 1200, 'large unread set seeded');
    const U2_UNREAD = 600;
    const u2Newest = await queryArticles({ feedId: 'feed-u2', unreadOnly: true, sort: 'newest', limit: 100 });
    assert(u2Newest.items.length === 100, 'large unread query returns exactly limit items');
    assert(
        u2Newest.items.every((a) => a.read === 0),
        'large unread query returns only unread',
    );
    assert(u2Newest.items[0].id === 'feed-u2:u1198', 'newest unread query orders newest first (u1198)');
    const u2Oldest = await queryArticles({ feedId: 'feed-u2', unreadOnly: true, sort: 'oldest', limit: 100 });
    assert(u2Oldest.items[0].id === 'feed-u2:u0', 'oldest unread query orders oldest first (u0)');
    const u2Hot = await queryArticles({ feedId: 'feed-u2', unreadOnly: true, sort: 'hot', limit: 100 });
    assert(u2Hot.items[0].id === 'feed-u2:u0', 'hot unread query orders hottest first (u0)');
    assert(
        u2Hot.items.every((a) => a.read === 0),
        'hot unread query returns only unread',
    );

    // hasMore flips correctly across several cursor pages.
    const u2Pages: string[][] = [];
    let u2Cursor: ArticleCursor | undefined;
    let u2HasMore = true;
    let u2Page = 0;
    while (u2HasMore && u2Page < 10) {
        const res = await queryArticles({
            feedId: 'feed-u2',
            unreadOnly: true,
            sort: 'newest',
            limit: 250,
            cursor: u2Cursor,
        });
        u2Pages.push(res.items.map((a) => a.id));
        u2HasMore = res.hasMore;
        const last = res.items[res.items.length - 1];
        u2Cursor = last ? { key: last.published, id: last.id } : undefined;
        u2Page++;
    }
    const u2Flattened = u2Pages.flat();
    assert(u2Flattened.length === U2_UNREAD, 'large unread pagination visits every unread exactly once');
    assert(new Set(u2Flattened).size === U2_UNREAD, 'large unread pagination has no duplicates');
    assert(
        u2Pages[0].length === 250 && u2Pages[1].length === 250 && u2Pages[2].length === 100,
        'large unread pagination page sizes are correct (250/250/100)',
    );
    assert(u2HasMore === false, 'large unread pagination ends with hasMore false');

    // all-scoped unread variant returns only this feed's unread.
    const u2AllUnread = await queryArticles({ unreadOnly: true, sort: 'newest', limit: 100 });
    assert(
        u2AllUnread.items.length === 100 && u2AllUnread.items.every((a) => a.read === 0),
        'all-scoped unread query is bounded and returns only unread',
    );

    // small-N exact-set comparison guards behavioral equivalence with the old
    // unbounded implementation.
    const u2Small = await queryArticles({ feedId: 'feed-u2', unreadOnly: true, sort: 'newest', limit: 1000 });
    const u2ExpectedUnread = u2Articles.filter((a) => a.read === 0);
    const u2ExpectedNewest = [...u2ExpectedUnread].sort(
        (a, b) => b.published - a.published || a.id.localeCompare(b.id),
    );
    assert(
        u2Small.items.map((a) => a.id).join(',') === u2ExpectedNewest.map((a) => a.id).join(','),
        'small-N unread results match the exact expected newest set',
    );
    const u2ExpectedOldest = [...u2ExpectedUnread].sort(
        (a, b) => a.published - b.published || a.id.localeCompare(b.id),
    );
    const u2SmallOldest = await queryArticles({ feedId: 'feed-u2', unreadOnly: true, sort: 'oldest', limit: 1000 });
    assert(
        u2SmallOldest.items.map((a) => a.id).join(',') === u2ExpectedOldest.map((a) => a.id).join(','),
        'small-N unread results match the exact expected oldest set',
    );
}

export async function runTodayArticlesPhase(feedA: Feed, feedB: Feed) {
    // ---- queryTodayArticles (Today view feed) ----
    await resetDb();
    await putFeed(feedA);
    await putFeed(feedB);
    const tNow = Date.now();
    const tYesterday = tNow - 2 * 86_400_000;
    const tArticles = [
        makeArticle('feed-a', 't-old', tYesterday),
        makeArticle('feed-a', 't1', tNow - 3000),
        makeArticle('feed-b', 't2', tNow - 2000),
        makeArticle('feed-a', 't3', tNow - 1000),
    ];
    await upsertArticles(tArticles);
    const today = await queryTodayArticles(tNow - 86_400_000);
    assert(today.length === 3, 'queryTodayArticles returns only articles since the cutoff');
    assert(today.map((a) => a.guid).join(',') === 't3,t2,t1', 'queryTodayArticles returns newest first');
    const capped = await queryTodayArticles(tNow - 86_400_000, 2);
    assert(capped.length === 2, 'queryTodayArticles honors the maxScan cap');
    const none = await queryTodayArticles(tNow + 86_400_000);
    assert(none.length === 0, 'queryTodayArticles returns nothing for a future cutoff');
}
