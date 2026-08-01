import 'fake-indexeddb/auto';
import {
  type ArticleCursor,
  deleteFeed,
  getDb,
  markAllRead,
  markArticlesRead,
  markReadBefore,
  putFeed,
  queryArticles,
  queryRecentArticles,
  reconcileUnreadCounts,
  setArticleRead,
  setArticleStarred,
  upsertArticles
} from '../src/db/db';
import {ingestFeed} from '../src/services/sync';
import type {Article, Feed, ParsedFeed} from '../src/types';

function assert(cond: boolean, msg: string) {
    if (!cond) {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
    }
    console.log(`ok: ${msg}`);
}

async function resetDb() {
    const db = await getDb();
    await Promise.all([
        db.clear('feeds'),
        db.clear('folders'),
        db.clear('articles'),
        db.clear('meta'),
    ]);
}

function makeArticle(feedId: string, guid: string, published: number, read: 0 | 1 = 0): Article {
    return {
        id: `${feedId}:${guid}`,
        feedId,
        guid,
        title: `Article ${guid}`,
        link: `https://example.com/${guid}`,
        summary: 'summary',
        published,
        fetchedAt: Date.now(),
        read,
        starred: false,
        normLink: `example.com/${guid}`,
        comments: 0,
        popularity: 1,
        hot: published / 1000,
    };
}

