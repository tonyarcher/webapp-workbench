// B4 priority inbox. A must-read lane combines learned interest, front-page
// worthiness, and recency. It reads stored metadata only; no article body is
// fetched or uploaded.

import type { Article } from '../types';

export const PRIORITY_THRESHOLD = 0.55;
const DAY_MS = 24 * 60 * 60 * 1000;

export function priorityScore(article: Article, now = Date.now()): number {
    const interest = article.scores?.interest ?? 0;
    const worthy = article.scores?.worthy ?? 0;
    const ageDays = article.published ? Math.max(0, now - article.published) / DAY_MS : 30;
    const recency = Math.exp(-ageDays / 3);
    return 0.45 * interest + 0.35 * worthy + 0.2 * recency;
}

export function isPriorityArticle(article: Article, now = Date.now()): boolean {
    return priorityScore(article, now) >= PRIORITY_THRESHOLD;
}

export function partitionPriorityArticles(
    articles: Article[],
    now = Date.now(),
): { keep: Article[]; hidden: Article[] } {
    const keep: Article[] = [];
    const hidden: Article[] = [];
    for (const article of articles) (isPriorityArticle(article, now) ? keep : hidden).push(article);
    return { keep, hidden };
}
