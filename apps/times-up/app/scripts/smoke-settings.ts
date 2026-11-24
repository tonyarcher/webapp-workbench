// Settings smoke: sync keys, Today-view settings persistence, Today sections.
import { allSyncKey, isSetSyncKey, setKeyIncludesFeed } from '../src/services/sync-keys';
import {
    DEFAULT_PER_FOLDER,
    loadTodaySettings,
    pruneTodaySettings,
    saveTodaySettings,
} from '../src/services/today-settings';
import { buildTodaySections } from '../src/services/today';
import { viewKeyOf } from '../src/web-components/article-list/article-list-helpers';
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
gStorage['localStorage'] = {
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

mem.set('times-up:today-settings', JSON.stringify({ excludedFolderIds: ['a'], perFolder: 7 }));
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
    allSections[0]!.folder.id === 'f1' && allSections[1]!.folder.id === 'f2',
    'today sections keep sidebar folder order',
);
assert(allSections[0]!.articles.map((a) => a.id).join(',') === 'a1,c1', 'today section takes the hottest per folder');
assert(
    allSections[1]!.articles.map((a) => a.id).join(',') === 'c1,b1',
    'today section interleaves shared-feed articles by hot',
);

const excludedSections = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], ['f2'], 2);
assert(
    excludedSections.length === 1 && excludedSections[0]!.folder.id === 'f1',
    'today sections skip excluded folders',
);

const oneEach = buildTodaySections(dayArticles, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 1);
assert(oneEach[0]!.articles.length === 1 && oneEach[0]!.articles[0]!.id === 'a1', 'today per-folder amount is honored');
assert(oneEach[1]!.articles[0]!.id === 'c1', 'today per-folder amount applies to every folder');

