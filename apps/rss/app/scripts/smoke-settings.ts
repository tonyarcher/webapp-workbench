// Settings smoke: sync keys, Today-view settings persistence, Today sections.
import { allSyncKey, isSetSyncKey, setKeyIncludesFeed } from '../src/services/sync-keys';
import {
    DEFAULT_PER_FOLDER,
    loadTodaySettings,
    pruneTodaySettings,
    saveTodaySettings,
} from '../src/services/today-settings';
import { buildTodaySections } from '../src/services/today';
import type { Article } from '../src/types';
import { assert } from './smoke-assert';

// ---- sync keys ----
assert(allSyncKey() === 'all', 'allSyncKey() keys the whole-library sync');
assert(allSyncKey(undefined) === 'all', 'allSyncKey(undefined) keys the whole-library sync');
assert(allSyncKey([]) === null, 'allSyncKey([]) is null so an empty folder cannot claim the global slot');
assert(allSyncKey(['b', 'a']) === allSyncKey(['a', 'b']), 'set keys are order-independent');
assert(allSyncKey(['b', 'a']) === 'set:a\0b', 'set keys are sorted and NUL-joined');
assert(setKeyIncludesFeed(allSyncKey(['a', 'b'])!, 'a') === true, 'set key includes a member id');
assert(setKeyIncludesFeed(allSyncKey(['a', 'b'])!, 'c') === false, 'set key excludes a non-member id');
assert(setKeyIncludesFeed('all', 'a') === false, 'the all key never claims a specific feed');
assert(isSetSyncKey('all') === false, 'the all key is not a feed-set key');
assert(isSetSyncKey(allSyncKey(['a'])!) === true, 'a set key is a feed-set key');

// ---- today settings ----
const defaults = loadTodaySettings();
assert(defaults.excludedFolderIds.length === 0, 'today settings default to all folders included');
assert(defaults.perFolder === DEFAULT_PER_FOLDER, 'today settings default per-folder amount');

const mem = new Map<string, string>();
const gStorage = globalThis as Record<string, unknown>;
gStorage.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
};
saveTodaySettings({ excludedFolderIds: ['a', 'b'], perFolder: 3, unreadOnly: true, listView: 'cards' });
const roundTrip = loadTodaySettings();
assert(roundTrip.excludedFolderIds.join(',') === 'a,b', 'today settings save/load round trip');
assert(roundTrip.perFolder === 3, 'today settings round trip keeps the amount');
assert(roundTrip.unreadOnly === true, 'today settings round trip keeps unread-only');
assert(roundTrip.listView === 'cards', 'today settings round trip keeps list view');

mem.set('rss-reader:today-settings', JSON.stringify({ excludedFolderIds: ['a'], perFolder: 7 }));
assert(loadTodaySettings().perFolder === DEFAULT_PER_FOLDER, 'today settings clamp an unknown amount');

const pruned = pruneTodaySettings(
    { excludedFolderIds: ['a', 'b'], perFolder: 5, unreadOnly: false, listView: 'detailed' },
    ['a', 'c'],
);
assert(pruned.excludedFolderIds.join(',') === 'a', 'today settings prune deleted folder ids');

// ---- today sections ----
const mkArticle = (id: string, feedId: string, hot: number): Article => ({
    id,
    feedId,
    guid: id,
    title: id,
    link: `https://example.com/${id}`,
    published: 0,
    fetchedAt: 0,
    read: 0,
    starred: false,
    popularity: 1,
    hot,
});
const folder1 = { id: 'f1', title: 'Tech', createdAt: 0 };
const folder2 = { id: 'f2', title: 'News', createdAt: 0 };
const tFeedA = { id: 'fa', title: 'A', url: 'https://a.example/rss', folderIds: ['f1'], unread: 0, addedAt: 0 };
const tFeedB = { id: 'fb', title: 'B', url: 'https://b.example/rss', folderIds: ['f2'], unread: 0, addedAt: 0 };
const tFeedC = { id: 'fc', title: 'C', url: 'https://c.example/rss', folderIds: ['f1', 'f2'], unread: 0, addedAt: 0 };
const dayArticles = [
    mkArticle('a1', 'fa', 10),
    mkArticle('a2', 'fa', 5),
    mkArticle('a3', 'fa', 1),
    mkArticle('b1', 'fb', 7),
    mkArticle('c1', 'fc', 9),
];

const allSections = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 2);
assert(allSections.length === 2, 'today sections cover both folders');
assert(
    allSections[0].folder.id === 'f1' && allSections[1].folder.id === 'f2',
    'today sections keep sidebar folder order',
);
assert(allSections[0].articles.map((a) => a.id).join(',') === 'a1,c1', 'today section takes the hottest per folder');
assert(
    allSections[1].articles.map((a) => a.id).join(',') === 'c1,b1',
    'today section interleaves shared-feed articles by hot',
);

const excludedSections = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], ['f2'], 2);
assert(excludedSections.length === 1 && excludedSections[0].folder.id === 'f1', 'today sections skip excluded folders');

const oneEach = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 1);
assert(oneEach[0].articles.length === 1 && oneEach[0].articles[0].id === 'a1', 'today per-folder amount is honored');
assert(oneEach[1].articles[0].id === 'c1', 'today per-folder amount applies to every folder');

const emptySections = buildTodaySections([], [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 5);
assert(emptySections.length === 0, 'today sections omit folders with no articles today');
assert(
    buildTodaySections(dayArticles, [tFeedA], [folder1], [], 5).length === 1,
    'today sections drop articles of unknown feeds',
);

const mixedRead = dayArticles.map((a) => (a.id === 'a1' ? { ...a, read: 1 as const } : a));
const unreadOnly = buildTodaySections(mixedRead, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 2, true);
assert(
    unreadOnly[0].articles.map((a) => a.id).join(',') === 'c1,a2',
    'today unread-only skips read articles before taking the per-folder quota',
);
