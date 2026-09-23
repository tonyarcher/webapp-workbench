// db-smoke migration phases: non-destructive schema upgrade and legacy
// image-column cleanup (HOT_VERSION bump).
import { closeDb, getDb, getFeeds, putFeed } from '../src/db/db';
import { deleteDB, openDB } from 'idb';
import { ingestFeed } from '../src/services/sync';
import type { Article, Feed, ParsedFeed } from '../src/types';
import { assert, resetDb } from './db-smoke-helpers';

export async function runLegacyUpgradePhase() {
    // ---- non-destructive upgrade: legacy data survives reopening ----
    await closeDb();
    await deleteDB('rss-reader');
    const legacy = await openDB('rss-reader', 1, {
        upgrade(db) {
            db.createObjectStore('folders', { keyPath: 'id' });
            db.createObjectStore('feeds', { keyPath: 'id' });
            db.createObjectStore('articles', { keyPath: 'id' });
            db.createObjectStore('meta', { keyPath: 'key' });
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
    assert(
        migrated.length === 1 && migrated[0].folderIds[0] === 'legacy-folder',
        'upgrade preserves legacy feeds (folderId normalized)',
    );
    const legacyArticles = await (await getDb()).getAll('articles');
    assert(legacyArticles.length === 1, 'upgrade preserves legacy articles');
    const legacyFeed = await (await getDb()).get('feeds', 'legacy-feed');
    assert(legacyFeed!.unread === 2, 'upgrade preserves feed counters');
    await closeDb();
    await deleteDB('rss-reader');
    await getDb();
}

export async function runImageDerivationPhase(feedA: Feed) {
    // ---- image is derived from content, not a persisted column ----
    await resetDb();
    const feedImg: Feed = { ...feedA, id: 'feed-img', title: 'Feed Img' };
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
    assert(
        !('image' in (storedWithImg as unknown as Record<string, unknown>)) ||
            (storedWithImg as unknown as { image?: string }).image === undefined,
        'stored article has no persisted image column (derived at render)',
    );
    const { firstImageUrl: cFirst } = await import('../src/services/parser.js');
    assert(
        cFirst(storedWithImg!.content) === 'https://img.example/thumb.jpg',
        'thumbnail derived from content via firstImageUrl',
    );
    const storedEnclosure = await (await getDb()).get('articles', 'feed-img:img-2');
    assert(
        cFirst(storedEnclosure!.content)?.includes('enclosure.jpg') ?? false,
        'enclosure media prepended to content so firstImageUrl finds it',
    );
    assert(
        !('image' in (storedEnclosure as unknown as Record<string, unknown>)) ||
            (storedEnclosure as unknown as { image?: string }).image === undefined,
        'enclosure article also has no persisted image column',
    );

    // recomputeHotIfNeeded must clean legacy image fields and bump HOT_VERSION
    await (
        await getDb()
    ).put('articles', { ...storedWithImg!, image: 'https://legacy.example/old.jpg' } as unknown as Article);
    await (await getDb()).put('meta', { key: 'hot-version', value: 4 });
    const { recomputeHotIfNeeded } = await import('../src/db/db-query.js');
    await recomputeHotIfNeeded();
    const cleaned = await (await getDb()).get('articles', 'feed-img:img-1');
    assert(
        !('image' in (cleaned as unknown as Record<string, unknown>)),
        'recomputeHotIfNeeded removes legacy image field',
    );
    const hv = await (await getDb()).get('meta', 'hot-version');
    assert((hv?.value as number) === 5, 'HOT_VERSION bumped to 5 after image column removal');
}