const emptySections = buildTodaySections([], [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 5);
assert(emptySections.length === 0, 'today sections omit folders with no articles today');
assert(
    buildTodaySections(dayArticles, [tFeedA], [folder1], [], 5).length === 1,
    'today sections drop articles of unknown feeds',
);

const mixedRead = dayArticles.map((a) => (a.id === 'a1' ? { ...a, read: 1 as const } : a));
const unreadOnly = buildTodaySections(mixedRead, [tFeedA, tFeedB, tFeedC], [folder1, folder2], [], 2, true);
assert(
    unreadOnly[0]!.articles.map((a) => a.id).join(',') === 'c1,a2',
    'today unread-only skips read articles before taking the per-folder quota',
);

// ---- per-view settings persist the reading toggles, including mark-on-scroll ----
{
    const { loadViewSettingsFor, saveViewSettingsFor } =
        await import('../src/web-components/article-list/article-list-helpers');
    const host = {
        view: { kind: 'folder', id: 'f9' },
        listView: 'headline',
        sort: 'newest',
        pageSize: 20,
        maxCardCols: 2,
        unreadOnly: true,
        hideRead: true,
        markOnScroll: true,
        updateCols: () => {},
    } as const;
    saveViewSettingsFor(host as never);
    const restored: {
        view: { kind: string; id: string };
        listView: string;
        sort: string;
        pageSize: number;
        maxCardCols: number;
        unreadOnly: boolean;
        hideRead: boolean;
        markOnScroll: boolean;
        updateCols: () => void;
    } = {
        view: { kind: 'folder', id: 'f9' },
        listView: 'detailed',
        sort: 'hot',
        pageSize: 50,
        maxCardCols: 4,
        unreadOnly: false,
        hideRead: false,
        markOnScroll: false,
        updateCols: () => {},
    };
    loadViewSettingsFor(restored as never);
    assert(restored.markOnScroll === true, 'view settings round-trip the mark-on-scroll toggle');
    assert(restored.unreadOnly === true, 'view settings round-trip the unread filter');
    assert(restored.hideRead === false, 'normal views keep hide-read transient, not persisted');
    assert(restored.listView === 'headline', 'view settings round-trip the list view');

    const interesting = {
        view: { kind: 'interesting', id: 'f9' },
        listView: 'headline',
        sort: 'hot',
        pageSize: 50,
        maxCardCols: 4,
        unreadOnly: true,
        hideRead: true,
        markOnScroll: false,
        updateCols: () => {},
    } as const;
    saveViewSettingsFor(interesting as never);
    const restoredInteresting: {
        view: { kind: string; id: string };
        listView: string;
        sort: string;
        pageSize: number;
        maxCardCols: number;
        unreadOnly: boolean;
        hideRead: boolean;
        markOnScroll: boolean;
        updateCols: () => void;
    } = {
        view: { kind: 'interesting', id: 'f9' },
        listView: 'detailed',
        sort: 'hot',
        pageSize: 50,
        maxCardCols: 4,
        unreadOnly: false,
        hideRead: false,
        markOnScroll: false,
        updateCols: () => {},
    };
    loadViewSettingsFor(restoredInteresting as never);
    assert(restoredInteresting.hideRead === true, 'Interesting views persist the hide-read filter');
    assert(restoredInteresting.unreadOnly === false, 'Interesting views never persist the unread filter');
    const other: {
        view: { kind: string; id: string };
        listView: string;
        sort: string;
        pageSize: number;
        maxCardCols: number;
        unreadOnly: boolean;
        hideRead: boolean;
        markOnScroll: boolean;
        updateCols: () => void;
    } = {
        view: { kind: 'folder', id: 'other' },
        listView: 'detailed',
        sort: 'hot',
        pageSize: 50,
        maxCardCols: 4,
        unreadOnly: false,
        hideRead: false,
        markOnScroll: false,
        updateCols: () => {},
    };
    loadViewSettingsFor(other as never);
    assert(other.markOnScroll === false, 'mark-on-scroll defaults off for untouched views');
    assert(other.hideRead === false, 'hide-read defaults off for untouched views');
    assert(viewKeyOf({ kind: 'all' }) === 'all', 'the all view keeps its settings bucket');
}

// ---- reading defaults apply to every view until a view saves its own ----
{
    const {
        applyDefaultToAllViews,
        DEFAULT_VIEW_SETTINGS,
        loadViewSettingsFor,
        normalizeViewSettings,
        readDefaultViewSettings,
        readViewSettingsFor,
        saveDefaultViewSettings,
        saveViewSettingsFor,
    } = await import('../src/web-components/article-list/article-list-helpers');

    mem.delete('times-up:view-settings');
    mem.delete('times-up:default-view-settings');

    assert(readDefaultViewSettings().listView === 'detailed', 'reading defaults start as Detailed');
    assert(
        readDefaultViewSettings().pageSize === DEFAULT_VIEW_SETTINGS.pageSize,
        'reading defaults use the built-in page size',
    );

    saveDefaultViewSettings({
        ...DEFAULT_VIEW_SETTINGS,
        listView: 'cards',
        pageSize: 20,
        maxCardCols: 2,
        unreadOnly: true,
        hideRead: true,
    });
    assert(readDefaultViewSettings().listView === 'cards', 'reading defaults round-trip the list view');
    assert(readDefaultViewSettings().maxCardCols === 2, 'reading defaults round-trip the card columns');
    assert(readDefaultViewSettings().hideRead === true, 'reading defaults round-trip the hide-read filter');

    const freshHost = () => ({
        view: { kind: 'folder' as 'folder' | 'feed' | 'interesting', id: 'fresh' },
        listView: 'detailed' as 'detailed' | 'headline' | 'cards',
        sort: 'hot' as 'hot' | 'newest' | 'oldest',
        pageSize: 50,
        maxCardCols: 4,
        unreadOnly: false,
        hideRead: false,
        markOnScroll: false,
        updateCols: () => {},
    });
    const fresh = freshHost();
    loadViewSettingsFor(fresh as never);
    assert(fresh.listView === 'cards', 'an untouched view picks up the reading defaults');
    assert(fresh.unreadOnly === true, 'an untouched view picks up the default unread filter');
    assert(fresh.hideRead === false, 'normal views ignore the default hide-read filter');

    const own = freshHost();
    saveViewSettingsFor({ ...own, view: { kind: 'feed', id: 'own' }, listView: 'headline', pageSize: 100 } as never);
    loadViewSettingsFor(own as never);
    assert(own.listView === 'cards', 'a different untouched view still uses the defaults');

    const overridden = freshHost();
    overridden.view = { kind: 'feed', id: 'own' };
    loadViewSettingsFor(overridden as never);
    assert(overridden.listView === 'headline', 'a view with its own settings keeps them');
    assert(overridden.pageSize === 100, 'a view with its own settings keeps its page size');

    applyDefaultToAllViews({
        ...DEFAULT_VIEW_SETTINGS,
        listView: 'headline',
        sort: 'newest',
        pageSize: 50,
        maxCardCols: 3,
        unreadOnly: false,
        hideRead: false,
    });
    const afterApply = freshHost();
    afterApply.view = { kind: 'feed', id: 'own' };
    loadViewSettingsFor(afterApply as never);
    assert(afterApply.listView === 'headline', 'apply to all views clears the per-view override');
    assert(afterApply.sort === 'newest', 'apply to all views writes the new default sort');

    const interestingSettings = readViewSettingsFor({ kind: 'interesting', id: 'fresh' });
    assert(interestingSettings.listView === 'headline', 'Interesting views use the reading defaults');
    assert(interestingSettings.unreadOnly === false, 'Interesting views use the default unread filter');
    assert(interestingSettings.hideRead === false, 'Interesting views use the default hide-read filter');

    const clamped = normalizeViewSettings({
        listView: 'bogus' as never,
        pageSize: 999,
        maxCardCols: 99,
        sort: 'bad' as never,
    });
    assert(clamped.listView === 'detailed' && clamped.pageSize === 50, 'invalid list view and page size fall back');
    assert(clamped.maxCardCols === 6 && clamped.sort === 'hot', 'invalid card columns and sort fall back');
}
