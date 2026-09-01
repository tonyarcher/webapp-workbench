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
function bucketArticles(articles: Article[], feedById: Map<string, Feed>, excluded: Set<string>, unreadOnly: boolean): Map<string, Article[]> {
    const buckets = new Map<string, Article[]>();
    for (const article of articles) {
        if (unreadOnly && article.read !== 0) continue;
        const feed = feedById.get(article.feedId);
        if (!feed) continue;
        for (const folderId of feed.folderIds) {
            if (excluded.has(folderId)) continue;
            const b = buckets.get(folderId);
            if (b) b.push(article);
            else buckets.set(folderId, [article]);
        }
    }
    return buckets;
}

function orderSections(folders: Folder[], buckets: Map<string, Article[]>, excluded: Set<string>, perFolder: number): TodaySection[] {
    const sections: TodaySection[] = [];
    for (const folder of folders) {
        if (excluded.has(folder.id)) continue;
        const bucket = buckets.get(folder.id);
        if (!bucket?.length) continue;
        const hottest = [...bucket].sort((a, b) => b.hot - a.hot || a.id.localeCompare(b.id)).slice(0, perFolder);
        sections.push({folder, articles: hottest});
    }
    return sections;
}

export function buildTodaySections(
    articles: Article[],
    feeds: Feed[],
    folders: Folder[],
    excludedFolderIds: string[],
    perFolder: number,
    unreadOnly = false,
): TodaySection[] {
    const feedById = new Map(feeds.map((f) => [f.id, f]));
    const excluded = new Set(excludedFolderIds);
    const buckets = bucketArticles(articles, feedById, excluded, unreadOnly);
    return orderSections(folders, buckets, excluded, perFolder);
}
