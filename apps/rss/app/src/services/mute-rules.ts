import type { Article } from '../types';

export type MuteMatch = 'title' | 'body' | 'either';

export interface MuteRule {
    id: string;
    /** Words or phrases to match; any non-empty term can mute. */
    terms: string[];
    match: MuteMatch;
    enabled: boolean;
}

const MUTE_RULES_KEY = 'rss-reader:mute-rules';

function isMuteMatch(value: unknown): value is MuteMatch {
    return value === 'title' || value === 'body' || value === 'either';
}

function normalizeTerms(terms: unknown): string[] {
    if (!Array.isArray(terms)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const t of terms) {
        if (typeof t !== 'string') continue;
        const clean = t.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(clean);
    }
    return out;
}

export function loadMuteRules(): MuteRule[] {
    try {
        const raw = localStorage.getItem(MUTE_RULES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        const out: MuteRule[] = [];
        for (const item of parsed) {
            if (typeof item !== 'object' || item === null) continue;
            const row = item as Record<string, unknown>;
            const id = typeof row['id'] === 'string' ? row['id'] : '';
            const terms = normalizeTerms(row['terms']);
            const match = isMuteMatch(row['match']) ? row['match'] : 'either';
            const enabled = row['enabled'] !== false;
            if (!id || terms.length === 0) continue;
            out.push({ id, terms, match, enabled });
        }
        return out;
    } catch {
        return [];
    }
}

export function saveMuteRules(rules: MuteRule[]): void {
    try {
        localStorage.setItem(MUTE_RULES_KEY, JSON.stringify(rules));
    } catch {
        // storage unavailable; rules just won't persist
    }
}

export function createMuteRuleId(): string {
    return `mute:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/** True when any enabled rule matches the article (any term match mutes). */
export function isMutedArticle(article: Article, rules: MuteRule[]): boolean {
    if (rules.length === 0) return false;
    const enabled = rules.filter((r) => r.enabled && r.terms.length > 0);
    if (enabled.length === 0) return false;
    const title = (article.title ?? '').toLowerCase();
    const body = `${article.summary ?? ''} ${article.content ?? ''}`.toLowerCase();
    const either = `${title} ${body}`;
    for (const rule of enabled) {
        const haystack = rule.match === 'title' ? title : rule.match === 'body' ? body : either;
        for (const term of rule.terms) {
            const needle = term.toLowerCase();
            if (needle && haystack.includes(needle)) return true;
        }
    }
    return false;
}

export function filterMutedArticles<T extends Article>(articles: T[], rules: MuteRule[]): T[] {
    if (rules.length === 0) return articles;
    if (!rules.some((r) => r.enabled && r.terms.length > 0)) return articles;
    return articles.filter((a) => !isMutedArticle(a, rules));
}

/** Parse user-entered terms from comma/newline-separated text. */
export function parseMuteTerms(input: string): string[] {
    return normalizeTerms(input.split(/[\n,]+/));
}
