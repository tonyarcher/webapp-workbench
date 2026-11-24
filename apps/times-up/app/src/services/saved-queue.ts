import { fetchSavedArticlesList } from '../query';
import type { Article, SavedArticleSnapshot } from '../types';

/** Adapt a saved row, including a local-only shared link, for reading views. */
export function savedSnapshotToArticle(snapshot: SavedArticleSnapshot): Article {
    const articleId = snapshot.articleId ?? snapshot.id;
    return {
        id: articleId,
        feedId: snapshot.feedId ?? 'saved',
        guid: articleId,
        title: snapshot.title,
        link: snapshot.link,
        author: snapshot.author,
        summary: snapshot.summary,
        content: snapshot.content,
        published: snapshot.published ?? snapshot.savedAt,
        fetchedAt: snapshot.savedAt,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
        snapshotSource:
            snapshot.contentPending && snapshot.articleId
                ? { kind: 'saved', articleId: snapshot.articleId }
                : undefined,
    };
}

/** Snapshots are read-only views; never write article state back from them. */
export function isSnapshotArticle(article: { snapshotSource?: unknown; feedId: string }): boolean {
    return article.snapshotSource !== undefined || article.feedId === 'saved';
}

export async function fetchSavedQueue(): Promise<Article[]> {
    return (await fetchSavedArticlesList()).map(savedSnapshotToArticle);
}
