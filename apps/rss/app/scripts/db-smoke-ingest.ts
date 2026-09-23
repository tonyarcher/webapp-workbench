// db-smoke ingest phases: syndication/popularity, re-ingest stability,
// duplicate links, deleted-feed races, sync error surfacing.
import { deleteFeed, getDb, putFeed, updateFeedErrorIfExists } from '../src/db/db';
import { ingestFeed } from '../src/services/sync';
import type { Feed, ParsedFeed } from '../src/types';
import { assert, resetDb } from './db-smoke-helpers';

export async function runSyndicationPhase(feedA: Feed, feedB: Feed, now: number) {
    // ---- syndication / popularity via real ingest path ----
    await resetDb();
    const feedC: Feed = { ...feedA, id: 'feed-c', title: 'Feed C' };
    const feedD: Feed = { ...feedB, id: 'feed-d', title: 'Feed D' };
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
}

export async function runDuplicateLinkPhase(feedA: Feed, feedB: Feed, now: number) {
    // ---- a feed listing the same story twice bumps the copy once ----
    await resetDb();
    const feedE1: Feed = { ...feedA, id: 'feed-e1', title: 'E1' };
    const feedE2: Feed = { ...feedB, id: 'feed-e2', title: 'E2' };
    await putFeed(feedE1);
    await putFeed(feedE2);
    const dupLink = 'dup.example.com/story';
    await ingestFeed(
        feedE1,
        { title: 'E1', items: [{ guid: 'e1-1', title: 'Story', link: `https://${dupLink}`, published: now - 10_000 }] },
        feedE1,
        false,
    );
    await ingestFeed(
        feedE2,
        {
            title: 'E2',
            items: [
                { guid: 'e2-1', title: 'Story', link: `https://${dupLink}`, published: now - 9_000 },
                { guid: 'e2-2', title: 'Story (dup)', link: `https://${dupLink}`, published: now - 8_000 },
            ],
        },
        feedE2,
        false,
    );
    const e1Copy = await (await getDb()).get('articles', 'feed-e1:e1-1');
    assert(e1Copy!.popularity === 4, 'duplicate links in one feed bump the syndicated copy exactly once');
}

export async function runDeletedFeedRacePhase(feedA: Feed, now: number) {
    // ---- an in-flight sync of a deleted feed must not resurrect it ----
    await resetDb();
    const feedRace: Feed = { ...feedA, id: 'feed-race', title: 'Race' };
    await putFeed(feedRace);
    const parsedRace: ParsedFeed = {
        title: 'Race',
        items: [{ guid: 'r1', title: 'x', link: 'https://race.example/1', published: now }],
    };
    await deleteFeed('feed-race');
    const raceResult = await ingestFeed(feedRace, parsedRace, feedRace, false);
    assert(raceResult.inserted === 0, 'in-flight ingest of a deleted feed inserts nothing');
    const resurrected = await (await getDb()).get('feeds', 'feed-race');
    assert(resurrected === undefined, 'in-flight ingest does not resurrect a deleted feed');
    assert(
        (await (await getDb()).getAll('articles')).length === 0,
        'in-flight ingest of a deleted feed writes no articles',
    );
}

export async function runErrorSurfacingPhase(feedA: Feed) {
    // ---- sync error surfacing must not resurrect a deleted feed ----
    await resetDb();
    const feedErr: Feed = { ...feedA, id: 'feed-err', title: 'Err' };
    await putFeed(feedErr);
    await updateFeedErrorIfExists('feed-err', 'boom');
    const errFeed = await (await getDb()).get('feeds', 'feed-err');
    assert(errFeed!.lastError === 'boom', 'updateFeedErrorIfExists surfaces sync errors on live feeds');
    await deleteFeed('feed-err');
    await updateFeedErrorIfExists('feed-err', 'boom');
    assert(
        (await (await getDb()).get('feeds', 'feed-err')) === undefined,
        'updateFeedErrorIfExists does not resurrect a deleted feed',
    );
}
