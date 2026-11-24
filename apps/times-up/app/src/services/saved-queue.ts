import { fetchSavedArticlesList } from '../query';
import type { Article, SavedArticleSnapshot } from '../types';

/** Adapt a saved row, including a local-only shared link, for reading views. */
export function savedSnapshotToArticle(snapshot: SavedArticleSnapshot): Article {
    return {
        id: snapshot.articleId ?? snapshot.id,
        feedId: snapshot.feedId ?? 'saved',
        guid: snapshot.articleId ?? snapshot.id,
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
    };
}

export async function fetchSavedQueue(): Promise<Article[]> {
    return (await fetchSavedArticlesList()).map(savedSnapshotToArticle);
}
