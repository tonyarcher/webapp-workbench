// Smoke suite for the Lemmy/PieFed reader: `tsx scripts/smoke.ts`
// (part of `npm test`). Phases live in sibling ./smoke-*.ts modules and run in
// the order below; any failure throws and rethrows out of the async run.
import { runAuthHeaderTests, runLoginTests } from './smoke-auth';
import {
    runFormatTests,
    runNsfwFilterTests,
    runRegistryTests,
    runRouterTests,
    runSortsTests,
    runUrlSafetyTests,
} from './smoke-client';
import {
    runCommunityByIdTests,
    runCommunityNsfwTests,
    runErrorMappingTests,
    runInstanceUrlTests,
    runPostsTests,
    runSiteCommunityTests,
} from './smoke-lemmy-api';
import { runEmbedProviderTests, runPostMediaTests, runYoutubeEmbedTests } from './smoke-media';
import { runPiefedTests } from './smoke-piefed-api';

runInstanceUrlTests();

void (async () => {
    await runPostsTests();

    await runSiteCommunityTests();

    await runPiefedTests();

    await runCommunityByIdTests();

    await runAuthHeaderTests();

    await runLoginTests();

    await runRegistryTests();

    runNsfwFilterTests();

    runFormatTests();

    runRouterTests();

    runPostMediaTests();

    runEmbedProviderTests();

    runYoutubeEmbedTests();

    runUrlSafetyTests();

    await runErrorMappingTests();

    await runCommunityNsfwTests();

    runSortsTests();

    console.log('smoke.ts: all assertions passed');
})().catch((e) => {
    console.error(e);
    throw e;
});
