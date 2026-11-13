/**
 * Client-side search over cached article pages and the library. Pure and
 * testable: no DOM, no network. Supports free-text tokens plus operators
 * (A2): author, feed, folder, after, before, has:video, is:starred/unread,
 * min:readtime. Parse on the client, enforce on the server where possible.
 */
import type { Article, Feed, Folder } from '../types';
import { readMinutes } from '../util';
import { filterMutedArticles, loadMuteRules } from './mute-rules';
import { parseVideo } from './video';

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
    folders?: Folder[] | undefined;
    folderFeedIds?: string[] | undefined;
}

export interface SearchOperators {
    authors: string[];
    feeds: string[];
    folders: string[];
    after?: number | undefined; // epoch ms inclusive
    before?: number | undefined; // epoch ms inclusive
    hasVideo?: boolean | undefined;
    isStarred?: boolean | undefined;
    isUnread?: boolean | undefined;
    isRead?: boolean | undefined;
    minReadMinutes?: number | undefined;
}

export interface ParsedSearch {
    text: string;
    tokens: string[];
    operators: SearchOperators;
}

export interface SearchChip {
    key: string;
    label: string;
    value: string;
    insert: string;
}

const RECENT_KEY = 'rss-reader:recent-searches';
const MAX_RECENT = 8;

const OPERATOR_RE = /(^|\s)(author|feed|folder|after|before|has|is|min):(?:"([^"]+)"|(\S+))/gi;

function toDayStartMs(raw: string): number | undefined {
    const s = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    const ms = Date.parse(`${s}T00:00:00Z`);
    return Number.isFinite(ms) ? ms : undefined;
}

function toDayEndMs(raw: string): number | undefined {
    const s = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    const ms = Date.parse(`${s}T23:59:59.999Z`);
    return Number.isFinite(ms) ? ms : undefined;
}

