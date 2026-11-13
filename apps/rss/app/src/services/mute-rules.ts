import type { Article } from '../types';

export type MuteMatch = 'title' | 'body' | 'either';
export type MuteScope = { kind: 'all' } | { kind: 'folders'; folderIds: string[] };

export interface MuteRule {
    id: string;
    /** Words or phrases to match; any non-empty term can mute. */
    terms: string[];
    match: MuteMatch;
    enabled: boolean;
    scope: MuteScope;
}

export type FeedFolderLookup = ReadonlyMap<string, readonly string[]> | Record<string, readonly string[]>;

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

function normalizeScope(scope: unknown): MuteScope {
    if (typeof scope !== 'object' || scope === null) return { kind: 'all' };
    const row = scope as Record<string, unknown>;
    if (row['kind'] === 'folders' && Array.isArray(row['folderIds'])) {
        const folderIds = Array.from(
            new Set(row['folderIds'].filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
        );
        if (folderIds.length > 0) return { kind: 'folders', folderIds };
    }
    return { kind: 'all' };
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
            const scope = normalizeScope(row['scope']);
            if (!id || terms.length === 0) continue;
            out.push({ id, terms, match, enabled, scope });
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

function folderIdsForFeed(feedId: string, lookup: FeedFolderLookup | undefined): readonly string[] {
    if (!lookup) return [];
    if (lookup instanceof Map) return lookup.get(feedId) ?? [];
    return (lookup as Record<string, readonly string[]>)[feedId] ?? [];
}

function ruleAppliesToArticle(rule: MuteRule, article: Article, lookup: FeedFolderLookup | undefined): boolean {
    if (rule.scope.kind === 'all') return true;
    const feedFolders = folderIdsForFeed(article.feedId, lookup);
    return rule.scope.folderIds.some((id) => feedFolders.includes(id));
}

/** True when any enabled in-scope rule matches the article (any term match mutes). */
export function isMutedArticle(article: Article, rules: MuteRule[], lookup?: FeedFolderLookup): boolean {
    if (rules.length === 0) return false;
    const enabled = rules.filter((r) => r.enabled && r.terms.length > 0 && ruleAppliesToArticle(r, article, lookup));
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

export function filterMutedArticles<T extends Article>(
    articles: T[],
    rules: MuteRule[],
    lookup?: FeedFolderLookup,
): T[] {
    if (articles.length === 0 || rules.length === 0) return articles;
    if (!rules.some((r) => r.enabled && r.terms.length > 0)) return articles;
    return articles.filter((a) => !isMutedArticle(a, rules, lookup));
}

/** Parse user-entered terms from comma/newline-separated text. */
export function parseMuteTerms(input: string): string[] {
    return normalizeTerms(input.split(/[\n,]+/));
}

export function muteScopeLabel(scope: MuteScope, folderTitleById?: ReadonlyMap<string, string>): string {
    if (scope.kind === 'all') return 'All folders';
    const names = scope.folderIds.map((id) => folderTitleById?.get(id) ?? id);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}
