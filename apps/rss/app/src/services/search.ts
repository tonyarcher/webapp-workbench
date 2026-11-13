/**
 * Client-side search over cached article pages and the library. Pure and
 * testable: no DOM, no network. A1 starts with an in-memory index over
 * TanStack article-page caches; a server endpoint and deeper indexing follow.
 */
import type { Article, Feed } from '../types';

export interface SearchScope {
    kind: 'all' | 'folder' | 'feed';
    id?: string | undefined;
}

export interface SearchResult {
    article: Article;
    score: number;
    feedTitle?: string | undefined;
}

export interface SearchCorpus {
    articles: Article[];
    feeds: Feed[];
    folderFeedIds?: string[] | undefined;
}

const RECENT_KEY = 'rss-reader:recent-searches';
const MAX_RECENT = 8;

/** Normalize a query into lowercased tokens (letters/digits, 2+ chars). */
export function parseSearchQuery(query: string): string[] {
    return query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
}

function haystack(article: Article, feedTitle: string | undefined): string {
    return [article.title, article.summary, article.content, article.author, feedTitle]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join(' ')
        .toLowerCase();
}

function tokenVariants(token: string): string[] {
    const variants = [token];
    if (token.endsWith('ies') && token.length > 4) variants.push(`${token.slice(0, -3)}y`);
    if (token.endsWith('y') && token.length > 3) variants.push(`${token.slice(0, -1)}ies`);
    if (token.endsWith('es') && token.length > 4) variants.push(token.slice(0, -2));
    if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) variants.push(token.slice(0, -1));
    if (!token.endsWith('s') && token.length > 2) variants.push(`${token}s`);
    return variants;
}

function fieldScore(field: string, token: string): number {
    if (!field) return 0;
    for (const v of tokenVariants(token)) {
        if (field.includes(v)) return 1;
    }
    return 0;
}

/**
 * Rank articles matching all query tokens. Title/feed-name hits score higher
 * than body/author hits. Returns a new array sorted by score desc then
 * published desc then id.
 */
export function searchArticles(query: string, corpus: SearchCorpus): SearchResult[] {
    const tokens = parseSearchQuery(query);
    if (tokens.length === 0) return [];
    const feedById = new Map(corpus.feeds.map((f) => [f.id, f] as const));
    const allowed = corpus.folderFeedIds === undefined ? null : new Set(corpus.folderFeedIds);
    const results: SearchResult[] = [];
    for (const article of corpus.articles) {
        if (allowed && !allowed.has(article.feedId)) continue;
        const feedTitle = feedById.get(article.feedId)?.title;
        const text = haystack(article, feedTitle);
        const title = article.title.toLowerCase();
        const feedName = (feedTitle ?? '').toLowerCase();
        const author = (article.author ?? '').toLowerCase();
        let score = 0;
        let allMatch = true;
        for (const token of tokens) {
            if (fieldScore(text, token) === 0) {
                allMatch = false;
                break;
            }
            if (fieldScore(title, token)) score += 5;
            if (fieldScore(feedName, token)) score += 4;
            if (fieldScore(author, token)) score += 2;
            score += 1;
        }
        if (!allMatch) continue;
        results.push({ article, score, feedTitle });
    }
    results.sort(
        (a, b) =>
            b.score - a.score ||
            b.article.published - a.article.published ||
            (a.article.id < b.article.id ? -1 : a.article.id > b.article.id ? 1 : 0),
    );
    return results;
}

export function loadRecentSearches(): string[] {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

export function saveRecentSearch(query: string): string[] {
    const q = query.trim();
    if (!q) return loadRecentSearches();
    const next = [q, ...loadRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT);
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        // storage unavailable
    }
    return next;
}

export function clearRecentSearches(): void {
    try {
        localStorage.removeItem(RECENT_KEY);
    } catch {
        // storage unavailable
    }
}
