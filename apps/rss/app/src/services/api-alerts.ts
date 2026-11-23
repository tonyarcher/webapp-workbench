import type { Article } from '../types';
import { apiFetch } from './api-client';

/** One keyword alert and the unread articles it currently matches. */
export interface AlertGroup {
    id: string;
    title: string;
    query: string;
    hits: Article[];
}

/** Keyword alerts: flagged saved searches with matching unread articles. */
export async function fetchAlerts(): Promise<AlertGroup[]> {
    const res = (await apiFetch('/alerts')) as { alerts?: AlertGroup[] };
    return Array.isArray(res?.alerts) ? res.alerts : [];
}
