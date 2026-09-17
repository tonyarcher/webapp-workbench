import {getDb} from '../db/db';
import type {MigratePayload} from './api';
import type {Article, Feed, Folder} from '../types';

// ---- pure payload builder (testable) ----

function feedMapFor(feeds: Feed[]): Map<string, Feed> {
    const m = new Map<string, Feed>();
    for (const f of feeds) m.set(f.id, f);
    return m;
}

function folderTitleMap(folders: Folder[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.title);
    return m;
}

function payloadFeeds(feeds: Feed[], folderTitleById: Map<string, string>) {
    return feeds.map((f) => ({url: f.url, title: f.title, siteUrl: f.siteUrl, folderTitles: f.folderIds.map((id) => folderTitleById.get(id)).filter((t): t is string => t !== undefined)}));
}

function payloadStates(articles: Article[], feedById: Map<string, Feed>) {
    return articles.map((a) => ({feedUrl: feedById.get(a.feedId)?.url ?? '', guid: a.guid, link: a.link, read: a.read === 1, readAt: undefined, starred: a.starred})).filter((s) => s.feedUrl !== '');
}

function payloadAffinity(metaEntries: Array<{key: string; value: unknown}>) {
    return metaEntries.filter((e) => e.key.startsWith('aff:')).map((e) => ({key: e.key, value: e.value as number}));
}

export function buildMigratePayload(
    folders: Folder[],
    feeds: Feed[],
    articles: Article[],
    metaEntries: Array<{key: string; value: unknown}>,
): MigratePayload {
    const feedById = feedMapFor(feeds);
    const folderTitleById = folderTitleMap(folders);
    return {
        folders: folders.map((f) => ({title: f.title, sortOrder: f.sortOrder})),
        feeds: payloadFeeds(feeds, folderTitleById),
        states: payloadStates(articles, feedById),
        affinity: payloadAffinity(metaEntries),
    };
}

// ---- IndexedDB reader ----

export async function readIdbForMigration(): Promise<{
    folders: Folder[];
    feeds: Feed[];
    articles: Article[];
    metaEntries: Array<{ key: string; value: unknown }>;
}> {
    const db = await getDb();
    const [folders, feeds, articles, metaEntries] = await Promise.all([
        db.getAll('folders'),
        db.getAll('feeds'),
        db.getAll('articles'),
        db.getAll('meta'),
    ]);
    return {folders, feeds, articles, metaEntries};
}
