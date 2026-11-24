import type { Article } from '../types';
import { apiFetch } from './api-client';

/** One keyword alert and the unread articles it currently matches. */
export interface AlertGroup {
    id: string;
    title: string;
    query: string;
    hits: Article[];
}

/** Recent article counts for one window, keyed by feed id. */
export interface RecentCounts {
    days: number;
    feeds: Record<string, number>;
}

export async function fetchRecentCounts(days: number): Promise<RecentCounts> {
    const res = (await apiFetch(`/library/recent?days=${days}`)) as {
        days: number;
        feeds: Array<{ feedId: string; count: number }>;
    };
    return {
        days: res.days,
        feeds: Object.fromEntries((res.feeds ?? []).map((f) => [f.feedId, f.count])),
    };
}

/** Keyword alerts: flagged saved searches with matching unread articles. */
export async function fetchAlerts(): Promise<AlertGroup[]> {
    const res = (await apiFetch('/alerts')) as { alerts?: AlertGroup[] };
    return Array.isArray(res?.alerts) ? res.alerts : [];
}
