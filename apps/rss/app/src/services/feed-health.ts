import type { Feed } from '../types';

/**
 * D4 feed health, derived from the library the server already returns.
 * No new endpoint: `status`, `lastFetchedAt`, `lastError` and
 * `consecutiveFailures` come from `feed_sync` through `/library/feeds`.
 */
export type HealthKind = 'ok' | 'stale' | 'unreachable';

export interface FeedHealthRow {
    feed: Feed;
    kind: HealthKind;
    /** Days since the last successful fetch, or null when never fetched. */
    ageDays: number | null;
    /** Suggested next step, never an automatic action. */
    suggestion: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveHealth(feeds: Feed[], now: number = Date.now()): FeedHealthRow[] {
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
            return { feed, kind, ageDays, suggestion: suggestionFor(feed, kind) };
        })
        .sort((a, b) => rank(b.kind) - rank(a.kind) || (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

function rank(kind: HealthKind): number {
    return kind === 'unreachable' ? 2 : kind === 'stale' ? 1 : 0;
}

function suggestionFor(feed: Feed, kind: HealthKind): string {
    if (kind === 'unreachable') return 'Check the site URL, then refresh or unfollow it in Organize.';
    if (kind === 'stale')
        return feed.lastError ? 'Fetch failed recently. Refresh to retry.' : 'No recent fetch. Refresh to check it.';
    return 'Healthy.';
}
