import type {Article, Feed, Folder} from '../types';

/**
 * Front Page view configuration. Persisted to localStorage by the
 * `<front-page>` view itself (same approach as today-settings).
 */
export interface FrontPageOptions {
    perFolder: number;
    unreadOnly: boolean;
    sinceHours: number;
    minWorthy: number;
    showTopStory: boolean;
    showBreaking: boolean;
    showDeepReads: boolean;
    showByFolder: boolean;
}

export const DEFAULT_FRONT_PAGE_OPTIONS: FrontPageOptions = {
    perFolder: 5,
    unreadOnly: false,
    sinceHours: 48,
    minWorthy: 0,
    showTopStory: true,
    showBreaking: true,
    showDeepReads: true,
    showByFolder: true,
};

export const FRONT_PAGE_PER_FOLDER_OPTIONS = [3, 5, 10] as const;
export const FRONT_PAGE_SINCE_HOURS_OPTIONS = [12, 24, 48, 168] as const;

const STORAGE_KEY = 'rss-reader:front-page-options';

export function defaultFrontPageOptions(): FrontPageOptions {
    return {...DEFAULT_FRONT_PAGE_OPTIONS};
}

function isOneOf(value: unknown, options: readonly number[]): value is number {
    return typeof value === 'number' && options.includes(value);
}

export function loadFrontPageOptions(): FrontPageOptions {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultFrontPageOptions();
        const parsed = JSON.parse(raw) as Partial<FrontPageOptions>;
        return {
            perFolder: isOneOf(parsed.perFolder, FRONT_PAGE_PER_FOLDER_OPTIONS)
                ? parsed.perFolder
                : DEFAULT_FRONT_PAGE_OPTIONS.perFolder,
            unreadOnly: parsed.unreadOnly === true,
            sinceHours: isOneOf(parsed.sinceHours, FRONT_PAGE_SINCE_HOURS_OPTIONS)
                ? parsed.sinceHours
                : DEFAULT_FRONT_PAGE_OPTIONS.sinceHours,
            minWorthy: typeof parsed.minWorthy === 'number' && Number.isFinite(parsed.minWorthy)
                ? parsed.minWorthy
                : DEFAULT_FRONT_PAGE_OPTIONS.minWorthy,
            showTopStory: parsed.showTopStory !== false,
            showBreaking: parsed.showBreaking !== false,
            showDeepReads: parsed.showDeepReads !== false,
            showByFolder: parsed.showByFolder !== false,
        };
    } catch {
        return defaultFrontPageOptions();
    }
}

export function saveFrontPageOptions(options: FrontPageOptions): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
        // storage unavailable; options just won't persist
    }
}

export interface FrontPageSection {
    id: string;
    title: string;
    articles: Article[];
}

/** Breaking-news window: stories published within the last 6 hours. */
export const BREAKING_WINDOW_MS = 6 * 3_600_000;

function worthyOf(article: Article): number {
    return article.scores?.worthy ?? 0;
}

function engagementOf(article: Article): number {
    return article.engagement ?? 0;
}

/** Tiebreak comparator suffix: deterministic order for equal ranks. */
function byId(a: Article, b: Article): number {
    return a.id.localeCompare(b.id);
}

interface Eligible {
    article: Article;
    folderIds: string[];
}

/**
 * Filter to the working set: unread-only, the since window, and folders that
 * are not excluded. Feeds in no folder still qualify for the global sections
 * (top story / breaking / deep reads) but never form a per-folder section.
 */
function eligibleArticles(
    articles: Article[],
    feedById: Map<string, Feed>,
    excluded: Set<string>,
    options: FrontPageOptions,
    now: number,
): Eligible[] {
    const cutoff = options.sinceHours > 0 ? now - options.sinceHours * 3_600_000 : Number.NEGATIVE_INFINITY;
    const out: Eligible[] = [];
    for (const article of articles) {
        if (options.unreadOnly && article.read !== 0) continue;
        if (article.published < cutoff) continue;
        const feed = feedById.get(article.feedId);
        if (!feed) continue;
        const folderIds = feed.folderIds.filter((id) => !excluded.has(id));
        if (feed.folderIds.length > 0 && folderIds.length === 0) continue;
        out.push({article, folderIds});
    }
    return out;
}