async function main() {
    await resetDb();

    const feedA: Feed = {
        id: 'feed-a',
        title: 'Feed A',
        url: 'https://a.example/rss',
        folderIds: [],
        unread: 0,
        addedAt: Date.now(),
    };
    const feedB: Feed = {
        id: 'feed-b',
        title: 'Feed B',
        url: 'https://b.example/rss',
        folderIds: ['folder-1'],
        unread: 0,
        addedAt: Date.now(),
    };
    await putFeed(feedA);
    await putFeed(feedB);

    const now = Date.now();
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

    const all = await queryArticles({limit: 100});
    assert(all.items.length === 7, 'all view returns all articles');
    assert(all.items[0].guid === 'b1', 'all view sorted newest first by default');
    assert(all.hasMore === false, 'all view hasMore false with small set');

    const allPage1 = await queryArticles({limit: 3});
    assert(allPage1.items.length === 3, 'all view page 1 has 3');
    const cursor: ArticleCursor = {
        key: allPage1.items[allPage1.items.length - 1].published,
        id: allPage1.items[allPage1.items.length - 1].id,
    };
    const allPage2 = await queryArticles({cursor, limit: 3});
    assert(allPage2.items.length === 3, 'all view page 2 has 3');
    const cursor2: ArticleCursor = {
        key: allPage2.items[allPage2.items.length - 1].published,
        id: allPage2.items[allPage2.items.length - 1].id,
    };
    const allPage3 = await queryArticles({cursor: cursor2, limit: 3});
    assert(allPage3.items.length === 1, 'all view page 3 has 1 (no dupes skipped)');
    const ids = [...allPage1.items, ...allPage2.items, ...allPage3.items].map((a) => a.id);
    assert(new Set(ids).size === 7, 'pagination visits every article exactly once (duplicate timestamps ok)');

    const feedAOnly = await queryArticles({feedId: 'feed-a', limit: 100});
    assert(feedAOnly.items.length === 6, 'feed view filters by feed');

    await setArticleRead('feed-a:a1', 1);
    await setArticleStarred('feed-a:a2', true);
    const unreadOnlyFeed = await queryArticles({feedId: 'feed-a', unreadOnly: true, limit: 100});
    assert(unreadOnlyFeed.items.length === 5, 'unread-only feed view excludes read');
    assert(unreadOnlyFeed.items.every((a) => a.read === 0), 'unread-only returns only unread');

    await markAllRead('feed-a');
    const feedAafter = await queryArticles({feedId: 'feed-a', limit: 100});
    assert(feedAafter.items.every((a) => a.read === 1), 'mark all read sets feed articles read');

    await deleteFeed('feed-b');
    const afterDelete = await queryArticles({limit: 100});
    assert(afterDelete.items.length === 6, 'delete feed removes its articles');

    // ---- sort tests ----
    const hotArticles = [
        {...makeArticle('feed-a', 'h-old', now - 2 * 86_400_000, 0), popularity: 200, hot: 2_000_000_000},
        {...makeArticle('feed-a', 'h-mid', now - 60_000, 0), popularity: 10, hot: 1_999_000_000},
        {...makeArticle('feed-a', 'h-new', now, 0), popularity: 1, hot: 1_998_000_000},
    ];
    const hotInserted = await upsertArticles(hotArticles);
    assert(hotInserted === 3, 'hot test articles inserted');

    const hotSorted = await queryArticles({sort: 'hot', limit: 100});
    assert(
        hotSorted.items.map((a) => a.id).slice(0, 3).join(',') ===
        hotArticles.map((a) => a.id).join(','),
        'hot sort orders by hot desc',
    );
    assert(hotSorted.items[0].popularity === 200, 'hot sort keeps high-popularity article on top');

    const oldestSorted = await queryArticles({sort: 'oldest', limit: 100});
    const oldestFirst = oldestSorted.items[0];
    const oldestExpected = [...oldestSorted.items].sort(
        (a, b) => a.published - b.published || a.id.localeCompare(b.id),
    )[0];
    assert(oldestFirst.id === oldestExpected.id, 'oldest sort returns oldest first');

    const hotPage = await queryArticles({sort: 'hot', limit: 2});
    const hotCursor: ArticleCursor = {
        key: hotPage.items[hotPage.items.length - 1].hot,
        id: hotPage.items[hotPage.items.length - 1].id,
    };
    const hotPage2 = await queryArticles({sort: 'hot', cursor: hotCursor, limit: 2});
    assert(hotPage2.items.length === 2, 'hot sort paginates');
    assert(
        new Set([...hotPage.items, ...hotPage2.items].map((a) => a.id)).size === 4,
        'hot pagination does not repeat items',
    );

    const feedHot = await queryArticles({feedId: 'feed-a', sort: 'hot', limit: 100});
    assert(feedHot.items[0].id === 'feed-a:h-old', 'feed view hot sort uses byFeedHot index');
    const feedOldest = await queryArticles({feedId: 'feed-a', sort: 'oldest', limit: 100});
    assert(feedOldest.items[0].id === 'feed-a:h-old', 'feed view oldest sort uses byFeedDate asc');
    const feedHotCursor: ArticleCursor = {
        key: feedHot.items[1].hot,
        id: feedHot.items[1].id,
    };
    const feedHotPage2 = await queryArticles({feedId: 'feed-a', sort: 'hot', cursor: feedHotCursor, limit: 1});
    assert(feedHotPage2.items.length === 1 && feedHotPage2.items[0].id === 'feed-a:h-new', 'feed hot pagination cursor works');

    // ---- syndication / popularity via real ingest path ----
    await resetDb();
    const feedC: Feed = {...feedA, id: 'feed-c', title: 'Feed C'};
    const feedD: Feed = {...feedB, id: 'feed-d', title: 'Feed D'};
    await putFeed(feedC);
    await putFeed(feedD);

    const storyLink = 'news.example.com/breaking-story';
    const parsedC: ParsedFeed = {
        title: 'Feed C',
        items: [
            {
                guid: 'c1',
                title: 'Breaking story',
                link: `https://news.example.com/breaking-story?utm_source=rss`,
                published: now - 30_000,
                comments: 5,
            },
        ],
    };
    const r1 = await ingestFeed(feedC, parsedC);
    assert(r1.inserted === 1, 'ingest inserts article (no syndication yet)');
    let stored = await (await getDb()).get('articles', 'feed-c:c1');
    assert(stored!.popularity === 6, 'popularity = 1 base + 5 comments');
    assert(stored!.normLink === storyLink, 'normLink canonicalized (tracking params stripped)');

    const parsedD: ParsedFeed = {
        title: 'Feed D',
        items: [
            {
                guid: 'd1',
                title: 'Breaking story (dup)',
                link: 'https://news.example.com/breaking-story',
                published: now - 20_000,
            },
        ],
    };
    const r2 = await ingestFeed(feedD, parsedD);
    assert(r2.inserted === 1, 'ingest inserts syndicated copy');
    stored = await (await getDb()).get('articles', 'feed-d:d1');
    assert(stored!.popularity === 4, 'syndicated copy: 1 + 3*(2 feeds - 1)');
    const bumped = await (await getDb()).get('articles', 'feed-c:c1');
    assert(bumped!.popularity === 9, 'existing article bumped +3 for new syndication');
    const hotA = bumped!.hot;
    const hotD = stored!.hot;
    assert(hotA !== hotD, 'hot recomputed differs after popularity bump');

    // ---- markArticlesRead / markReadBefore ----
    await resetDb();
    const feedG: Feed = {...feedA, id: 'feed-g', title: 'Feed G'};
    await putFeed(feedG);
    const mNow = Date.now();
    await upsertArticles([
        makeArticle('feed-g', 'g1', mNow - 1_000, 0),
        makeArticle('feed-g', 'g2', mNow - 2_000, 0),
        makeArticle('feed-g', 'g3', mNow - 3_000, 1),
        makeArticle('feed-g', 'g4', mNow - 4_000, 0),
    ]);
    await markArticlesRead(['feed-g:g1', 'feed-g:g4', 'feed-g:g3']);
    const gAfter = await queryArticles({feedId: 'feed-g', limit: 100});
    assert(
        ['feed-g:g1', 'feed-g:g4', 'feed-g:g3'].every(
            (id) => gAfter.items.find((a) => a.id === id)?.read === 1,
        ),
        'markArticlesRead sets listed articles read',
    );
    const gUnread = await queryArticles({feedId: 'feed-g', unreadOnly: true, limit: 100});
    assert(gUnread.items.length === 1 && gUnread.items[0].id === 'feed-g:g2', 'markArticlesRead keeps other articles unread');

    await markReadBefore('feed-g', mNow - 1_500);
    const gRemaining = await queryArticles({feedId: 'feed-g', unreadOnly: true, limit: 100});
    assert(gRemaining.items.length === 0, 'markReadBefore marks older-than-cutoff read for a feed');

    await setArticleRead('feed-g:g1', 0);
    await markReadBefore(undefined, mNow);
    const allAfter = await queryArticles({unreadOnly: true, limit: 100});
    assert(allAfter.items.length === 0, 'markReadBefore(undefined) applies across all feeds');

    // ---- reconcileUnreadCounts corrects a drifted counter ----
    const dbg = await getDb();
    await setArticleRead('feed-g:g1', 0);
    await setArticleRead('feed-g:g2', 0);
    const drifted = await dbg.get('feeds', 'feed-g');
    drifted!.unread = 999;
    await dbg.put('feeds', drifted);
    await reconcileUnreadCounts();
    const fixed = await dbg.get('feeds', 'feed-g');
    assert(fixed!.unread === 2, 'reconcileUnreadCounts resets feed.unread to actual unread count');

    await resetDb();
    const feedE: Feed = {...feedA, id: 'feed-e', title: 'Feed E'};
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
    assert(
        !recentList.some((a) => a.id === 'feed-e:old'),
        'queryRecentArticles excludes articles older than cutoff',
    );

    await resetDb();
    console.log('\nAll db smoke tests passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