function parseMinRead(raw: string): number | undefined {
    const m = /^(\d+)(m|min|mins|minute|minutes)?$/i.exec(raw.trim());
    if (!m) return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseSearchInput(query: string): ParsedSearch {
    const operators: SearchOperators = { authors: [], feeds: [], folders: [] };
    let text = query;
    text = text.replace(
        OPERATOR_RE,
        (_m, lead: string, key: string, quoted: string | undefined, bare: string | undefined) => {
            const value = (quoted ?? bare ?? '').trim();
            const k = key.toLowerCase();
            if (!value) return String(lead ?? ' ');
            switch (k) {
                case 'author':
                    operators.authors.push(value);
                    break;
                case 'feed':
                    operators.feeds.push(value);
                    break;
                case 'folder':
                    operators.folders.push(value);
                    break;
                case 'after':
                    operators.after = toDayStartMs(value);
                    break;
                case 'before':
                    operators.before = toDayEndMs(value);
                    break;
                case 'has':
                    if (value.toLowerCase() === 'video') operators.hasVideo = true;
                    break;
                case 'is':
                    if (value.toLowerCase() === 'starred') operators.isStarred = true;
                    if (value.toLowerCase() === 'unread') {
                        operators.isUnread = true;
                        operators.isRead = undefined;
                    }
                    if (value.toLowerCase() === 'read') {
                        operators.isRead = true;
                        operators.isUnread = undefined;
                    }
                    break;
                case 'min':
                    // min:readtime:5 or min:5
                    if (/^readtime(?::|=)?(\d+)$/i.test(value)) {
                        const m = /^readtime(?::|=)?(\d+)$/i.exec(value);
                        if (m) operators.minReadMinutes = Number(m[1]);
                    } else {
                        operators.minReadMinutes = parseMinRead(value);
                    }
                    break;
                default:
                    return _m;
            }
            return String(lead ?? ' ');
        },
    );
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return { text: cleaned, tokens: tokenizeText(cleaned), operators };
}

/** Normalize a query into lowercased text tokens (letters/digits, 2+ chars), excluding operators. */
export function parseSearchQuery(query: string): string[] {
    return parseSearchInput(query).tokens;
}

function tokenizeText(text: string): string[] {
    return text
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

function includesAny(hay: string, needles: string[]): boolean {
    if (needles.length === 0) return true;
    const h = hay.toLowerCase();
    return needles.some((n) => h.includes(n.toLowerCase()));
}

function hasVideo(article: Article): boolean {
    if (parseVideo(article.link)) return true;
    const text = `${article.content ?? ''} ${article.summary ?? ''}`;
    // detect common embed iframes/sources in content
    return (
        /<(?:iframe|video|embed|source)\b/i.test(text) ||
        /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|rumble\.com|tiktok\.com/i.test(text)
    );
}

function matchesOperators(
    article: Article,
    feed: Feed | undefined,
    folders: Folder[] | undefined,
    ops: SearchOperators,
): boolean {
    if (ops.isStarred === true && !article.starred) return false;
    if (ops.isUnread === true && article.read !== 0) return false;
    if (ops.isRead === true && article.read === 0) return false;
    if (ops.after !== undefined && article.published < ops.after) return false;
    if (ops.before !== undefined && article.published > ops.before) return false;
    if (ops.authors.length > 0 && !includesAny(article.author ?? '', ops.authors)) return false;
    if (ops.feeds.length > 0) {
        const feedText = feed?.title ?? '';
        if (!includesAny(feedText, ops.feeds)) return false;
    }
    if (ops.folders.length > 0) {
        const folderNames = (folders ?? [])
            .filter((f) => (feed?.folderIds ?? []).includes(f.id))
            .map((f) => f.title)
            .join(' ');
        if (!includesAny(folderNames, ops.folders)) return false;
    }
    if (ops.hasVideo === true && !hasVideo(article)) return false;
    if (ops.minReadMinutes !== undefined && ops.minReadMinutes > 0) {
        const mins = readMinutes(article.content, article.summary);
        if (mins < ops.minReadMinutes) return false;
    }
    return true;
}

/**
 * Rank articles matching all query tokens and operators. Returns sorted by
 * score desc then published desc then id. If there are only operators and no
 * text tokens, all operator-matching articles are returned (score 0, newest first).
 */
export function searchArticles(query: string, corpus: SearchCorpus): SearchResult[] {
    const parsed = parseSearchInput(query);
    const { tokens, operators } = parsed;
    const hasOps =
        operators.authors.length > 0 ||
        operators.feeds.length > 0 ||
        operators.folders.length > 0 ||
        operators.after !== undefined ||
        operators.before !== undefined ||
        operators.hasVideo === true ||
        operators.isStarred === true ||
        operators.isUnread === true ||
        operators.isRead === true ||
        operators.minReadMinutes !== undefined;
    if (tokens.length === 0 && !hasOps) return [];
    const feedById = new Map(corpus.feeds.map((f) => [f.id, f] as const));
    const allowed = corpus.folderFeedIds === undefined ? null : new Set(corpus.folderFeedIds);
    const results: SearchResult[] = [];
    for (const article of corpus.articles) {
        if (allowed && !allowed.has(article.feedId)) continue;
        const feed = feedById.get(article.feedId);
        if (!matchesOperators(article, feed, corpus.folders, operators)) continue;
        const feedTitle = feed?.title;
        if (tokens.length === 0) {
            results.push({ article, score: 0, feedTitle });
            continue;
        }
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
    const muted = new Set(
        filterMutedArticles(
            results.map((r) => r.article),
            loadMuteRules(),
        ).map((a) => a.id),
    );
    return results.filter((r) => muted.has(r.article.id));
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

/** Operator chips for the cheat sheet / query builder. */
export const SEARCH_OPERATOR_CHIPS: SearchChip[] = [
    { key: 'author', label: 'author:', value: 'name', insert: 'author:""' },
    { key: 'feed', label: 'feed:', value: 'name', insert: 'feed:""' },
    { key: 'folder', label: 'folder:', value: 'name', insert: 'folder:""' },
    { key: 'after', label: 'after:', value: 'YYYY-MM-DD', insert: 'after:' },
    { key: 'before', label: 'before:', value: 'YYYY-MM-DD', insert: 'before:' },
    { key: 'has-video', label: 'has:video', value: '', insert: 'has:video ' },
    { key: 'is-starred', label: 'is:starred', value: '', insert: 'is:starred ' },
    { key: 'is-unread', label: 'is:unread', value: '', insert: 'is:unread ' },
    { key: 'min-readtime', label: 'min:readtime:', value: '5', insert: 'min:readtime:5 ' },
];
