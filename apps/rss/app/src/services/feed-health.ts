import type { Feed } from '../types';

/**
 * D4 feed health, derived from the library plus a bounded recent-count read.
 * Status fields come from `feed_sync`; recent counts come from `/library/recent`.
 */
export type HealthKind = 'ok' | 'stale' | 'unreachable';
export type HealthSort = 'status' | 'recent' | 'name' | 'age';

export interface FeedHealthRow {
    feed: Feed;
    kind: HealthKind;
    /** Days since the last successful fetch, or null when never fetched. */
    ageDays: number | null;
    /** Articles published in the selected window. */
    recent: number;
    /** Suggested next step, never an automatic action. */
    suggestion: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveHealth(
    feeds: Feed[],
    recent: Record<string, number> = {},
    now: number = Date.now(),
): FeedHealthRow[] {
    return feeds
        .map((feed) => {
            const kind: HealthKind =
                feed.status === 'unreachable' || (feed.consecutiveFailures ?? 0) >= 2
                    ? 'unreachable'
                    : feed.status === 'stale' || feed.lastError
                      ? 'stale'
                      : 'ok';
            const ageDays =
                feed.lastFetchedAt === undefined || feed.lastFetchedAt === null
                    ? null
                    : Math.max(0, Math.floor((now - feed.lastFetchedAt) / DAY_MS));
            return {
                feed,
                kind,
                ageDays,
                recent: recent[feed.id] ?? 0,
                suggestion: suggestionFor(feed, kind),
            };
        })
        .sort((a, b) => rank(b.kind) - rank(a.kind) || (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

/** Filters and ordering applied locally to the derived rows. */
export function viewHealth(
    rows: FeedHealthRow[],
    options: { kind: HealthKind | 'all'; maxRecent: number | null; sort: HealthSort },
): FeedHealthRow[] {
    const filtered = rows.filter((r) => {
        if (options.kind !== 'all' && r.kind !== options.kind) return false;
        if (options.maxRecent !== null && r.recent > options.maxRecent) return false;
        return true;
    });
    const sorted = [...filtered];
    if (options.sort === 'recent')
        sorted.sort((a, b) => a.recent - b.recent || a.feed.title.localeCompare(b.feed.title));
    else if (options.sort === 'name') sorted.sort((a, b) => a.feed.title.localeCompare(b.feed.title));
    else if (options.sort === 'age') sorted.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
    return sorted;
}

/** Toggle one id, or with shift, select the visible range from the anchor. */
export function toggleSelection(
    selected: Set<string>,
    rows: FeedHealthRow[],
    anchor: number,
    index: number,
    shift: boolean,
): { selected: Set<string>; anchor: number } {
    const row = rows[index];
    if (!row) return { selected, anchor };
    const next = new Set(selected);
    if (!shift || anchor < 0 || anchor >= rows.length) {
        if (next.has(row.feed.id)) next.delete(row.feed.id);
        else next.add(row.feed.id);
        return { selected: next, anchor: index };
    }
    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i += 1) {
        const id = rows[i]?.feed.id;
        if (id) next.add(id);
    }
    return { selected: next, anchor: index };
}

/** Keep only selected ids that still have a feed in the library. */
export function pruneSelection(ids: Iterable<string>, feeds: Feed[]): Set<string> {
    const valid = new Set(feeds.map((f) => f.id));
    return new Set([...ids].filter((id) => valid.has(id)));
}

/** Explicit confirm copy for a bulk removal. Never promises the articles survive. */
export function removalMessage(titles: string[]): string {
    const names = titles.slice(0, 3).join(', ');
    const rest = titles.length > 3 ? ` and ${titles.length - 3} more` : '';
    return `Remove ${titles.length} feed${titles.length === 1 ? '' : 's'} (${names}${rest}) and their saved articles? This cannot be undone.`;
}

function rank(kind: HealthKind): number {
    return kind === 'unreachable' ? 2 : kind === 'stale' ? 1 : 0;
}

function suggestionFor(feed: Feed, kind: HealthKind): string {
    if (kind === 'unreachable') return 'Check the site URL, then refresh or remove it below.';
    if (kind === 'stale')
        return feed.lastError
            ? 'Fetch failed recently. Refresh to retry, or remove the feed below.'
            : 'No recent fetch. Refresh to check it.';
    return 'Healthy.';
}
