import 'fake-indexeddb/auto';
import {deleteDB, openDB} from 'idb';
import {
  type ArticleCursor,
  closeDb,
  deleteFeed,
  deleteFolderTx,
  getDb,
  getFeeds,
  markAllRead,
  markArticleReadTx,
  markArticlesRead,
  markReadBefore,
  putFeed,
  putFolder,
  queryArticles,
  queryRecentArticles,
  queryTodayArticles,
  reconcileUnreadCounts,
  setArticleRead,
  setArticleStarred,
  updateFeedErrorIfExists,
  upsertArticles
} from '../src/db/db';
import {ingestFeed} from '../src/services/sync';
import type {Article, Feed, Folder, ParsedFeed} from '../src/types';

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
    const r1 = await ingestFeed(feedC, parsedC, feedC, false);
    assert(r1.inserted === 1, 'ingest inserts article (no syndication yet)');
    let stored = await (await getDb()).get('articles', 'feed-c:c1');
    assert(stored!.popularity === 6, 'popularity = 1 base + 5 comments');
    assert(stored!.normLink === storyLink, 'normLink canonicalized (tracking params stripped)');
    const feedCAfter = await (await getDb()).get('feeds', 'feed-c');
    assert(feedCAfter!.unread === 1, 'ingest folds new articles into feed.unread atomically');

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
    const r2 = await ingestFeed(feedD, parsedD, feedD, false);
    assert(r2.inserted === 1, 'ingest inserts syndicated copy');
    stored = await (await getDb()).get('articles', 'feed-d:d1');
    assert(stored!.popularity === 4, 'syndicated copy: 1 + 3*(2 feeds - 1)');
    const bumped = await (await getDb()).get('articles', 'feed-c:c1');
    assert(bumped!.popularity === 9, 'existing article bumped +3 for new syndication');
    const hotA = bumped!.hot;
    const hotD = stored!.hot;
    assert(hotA !== hotD, 'hot recomputed differs after popularity bump');

    // ---- repeated syncs must not inflate syndication ----
    const r3 = await ingestFeed(feedD, parsedD, feedD, false);
    assert(r3.inserted === 0, 're-ingest of the same feed inserts nothing new');
    const cAfterRepeat = await (await getDb()).get('articles', 'feed-c:c1');
    assert(cAfterRepeat!.popularity === 9, 're-ingest does not bump existing copies again');
    const dAfterRepeat = await (await getDb()).get('articles', 'feed-d:d1');
    assert(dAfterRepeat!.popularity === 4, 're-ingest keeps the feed copy stable');

    // ---- a feed listing the same story twice bumps the copy once ----
    await resetDb();
    const feedE1: Feed = {...feedA, id: 'feed-e1', title: 'E1'};
    const feedE2: Feed = {...feedB, id: 'feed-e2', title: 'E2'};
    await putFeed(feedE1);
    await putFeed(feedE2);
    const dupLink = 'dup.example.com/story';
    await ingestFeed(
        feedE1,
        {title: 'E1', items: [{guid: 'e1-1', title: 'Story', link: `https://${dupLink}`, published: now - 10_000}]},
        feedE1,
        false,
    );
    await ingestFeed(
        feedE2,
        {
            title: 'E2',
            items: [
                {guid: 'e2-1', title: 'Story', link: `https://${dupLink}`, published: now - 9_000},
                {guid: 'e2-2', title: 'Story (dup)', link: `https://${dupLink}`, published: now - 8_000},
            ],
        },
        feedE2,
        false,
    );
    const e1Copy = await (await getDb()).get('articles', 'feed-e1:e1-1');
    assert(e1Copy!.popularity === 4, 'duplicate links in one feed bump the syndicated copy exactly once');

    // ---- an in-flight sync of a deleted feed must not resurrect it ----
    await resetDb();
    const feedRace: Feed = {...feedA, id: 'feed-race', title: 'Race'};
    await putFeed(feedRace);
    const parsedRace: ParsedFeed = {
        title: 'Race',
        items: [{guid: 'r1', title: 'x', link: 'https://race.example/1', published: now}],
    };
    await deleteFeed('feed-race');
    const raceResult = await ingestFeed(feedRace, parsedRace, feedRace, false);
    assert(raceResult.inserted === 0, 'in-flight ingest of a deleted feed inserts nothing');
    const resurrected = await (await getDb()).get('feeds', 'feed-race');
    assert(resurrected === undefined, 'in-flight ingest does not resurrect a deleted feed');
    assert((await (await getDb()).getAll('articles')).length === 0, 'in-flight ingest of a deleted feed writes no articles');

    // ---- sync error surfacing must not resurrect a deleted feed ----
    await resetDb();
    const feedErr: Feed = {...feedA, id: 'feed-err', title: 'Err'};
    await putFeed(feedErr);
    await updateFeedErrorIfExists('feed-err', 'boom');
    const errFeed = await (await getDb()).get('feeds', 'feed-err');
    assert(errFeed!.lastError === 'boom', 'updateFeedErrorIfExists surfaces sync errors on live feeds');
    await deleteFeed('feed-err');
    await updateFeedErrorIfExists('feed-err', 'boom');
    assert((await (await getDb()).get('feeds', 'feed-err')) === undefined, 'updateFeedErrorIfExists does not resurrect a deleted feed');

    // ---- atomic mark-read: concurrent calls decrement unread once ----
    await resetDb();
    const feedR: Feed = {...feedA, id: 'feed-r', title: 'Feed R', unread: 2};
    await putFeed(feedR);
    await upsertArticles([
        makeArticle('feed-r', 'r1', Date.now() - 1_000, 0),
        makeArticle('feed-r', 'r2', Date.now() - 2_000, 0),
    ]);
    const [first, second] = await Promise.all([
        markArticleReadTx('feed-r:r1'),
        markArticleReadTx('feed-r:r1'),
    ]);
    assert(first !== second, 'concurrent mark-read: only one caller flips the article');
    const rFeed = await (await getDb()).get('feeds', 'feed-r');
    assert(rFeed!.unread === 1, 'concurrent mark-read decrements unread exactly once');
    const rArticle = await (await getDb()).get('articles', 'feed-r:r1');
    assert(rArticle!.read === 1, 'concurrent mark-read marks the article read');

    // ---- atomic folder delete: folder and memberships removed together ----
    await resetDb();
    const folderX: Folder = {id: 'folder-x', title: 'X', createdAt: 1};
    await putFolder(folderX);
    const feedFx: Feed = {...feedA, id: 'feed-fx', url: 'https://fx.example/rss', folderIds: ['folder-x'], unread: 0, addedAt: 1};
    await putFeed(feedFx);
    await deleteFolderTx('folder-x');
    const foldersAfter = await (await getDb()).getAll('folders');
    assert(!foldersAfter.some((f) => f.id === 'folder-x'), 'deleteFolderTx removes the folder');
    const fxAfter = await (await getDb()).get('feeds', 'feed-fx');
    assert(fxAfter!.folderIds.length === 0, 'deleteFolderTx strips folder membership from feeds');

    // ---- folder deletion on legacy (folderId-only) feeds must not crash ----
    await resetDb();
    const legacyFolder: Folder = {id: 'legacy-folder-x', title: 'LegacyX', createdAt: 1};
    await putFolder(legacyFolder);
    await (await getDb()).put('feeds', {
        id: 'feed-legacy-x',
        title: 'Legacy Feed',
        url: 'https://legacyx.example/rss',
        folderId: 'legacy-folder-x',
        unread: 0,
        addedAt: 1,
    } as unknown as Feed);
    await deleteFolderTx('legacy-folder-x');
    const foldersAfterLegacy = await (await getDb()).getAll('folders');
    assert(!foldersAfterLegacy.some((f) => f.id === 'legacy-folder-x'), 'deleteFolderTx handles legacy folder deletion');
    const lx = await (await getDb()).get('feeds', 'feed-legacy-x');
    assert(lx != null && Array.isArray(lx.folderIds) && lx.folderIds.length === 0, 'deleteFolderTx normalizes legacy feeds and strips membership');

    // ---- unread pagination reports hasMore accurately ----
    await resetDb();
    const feedU: Feed = {...feedA, id: 'feed-u', title: 'Feed U'};
    await putFeed(feedU);
    await upsertArticles(
        Array.from({length: 5}, (_, i) => makeArticle('feed-u', `u${i}`, Date.now() - i * 1_000, 0)),
    );
    const unreadPage1 = await queryArticles({unreadOnly: true, limit: 2});
    assert(unreadPage1.items.length === 2 && unreadPage1.hasMore === true, 'unread query reports hasMore when more remain');
    const unreadCursor: ArticleCursor = {
        key: unreadPage1.items[unreadPage1.items.length - 1].published,
        id: unreadPage1.items[unreadPage1.items.length - 1].id,
    };
    const unreadPage2 = await queryArticles({unreadOnly: true, limit: 2, cursor: unreadCursor});
    assert(unreadPage2.items.length === 2 && unreadPage2.hasMore === true, 'unread pagination continues');
    const unreadCursor2: ArticleCursor = {
        key: unreadPage2.items[unreadPage2.items.length - 1].published,
        id: unreadPage2.items[unreadPage2.items.length - 1].id,
    };
    const unreadPage3 = await queryArticles({unreadOnly: true, limit: 2, cursor: unreadCursor2});
    assert(unreadPage3.items.length === 1 && unreadPage3.hasMore === false, 'unread pagination ends with hasMore false');

    // ---- equal-published unread pagination: id-descending tie-break is self-consistent ----
    await resetDb();
    const feedEq: Feed = {...feedA, id: 'feed-eq', title: 'Feed EQ'};
    await putFeed(feedEq);
    const eqTs = Date.now();
    await upsertArticles(
        Array.from({length: 25}, (_, i) => makeArticle('feed-eq', `eq${i}`, eqTs, 0)),
    );
    const eqSeen: string[] = [];
    let eqCursor: ArticleCursor | undefined;
    let eqHasMore = true;
    while (eqHasMore) {
        const res = await queryArticles({unreadOnly: true, limit: 7, cursor: eqCursor});
        eqSeen.push(...res.items.map((a) => a.id));
        eqHasMore = res.hasMore;
        const last = res.items[res.items.length - 1];
        eqCursor = last ? {key: last.published, id: last.id} : undefined;
    }
    assert(eqSeen.length === 25, 'equal-published unread pagination visits every article (no skips)');
    assert(new Set(eqSeen).size === 25, 'equal-published unread pagination has no duplicates');
    assert(eqHasMore === false, 'equal-published unread pagination ends with hasMore false');

    // ---- non-destructive upgrade: legacy data survives reopening ----
    await closeDb();
    await deleteDB('rss-reader');
    const legacy = await openDB('rss-reader', 1, {
        upgrade(db) {
            db.createObjectStore('folders', {keyPath: 'id'});
            db.createObjectStore('feeds', {keyPath: 'id'});
            db.createObjectStore('articles', {keyPath: 'id'});
            db.createObjectStore('meta', {keyPath: 'key'});
        },
    });
    await legacy.put('feeds', {
        id: 'legacy-feed',
        title: 'Legacy',
        url: 'https://legacy.example/feed',
        folderId: 'legacy-folder',
        unread: 2,
        addedAt: 1,
    });
    await legacy.put('articles', {
        id: 'legacy-feed:a1',
        feedId: 'legacy-feed',
        guid: 'a1',
        title: 'A',
        published: 1,
        fetchedAt: 1,
        read: 0,
        starred: false,
    });
    legacy.close();
    await closeDb();
    const migrated = await getFeeds();
    assert(migrated.length === 1 && migrated[0].folderIds[0] === 'legacy-folder', 'upgrade preserves legacy feeds (folderId normalized)');
    const legacyArticles = await (await getDb()).getAll('articles');
    assert(legacyArticles.length === 1, 'upgrade preserves legacy articles');
    const legacyFeed = await (await getDb()).get('feeds', 'legacy-feed');
    assert(legacyFeed!.unread === 2, 'upgrade preserves feed counters');
    await closeDb();
    await deleteDB('rss-reader');
    await getDb();

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
    await dbg.put('feeds', drifted!);
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

    // ---- bounded unread queries on a large feed set (regression) ----
    await resetDb();
    const feedU2: Feed = {...feedA, id: 'feed-u2', title: 'Feed U2'};
    await putFeed(feedU2);
    const u2Base = Date.now();
    // 1200 deterministic articles: even indices unread, odd indices read, unique
    // published ascending with index (u0 oldest, u1199 newest). hot descends as
    // index ascends, so u0 is hottest.
    const u2Articles: Article[] = Array.from({length: 1200}, (_, i) => ({
        ...makeArticle('feed-u2', `u${i}`, u2Base + i * 1_000, i % 2 === 0 ? 0 : 1),
        hot: (1200 - i) * 10,
    }));
    assert((await upsertArticles(u2Articles)) === 1200, 'large unread set seeded');
    const U2_UNREAD = 600;
    const u2Newest = await queryArticles({feedId: 'feed-u2', unreadOnly: true, sort: 'newest', limit: 100});
    assert(u2Newest.items.length === 100, 'large unread query returns exactly limit items');
    assert(u2Newest.items.every((a) => a.read === 0), 'large unread query returns only unread');
    assert(u2Newest.items[0].id === 'feed-u2:u1198', 'newest unread query orders newest first (u1198)');
    const u2Oldest = await queryArticles({feedId: 'feed-u2', unreadOnly: true, sort: 'oldest', limit: 100});
    assert(u2Oldest.items[0].id === 'feed-u2:u0', 'oldest unread query orders oldest first (u0)');
    const u2Hot = await queryArticles({feedId: 'feed-u2', unreadOnly: true, sort: 'hot', limit: 100});
    assert(u2Hot.items[0].id === 'feed-u2:u0', 'hot unread query orders hottest first (u0)');
    assert(u2Hot.items.every((a) => a.read === 0), 'hot unread query returns only unread');

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
        u2Cursor = last ? {key: last.published, id: last.id} : undefined;
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
    const u2AllUnread = await queryArticles({unreadOnly: true, sort: 'newest', limit: 100});
    assert(
        u2AllUnread.items.length === 100 && u2AllUnread.items.every((a) => a.read === 0),
        'all-scoped unread query is bounded and returns only unread',
    );

    // small-N exact-set comparison guards behavioral equivalence with the old
    // unbounded implementation.
    const u2Small = await queryArticles({feedId: 'feed-u2', unreadOnly: true, sort: 'newest', limit: 1000});
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
    const u2SmallOldest = await queryArticles({feedId: 'feed-u2', unreadOnly: true, sort: 'oldest', limit: 1000});
    assert(
        u2SmallOldest.items.map((a) => a.id).join(',') === u2ExpectedOldest.map((a) => a.id).join(','),
        'small-N unread results match the exact expected oldest set',
    );

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
    assert(
        today.map((a) => a.guid).join(',') === 't3,t2,t1',
        'queryTodayArticles returns newest first',
    );
    const capped = await queryTodayArticles(tNow - 86_400_000, 2);
    assert(capped.length === 2, 'queryTodayArticles honors the maxScan cap');
    const none = await queryTodayArticles(tNow + 86_400_000);
    assert(none.length === 0, 'queryTodayArticles returns nothing for a future cutoff');

    // ---- image is derived from content, not a persisted column ----
    await resetDb();
    const feedImg: Feed = {...feedA, id: 'feed-img', title: 'Feed Img'};
    await putFeed(feedImg);
    const parsedImg: ParsedFeed = {
        title: 'Feed Img',
        items: [
            {
                guid: 'img-1',
                title: 'With image',
                link: 'https://example.com/img-1',
                content: '<p>Hello</p><img src="https://img.example/thumb.jpg" alt="">',
                published: Date.now(),
            },
            {
                guid: 'img-2',
                title: 'Enclosure only',
                link: 'https://example.com/img-2',
                content: '<p>No image in body</p>',
                media: 'https://media.example/enclosure.jpg',
                published: Date.now() - 1000,
            },
        ],
    };
    const rImg = await ingestFeed(feedImg, parsedImg, feedImg, false);
    assert(rImg.inserted === 2, 'image derivation ingest inserts both items');
    const storedWithImg = await (await getDb()).get('articles', 'feed-img:img-1');
    assert(!('image' in (storedWithImg as unknown as Record<string, unknown>)) || (storedWithImg as unknown as {image?: string}).image === undefined, 'stored article has no persisted image column (derived at render)');
    const {firstImageUrl: cFirst} = await import('../src/services/parser.js');
    assert(cFirst(storedWithImg!.content) === 'https://img.example/thumb.jpg', 'thumbnail derived from content via firstImageUrl');
    const storedEnclosure = await (await getDb()).get('articles', 'feed-img:img-2');
    assert(cFirst(storedEnclosure!.content)?.includes('enclosure.jpg') ?? false, 'enclosure media prepended to content so firstImageUrl finds it');
    assert(!('image' in (storedEnclosure as unknown as Record<string, unknown>)) || (storedEnclosure as unknown as {image?: string}).image === undefined, 'enclosure article also has no persisted image column');

    // recomputeHotIfNeeded must clean legacy image fields and bump HOT_VERSION
    await (await getDb()).put('articles', {...storedWithImg!, image: 'https://legacy.example/old.jpg'} as unknown as Article);
    await (await getDb()).put('meta', {key: 'hot-version', value: 4});
    const {recomputeHotIfNeeded} = await import('../src/db/db-query.js');
    await recomputeHotIfNeeded();
    const cleaned = await (await getDb()).get('articles', 'feed-img:img-1');
    assert(!('image' in (cleaned as unknown as Record<string, unknown>)), 'recomputeHotIfNeeded removes legacy image field');
    const hv = await (await getDb()).get('meta', 'hot-version');
    assert((hv?.value as number) === 5, 'HOT_VERSION bumped to 5 after image column removal');

    await resetDb();
    console.log('\nAll db smoke tests passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
