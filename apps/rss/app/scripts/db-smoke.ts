// db-smoke: IndexedDB layer smoke for the reader app. Run: `tsx scripts/db-smoke.ts`
// (part of `npm test`). Phases live in sibling ./db-smoke-*.ts modules and run
// in the order below; every assertion prints `ok: ...` and a failure exits 1.
import 'fake-indexeddb/auto';
import { putFeed } from '../src/db/db';
import type { Feed } from '../src/types';
import { runCrudPhase, runSortPhase } from './db-smoke-core';
import {
    runDeletedFeedRacePhase,
    runDuplicateLinkPhase,
    runErrorSurfacingPhase,
    runSyndicationPhase,
} from './db-smoke-ingest';
import { resetDb } from './db-smoke-helpers';
import { runImageDerivationPhase, runLegacyUpgradePhase } from './db-smoke-migration';
import {
    runEqualPublishedPhase,
    runLargeUnreadPhase,
    runRecentArticlesPhase,
    runTodayArticlesPhase,
    runUnreadPaginationPhase,
} from './db-smoke-queries';
import {
    runAtomicMarkReadPhase,
    runFolderDeletePhase,
    runLegacyFolderPhase,
    runMarkReadReconcilePhase,
} from './db-smoke-writes';

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
    await runCrudPhase(now);
    await runSortPhase(now);

    await runSyndicationPhase(feedA, feedB, now);
    await runDuplicateLinkPhase(feedA, feedB, now);
    await runDeletedFeedRacePhase(feedA, now);
    await runErrorSurfacingPhase(feedA);

    await runAtomicMarkReadPhase(feedA);
    await runFolderDeletePhase(feedA);
    await runLegacyFolderPhase();

    await runUnreadPaginationPhase(feedA);
    await runEqualPublishedPhase(feedA);
    await runLegacyUpgradePhase();

    await runMarkReadReconcilePhase(feedA);
    await runRecentArticlesPhase(feedA);
    await runLargeUnreadPhase(feedA);
    await runTodayArticlesPhase(feedA, feedB);
    await runImageDerivationPhase(feedA);

    await resetDb();
    console.log('\nAll db smoke tests passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