function topStorySection(eligible: Eligible[], minWorthy: number): FrontPageSection | null {
    let best: Article | null = null;
    for (const {article} of eligible) {
        if (worthyOf(article) < minWorthy) continue;
        if (!best || worthyOf(article) > worthyOf(best) || (worthyOf(article) === worthyOf(best) && article.id < best.id)) {
            best = article;
        }
    }
    if (!best) return null;
    return {id: 'top-story', title: 'Top Story', articles: [best]};
}

function breakingSection(eligible: Eligible[], perFolder: number, now: number): FrontPageSection | null {
    const cutoff = now - BREAKING_WINDOW_MS;
    const recent = eligible.filter(({article}) => article.published >= cutoff).map(({article}) => article);
    if (!recent.length) return null;
    recent.sort((a, b) => b.hot - a.hot || byId(a, b));
    return {id: 'breaking', title: 'Breaking', articles: recent.slice(0, perFolder)};
}

function deepReadsSection(eligible: Eligible[], perFolder: number): FrontPageSection | null {
    if (!eligible.length) return null;
    const ranked = eligible.map(({article}) => article);
    ranked.sort((a, b) => engagementOf(b) - engagementOf(a) || byId(a, b));
    const top = ranked.slice(0, perFolder);
    if (!top.length) return null;
    return {id: 'deep-reads', title: 'Deep Reads', articles: top};
}

function byFolderSections(
    eligible: Eligible[],
    folders: Folder[],
    excluded: Set<string>,
    perFolder: number,
): FrontPageSection[] {
    const buckets = new Map<string, Article[]>();
    for (const {article, folderIds} of eligible) {
        for (const folderId of folderIds) {
            const b = buckets.get(folderId);
            if (b) b.push(article);
            else buckets.set(folderId, [article]);
        }
    }
    const sections: FrontPageSection[] = [];
    for (const folder of folders) {
        if (excluded.has(folder.id)) continue;
        const bucket = buckets.get(folder.id);
        if (!bucket?.length) continue;
        const ranked = [...bucket].sort((a, b) => worthyOf(b) - worthyOf(a) || byId(a, b)).slice(0, perFolder);
        sections.push({id: `folder-${folder.id}`, title: folder.title, articles: ranked});
    }
    return sections;
}

/**
 * Build the newspaper sections for the Front Page. Global sections come
 * first (top story, breaking, deep reads), then one section per folder in
 * sidebar order. Empty sections are omitted. All ranks are deterministic:
 * every sort tiebreaks on article id.
 */
export function buildFrontPageSections(
    articles: Article[],
    feeds: Feed[],
    folders: Folder[],
    excludedFolderIds: string[],
    options: FrontPageOptions,
    now: number = Date.now(),
): FrontPageSection[] {
    const feedById = new Map(feeds.map((f) => [f.id, f]));
    const excluded = new Set(excludedFolderIds);
    const eligible = eligibleArticles(articles, feedById, excluded, options, now);
    if (!eligible.length) return [];
    const sections: FrontPageSection[] = [];
    if (options.showTopStory) {
        const top = topStorySection(eligible, options.minWorthy);
        if (top) sections.push(top);
    }
    if (options.showBreaking) {
        const breaking = breakingSection(eligible, options.perFolder, now);
        if (breaking) sections.push(breaking);
    }
    if (options.showDeepReads) {
        const deep = deepReadsSection(eligible, options.perFolder);
        if (deep) sections.push(deep);
    }
    if (options.showByFolder) {
        sections.push(...byFolderSections(eligible, folders, excluded, options.perFolder));
    }
    return sections;
}
