import { readFileSync } from 'node:fs';
import { mergeSavedArticles } from '../src/query';
import { isSharedSnapshotId, sharedLinkFromParams, sharedSnapshot } from '../src/services/shared-links';
import type { SavedArticleSnapshot } from '../src/types';
import { assert } from './smoke-assert';

const direct = sharedLinkFromParams(new URLSearchParams('url=https%3A%2F%2Fexample.com%2Fstory&title=Story'));
assert(direct?.url === 'https://example.com/story', 'share target reads the URL parameter');
assert(direct?.title === 'Story', 'share target keeps the title');

const fromText = sharedLinkFromParams(new URLSearchParams('text=Read%20this%3A%20https%3A%2F%2Fexample.com%2Fpiece.'));
assert(fromText?.url === 'https://example.com/piece', 'share target extracts a URL from shared text');
assert(
    sharedLinkFromParams(new URLSearchParams('url=javascript%3Aalert(1)')) === null,
    'unsafe share URLs are rejected',
);
assert(sharedLinkFromParams(new URLSearchParams('text=no%20link')) === null, 'text without a URL is rejected');

const snapshot = sharedSnapshot({ url: 'https://www.example.com/story?utm_source=share', title: 'Story' }, 1_000);
assert(snapshot.id === 'shared:example.com/story', 'shared snapshots use a stable normalized id');
assert(isSharedSnapshotId(snapshot.id) && !isSharedSnapshotId('a1'), 'local snapshot ids are distinguishable');
assert(
    snapshot.savedAt === 1_000 && snapshot.link === 'https://www.example.com/story?utm_source=share',
    'snapshot keeps the original link and time',
);

const local: SavedArticleSnapshot = { ...snapshot, id: 'shared:local', savedAt: 3 };
const server: SavedArticleSnapshot = { ...snapshot, id: 'server', articleId: 'a1', savedAt: 2 };
const staleLocal: SavedArticleSnapshot = { ...snapshot, id: 'old', articleId: 'a2', savedAt: 1 };
const merged = mergeSavedArticles([server], [local, staleLocal]);
assert(
    merged.map((item) => item.id).join(',') === 'shared:local,server',
    'server sync preserves only local-only snapshots',
);

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as {
    name?: string;
    share_target?: { action?: string; method?: string; params?: Record<string, string> };
};
assert(manifest.name === 'Times Up', 'the installed app uses the Times Up name');
assert(manifest.share_target?.action === './', 'share target launches the app base URL');
assert(manifest.share_target?.method === 'GET', 'share target works before the service worker is installed');
assert(manifest.share_target?.params?.['url'] === 'url', 'share target receives the shared URL');

console.log('smoke-share-target: ok');
