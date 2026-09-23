// db-smoke write phases: atomic mark-read, folder deletes (incl. legacy feeds),
// bulk mark-read helpers, and unread counter reconciliation.
import {
    deleteFolderTx,
    getDb,
    markArticleReadTx,
    markArticlesRead,
    markReadBefore,
    putFeed,
    putFolder,
    queryArticles,
    reconcileUnreadCounts,
    setArticleRead,
    upsertArticles,
} from '../src/db/db';
import type { Feed, Folder } from '../src/types';
import { assert, makeArticle, resetDb } from './db-smoke-helpers';

export async function runAtomicMarkReadPhase(feedA: Feed) {
    // ---- atomic mark-read: concurrent calls decrement unread once ----
    await resetDb();
    const feedR: Feed = { ...feedA, id: 'feed-r', title: 'Feed R', unread: 2 };
    await putFeed(feedR);
    await upsertArticles([
        makeArticle('feed-r', 'r1', Date.now() - 1_000, 0),
        makeArticle('feed-r', 'r2', Date.now() - 2_000, 0),
    ]);
    const [first, second] = await Promise.all([markArticleReadTx('feed-r:r1'), markArticleReadTx('feed-r:r1')]);
    assert(first !== second, 'concurrent mark-read: only one caller flips the article');
    const rFeed = await (await getDb()).get('feeds', 'feed-r');
    assert(rFeed!.unread === 1, 'concurrent mark-read decrements unread exactly once');
    const rArticle = await (await getDb()).get('articles', 'feed-r:r1');
    assert(rArticle!.read === 1, 'concurrent mark-read marks the article read');
}

export async function runFolderDeletePhase(feedA: Feed) {
    // ---- atomic folder delete: folder and memberships removed together ----
    await resetDb();
    const folderX: Folder = { id: 'folder-x', title: 'X', createdAt: 1 };
    await putFolder(folderX);
    const feedFx: Feed = {
        ...feedA,
        id: 'feed-fx',
        url: 'https://fx.example/rss',
        folderIds: ['folder-x'],
        unread: 0,
        addedAt: 1,
    };
    await putFeed(feedFx);
    await deleteFolderTx('folder-x');
    const foldersAfter = await (await getDb()).getAll('folders');
    assert(!foldersAfter.some((f) => f.id === 'folder-x'), 'deleteFolderTx removes the folder');
    const fxAfter = await (await getDb()).get('feeds', 'feed-fx');
    assert(fxAfter!.folderIds.length === 0, 'deleteFolderTx strips folder membership from feeds');
}

export async function runLegacyFolderPhase() {
    // ---- folder deletion on legacy (folderId-only) feeds must not crash ----
    await resetDb();
    const legacyFolder: Folder = { id: 'legacy-folder-x', title: 'LegacyX', createdAt: 1 };
    await putFolder(legacyFolder);
    await (
        await getDb()
    ).put('feeds', {
        id: 'feed-legacy-x',
        title: 'Legacy Feed',
        url: 'https://legacyx.example/rss',
        folderId: 'legacy-folder-x',
        unread: 0,
        addedAt: 1,
    } as unknown as Feed);
    await deleteFolderTx('legacy-folder-x');
    const foldersAfterLegacy = await (await getDb()).getAll('folders');
    assert(
        !foldersAfterLegacy.some((f) => f.id === 'legacy-folder-x'),
        'deleteFolderTx handles legacy folder deletion',
    );
    const lx = await (await getDb()).get('feeds', 'feed-legacy-x');
    assert(
        lx != null && Array.isArray(lx.folderIds) && lx.folderIds.length === 0,
        'deleteFolderTx normalizes legacy feeds and strips membership',
    );
}

export async function runMarkReadReconcilePhase(feedA: Feed) {
    // ---- markArticlesRead / markReadBefore ----
    await resetDb();
    const feedG: Feed = { ...feedA, id: 'feed-g', title: 'Feed G' };
    await putFeed(feedG);
    const mNow = Date.now();
    await upsertArticles([
        makeArticle('feed-g', 'g1', mNow - 1_000, 0),
        makeArticle('feed-g', 'g2', mNow - 2_000, 0),
        makeArticle('feed-g', 'g3', mNow - 3_000, 1),
        makeArticle('feed-g', 'g4', mNow - 4_000, 0),
    ]);
    await markArticlesRead(['feed-g:g1', 'feed-g:g4', 'feed-g:g3']);
    const gAfter = await queryArticles({ feedId: 'feed-g', limit: 100 });
    assert(
        ['feed-g:g1', 'feed-g:g4', 'feed-g:g3'].every((id) => gAfter.items.find((a) => a.id === id)?.read === 1),
        'markArticlesRead sets listed articles read',
    );
    const gUnread = await queryArticles({ feedId: 'feed-g', unreadOnly: true, limit: 100 });
    assert(
        gUnread.items.length === 1 && gUnread.items[0].id === 'feed-g:g2',
        'markArticlesRead keeps other articles unread',
    );

    await markReadBefore('feed-g', mNow - 1_500);
    const gRemaining = await queryArticles({ feedId: 'feed-g', unreadOnly: true, limit: 100 });
    assert(gRemaining.items.length === 0, 'markReadBefore marks older-than-cutoff read for a feed');

    await setArticleRead('feed-g:g1', 0);
    await markReadBefore(undefined, mNow);
    const allAfter = await queryArticles({ unreadOnly: true, limit: 100 });
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
}
