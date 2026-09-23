// Pagination smoke: list caps, rotating feed windows, per-feed share limits.
import { capItems, feedWindow, MAX_LIST_ITEMS, perFeedLimit } from '../src/services/pagination';
import type { Feed } from '../src/types';
import { assert } from './smoke-assert';

// ---- pagination helpers: capItems / feedWindow ----
const overCap = Array.from({ length: MAX_LIST_ITEMS + 5 }, (_, i) => i);
assert(capItems(overCap).length === MAX_LIST_ITEMS, 'capItems caps a list at MAX_LIST_ITEMS');
assert(
    capItems(overCap).every((v, i) => v === i),
    'capItems keeps the head of the list (drops the least-relevant tail)',
);
assert(capItems([1, 2, 3]).length === 3, 'capItems passes through lists under the cap');
assert(capItems(overCap, 20).length === 20, 'capItems honors an explicit page-size cap');
assert(capItems([1, 2, 3], 20).length === 3, 'capItems does not pad when under the page-size cap');
assert(capItems(overCap, 0).length === 0, 'capItems with max 0 returns empty');
assert(capItems(overCap, -1).length === 0, 'capItems with negative max returns empty');

const makeFeed = (id: string): Feed => ({
    id,
    title: id,
    url: `https://${id}.example/rss`,
    folderIds: [],
    unread: 0,
    addedAt: 0,
});
const manyFeeds = Array.from({ length: 10 }, (_, i) => makeFeed(`f${i}`));
const smallFeeds = manyFeeds.slice(0, 3);

assert(feedWindow(smallFeeds, 0, 5) === smallFeeds, 'feedWindow returns feeds unchanged when the set fits the size');
assert(feedWindow(smallFeeds, 7, 5) === smallFeeds, 'feedWindow ignores offset when the set fits the size');
assert(
    feedWindow(manyFeeds, 0, 4)
        .map((f) => f.id)
        .join(',') === 'f0,f1,f2,f3',
    'feedWindow starts at the offset and returns size feeds',
);
assert(
    feedWindow(manyFeeds, 4, 4)
        .map((f) => f.id)
        .join(',') === 'f4,f5,f6,f7',
    'feedWindow advances the window with the offset',
);
assert(
    feedWindow(manyFeeds, 8, 4)
        .map((f) => f.id)
        .join(',') === 'f8,f9,f0,f1',
    'feedWindow wraps around the end of the list',
);
assert(
    feedWindow(manyFeeds, 12, 4)
        .map((f) => f.id)
        .join(',') === 'f2,f3,f4,f5',
    'feedWindow rotates by offset modulo the feed count',
);
const sevenFeeds = Array.from({ length: 7 }, (_, i) => makeFeed(`n${i}`));
const visitedFeeds = new Set<string>();
for (const off of [0, 3, 6]) {
    for (const f of feedWindow(sevenFeeds, off, 3)) visitedFeeds.add(f.id);
}
assert(
    visitedFeeds.size === 7,
    'rotating offsets across the window visit every feed at least once over ceil(n/size) pages',
);
assert(feedWindow(manyFeeds, 0, 20).length === 10, 'feedWindow never returns more feeds than exist');

// ---- per-feed share backfill limit ----
assert(perFeedLimit(50, 1) === 50, 'perFeedLimit one feed fills the page');
assert(perFeedLimit(50, 3) === 17, 'perFeedLimit few feeds share the page (ceil)');
assert(perFeedLimit(50, 50) === 1, 'perFeedLimit one-from-each when feeds == pageSize');
assert(perFeedLimit(50, 200) === 1, 'perFeedLimit never more than one when feeds exceed pageSize');
assert(perFeedLimit(20, 5) === 4, 'perFeedLimit splits 20 across 5 feeds');
assert(perFeedLimit(50, 0) === 0, 'perFeedLimit zero feeds returns 0');
assert(perFeedLimit(0, 3) === 0, 'perFeedLimit zero pageSize returns 0');
