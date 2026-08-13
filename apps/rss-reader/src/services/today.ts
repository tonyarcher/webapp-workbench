import type {Article, Feed, Folder} from '../types';

export interface TodaySection {
    folder: Folder;
    articles: Article[];
}

/**
 * Group today's articles into per-folder sections. Each folder contributes
 * its `perFolder` hottest articles across all of its feeds; a folder with
 * nothing today is omitted. Section order follows the sidebar `folders`
 * order. Articles of feeds in multiple folders appear in each section.
 */
export function buildTodaySections(
    articles: Article[],
    feeds: Feed[],
    folders: Folder[],
    excludedFolderIds: string[],
    perFolder: number,
): TodaySection[] {
    const feedById = new Map(feeds.map((f) => [f.id, f]));
    const excluded = new Set(excludedFolderIds);
    const buckets = new Map<string, Article[]>();
    for (const article of articles) {
        const feed = feedById.get(article.feedId);
        if (!feed) continue;
        for (const folderId of feed.folderIds) {
            if (excluded.has(folderId)) continue;
            const bucket = buckets.get(folderId);
            if (bucket) bucket.push(article);
            else buckets.set(folderId, [article]);
        }
    }

    const sections: TodaySection[] = [];
    for (const folder of folders) {
        if (excluded.has(folder.id)) continue;
        const bucket = buckets.get(folder.id);
        if (!bucket?.length) continue;
        const hottest = [...bucket]
            .sort((a, b) => b.hot - a.hot || a.id.localeCompare(b.id))
            .slice(0, perFolder);
        sections.push({folder, articles: hottest});
    }
    return sections;
}
