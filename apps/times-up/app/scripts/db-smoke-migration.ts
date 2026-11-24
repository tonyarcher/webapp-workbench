// db-smoke migration phases: non-destructive schema upgrade and legacy
// image-column cleanup (HOT_VERSION bump).
import { clearClientDb, closeDb, getDb, getFeeds, putFeed } from '../src/db/db';
import { type ReaderDB, ensureSchema, migrateLegacyDatabase } from '../src/db/db-base';
import { deleteDB, openDB } from 'idb';
import { ingestFeed } from '../src/services/sync';
import type { Article, Feed, ParsedFeed } from '../src/types';
import { assert, resetDb } from './db-smoke-helpers';

export async function runRenameMigrationPhase() {
    await closeDb();
    await deleteDB('times-up');
    await deleteDB('rss-reader');
    const legacy = await openDB('rss-reader', 1, {
        upgrade(db) {
            db.createObjectStore('folders', { keyPath: 'id' });
            db.createObjectStore('feeds', { keyPath: 'id' });
            db.createObjectStore('articles', { keyPath: 'id' });
            db.createObjectStore('saved', { keyPath: 'id' });
            db.createObjectStore('meta', { keyPath: 'key' });
        },
    });
    await legacy.put('folders', { id: 'legacy-folder', title: 'Legacy folder', createdAt: 1 });
    await legacy.put('feeds', {
        id: 'legacy-renamed-feed',
        title: 'Legacy renamed feed',
        url: 'https://legacy.example/feed',
        folderIds: [],
        unread: 1,
        addedAt: 1,
    });
    await legacy.put('articles', {
        id: 'legacy-renamed-feed:a1',
        feedId: 'legacy-renamed-feed',
        guid: 'a1',
        title: 'Legacy article',
        published: 1,
        fetchedAt: 1,
        read: 0,
        starred: false,
    });
    await legacy.put('saved', { id: 'saved-legacy', title: 'Saved legacy', savedAt: 1 });
    await legacy.put('meta', { key: 'legacy-setting', value: 'kept' });
    legacy.close();
    const current = await openDB<ReaderDB>('times-up', 5, {
        upgrade(db, _oldVersion, _newVersion, tx) {
            ensureSchema(db, tx);
        },
    });
    await current.put('feeds', {
        id: 'legacy-renamed-feed',
        title: 'Newer renamed feed',
        url: 'https://legacy.example/feed',
        folderIds: [],
        unread: 0,
        addedAt: 2,
    });
    current.close();
    await closeDb();
    assert(await migrateLegacyDatabase(), 'the legacy IndexedDB rename is detected');
    const feeds = await getFeeds();
    assert(
        feeds.some((feed) => feed.id === 'legacy-renamed-feed'),
        'database rename preserves feeds',
    );
    assert(
        feeds.find((feed) => feed.id === 'legacy-renamed-feed')?.title === 'Newer renamed feed',
        'database rename keeps newer rows',
    );
    const db = await getDb();
    assert((await db.get('folders', 'legacy-folder'))?.title === 'Legacy folder', 'database rename preserves folders');
    assert(
        (await db.get('articles', 'legacy-renamed-feed:a1'))?.title === 'Legacy article',
        'database rename preserves articles',
    );
    assert((await db.get('saved', 'saved-legacy'))?.title === 'Saved legacy', 'database rename preserves saved rows');
    assert((await db.get('meta', 'legacy-setting'))?.value === 'kept', 'database rename preserves metadata');
    const databases = await indexedDB.databases();
    assert(
        databases.some((database) => database.name === 'rss-reader'),
        'database rename keeps a backup',
    );
    await (await getDb()).delete('feeds', 'legacy-renamed-feed');
    await closeDb();
    const oldTab = await openDB('rss-reader');
    await oldTab.put('saved', { id: 'saved-late', title: 'Late old-tab row', savedAt: 2 });
    oldTab.close();
    assert(await migrateLegacyDatabase(), 'a later launch leaves the completed migration alone');
    assert(
        !(await getFeeds()).some((feed) => feed.id === 'legacy-renamed-feed'),
        'a completed migration does not resurrect a deleted feed',
    );
    const migrated = await getDb();
    assert(
        (await migrated.get('saved', 'saved-late')) === undefined,
        'a completed migration does not replay late legacy writes into active data',
    );
    const backup = await openDB('rss-reader');
    assert(
        (await backup.get('saved', 'saved-late'))?.title === 'Late old-tab row',
        'late legacy rows remain in the backup',
    );
    backup.close();
    await clearClientDb();
    const afterClear = await indexedDB.databases();
    assert(
        !afterClear.some((database) => database.name === 'rss-reader' || database.name === 'times-up'),
        'clearing client data removes both database names',
    );
}

export async function runLegacyUpgradePhase() {
    // ---- non-destructive upgrade: legacy data survives reopening ----
    await closeDb();
    await deleteDB('times-up');
    const legacy = await openDB('times-up', 1, {
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
        migrated.length === 1 && migrated[0]!.folderIds[0]! === 'legacy-folder',
        'upgrade preserves legacy feeds (folderId normalized)',
    );
    const legacyArticles = await (await getDb()).getAll('articles');
    assert(legacyArticles.length === 1, 'upgrade preserves legacy articles');
    const legacyFeed = await (await getDb()).get('feeds', 'legacy-feed');
    assert(legacyFeed!.unread === 2, 'upgrade preserves feed counters');
    await closeDb();
    await deleteDB('times-up');
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
    const { firstImageUrl: cFirst } = await import('../src/services/image.js');
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
