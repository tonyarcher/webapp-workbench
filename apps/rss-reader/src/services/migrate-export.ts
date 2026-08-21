import {getDb} from '../db/db';
import type {MigratePayload} from './api';
import type {Article, Feed, Folder} from '../types';

// ---- pure payload builder (testable) ----

export function buildMigratePayload(
    folders: Folder[],
    feeds: Feed[],
    articles: Article[],
    metaEntries: Array<{ key: string; value: unknown }>,
): MigratePayload {
    const feedById = new Map<string, Feed>();
    for (const f of feeds) {
        feedById.set(f.id, f);
    }

    const folderTitleById = new Map<string, string>();
    for (const f of folders) {
        folderTitleById.set(f.id, f.title);
    }

    return {
        folders: folders.map((f) => ({
            title: f.title,
            sortOrder: f.sortOrder,
        })),
        feeds: feeds.map((f) => ({
            url: f.url,
            title: f.title,
            siteUrl: f.siteUrl,
            folderTitles: f.folderIds
                .map((id) => folderTitleById.get(id))
                .filter((t): t is string => t !== undefined),
        })),
        states: articles.map((a) => {
            const feed = feedById.get(a.feedId);
            return {
                feedUrl: feed?.url ?? '',
                guid: a.guid,
                link: a.link,
                read: a.read === 1,
                readAt: undefined,
                starred: a.starred,
            };
        }).filter((s) => s.feedUrl !== ''),
        affinity: metaEntries
            .filter((e) => e.key.startsWith('aff:'))
            .map((e) => ({key: e.key, value: e.value as number})),
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
