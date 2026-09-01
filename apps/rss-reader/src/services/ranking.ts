const TRACKING_PARAMS = new Set([
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'yclid',
    'igshid',
    'ref',
    'ref_src',
    'mc_cid',
    'mc_eid',
]);

/**
 * Canonicalize a URL so the same story from different feeds maps to the same key.
 * Everything else in ranking is computed locally from this — no external services.
 */
export function normalizeLink(url: string): string {
    try {
        const u = new URL(url);
        u.hash = '';
        u.protocol = 'https:';
        u.hostname = u.hostname.replace(/^www\./, '');
        for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
        const path = u.pathname.replace(/\/+$/, '');
        return `${u.hostname}${path}${u.search}`;
    } catch {
        return url;
    }
}

/**
 * Engagement-independent popularity signal, derived locally:
 *   +1 base
 *   +3 per additional subscribed feed carrying the same story (syndication)
 *   +1 per comment reported by the feed (capped)
 */
export function popularityScore(syndicationCount: number, comments: number): number {
    return 1 + 3 * Math.max(0, syndicationCount - 1) + Math.min(Math.max(0, comments), 50);
}

/**
 * "Sneaky" engagement proxy derived purely from an article's own structure.
 * No engagement data exists, so we approximate likely-important stories from
 * media presence, substance, and clickbait/urgency cues in the title.
 */
export interface EngagementInput {
    title: string;
    content?: string;
    summary?: string;
    author?: string;
    media?: string;
}

const URGENCY_WORDS = new Set([
    'breaking',
    'live',
    'exclusive',
    'just',
    'update',
    'top',
    'best',
    'new',
    'analysis',
    'watch',
    'explained',
]);

function stripTags(html: string | undefined): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mediaScore(input: EngagementInput, content: string): number {
    if (input.media) return 2;
    if (/<img[\s>]/i.test(content)) return 2;
    return 0;
}

function substanceScore(content: string): number {
    const words = stripTags(content).split(/\s+/).filter(Boolean).length;
    if (words >= 1000) return 3;
    if (words >= 250) return 2;
    if (words >= 50) return 1;
    return 0;
}

function titleScore(title: string): number {
    let s = 0;
    if (title.includes('!')) s += 1;
    if (title.includes('?')) s += 1;
    if (/\b[A-Z]{3,}\b/.test(title)) s += 1;
    if (/\d/.test(title)) s += 1;
    const words = title.toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (words.some((w) => URGENCY_WORDS.has(w))) s += 1;
    if (title.includes(': ')) s += 1;
    return s;
}

function linkScore(content: string): number {
    const count = (content.match(/<a[\s>]/gi) ?? []).length;
    return count >= 3 ? 1 : 0;
}

export function contentEngagement(input: EngagementInput): number {
    const content = input.content ?? '';
    const title = input.title ?? '';
    let score = 0;
    score += mediaScore(input, content);
    score += substanceScore(content);
    score += titleScore(title);
    if (input.author) score += 1;
    score += linkScore(content);
    return score;
}

/** Turn raw accumulated affinity into a bounded per-article boost (0..4). */
export function affinityBoostScore(affinity: number): number {
    return Math.min(4, Math.log10(1 + Math.max(0, affinity)) * 1.5);
}

const VELOCITY_WINDOW_MS = 24 * 3_600_000;

/**
 * Reward a story that is spreading across subscribed feeds right now:
 * each additional feed carrying it contributes more while it's still fresh.
 */
export function velocityBonus(extraFeedCount: number, ageMs: number | undefined): number {
    if (!ageMs || ageMs < 0 || ageMs > VELOCITY_WINDOW_MS) return 0;
    const recency = 1 - ageMs / VELOCITY_WINDOW_MS;
    return Math.min(3, extraFeedCount * recency);
}

const REDDIT_EPOCH = 1_134_028_003;
const HOT_GRAVITY = 90_000;

/**
 * Reddit-style hot ranking with a richer local signal. Uses a fixed anchor epoch
 * so the score of a story is stable between syncs (no periodic recomputation):
 * newer stories rank higher, and a ~10x popularity+engagement edge offsets
 * roughly a day of age.
 */
export function hotScore(popularity: number, engagement: number, publishedMs: number): number {
    const p = Math.max(popularity + Math.max(0, engagement), 1);
    return Math.log10(p) + (publishedMs / 1000 - REDDIT_EPOCH) / HOT_GRAVITY;
}
