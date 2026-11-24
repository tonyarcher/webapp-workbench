import type { Article, Feed } from '../types';
import { articleKeywordsOf } from './keywords';
import { normalizeLink } from './ranking';

export interface SimilarResult {
    article: Article;
    score: number;
    reasons: string[];
}

/** Rank local corpus rows by word overlap, shared feed, and syndication. */
export function similarArticles(
    target: Article,
    corpus: Article[],
    feeds: Feed[],
    wordMap: Record<string, number>,
    limit = 20,
): SimilarResult[] {
    const targetWords = keywordWeights(target, wordMap);
    const clusters = syndicationClusters(corpus);
    const feedTitles = new Map(feeds.map((feed) => [feed.id, feed.title]));
    const results: SimilarResult[] = [];
    for (const article of corpus) {
        if (article.id === target.id) continue;
        const words = keywordWeights(article, wordMap);
        const shared = [...words.keys()].filter((word) => targetWords.has(word));
        const reasons: string[] = [];
        let score = shared.reduce((sum, word) => sum + Math.max(1, targetWords.get(word) ?? 1), 0);
        if (shared.length) reasons.push(`Shared words: ${shared.slice(0, 3).join(', ')}`);
        if (article.feedId === target.feedId) {
            score += 4;
            reasons.push(`Also in ${feedTitles.get(target.feedId) ?? 'this feed'}`);
        }
        const clusterSize = clusters.get(normalizeLink(article.link ?? '')) ?? 0;
        if (clusterSize > 1) {
            score += Math.min(clusterSize, 5) * 2;
            reasons.push(`Carried by ${clusterSize} feeds`);
        }
        if (score > 0) results.push({ article, score, reasons });
    }
    return results
        .sort(
            (a, b) =>
                b.score - a.score ||
                b.article.published - a.article.published ||
                a.article.id.localeCompare(b.article.id),
        )
        .slice(0, limit);
}

function keywordWeights(article: Article, wordMap: Record<string, number>): Map<string, number> {
    return new Map(
        articleKeywordsOf(article.title, article.summary, article.content, wordMap).map(({ word, score }) => [
            word,
            Math.max(1, score),
        ]),
    );
}

function syndicationClusters(corpus: Article[]): Map<string, number> {
    const feedsByLink = new Map<string, Set<string>>();
    for (const article of corpus) {
        if (!article.link) continue;
        const key = normalizeLink(article.link);
        const feeds = feedsByLink.get(key) ?? new Set<string>();
        feeds.add(article.feedId);
        feedsByLink.set(key, feeds);
    }
    return new Map([...feedsByLink].map(([link, feeds]) => [link, feeds.size]));
}
