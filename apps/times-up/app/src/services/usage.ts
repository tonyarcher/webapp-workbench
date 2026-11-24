import { authedFetch } from './api-client';

export const USAGE_FEATURES = [
    'tab_opened',
    'body_loaded',
    'board_opened',
    'older_article_opened',
    'digest_read',
    'settings_panel_viewed',
] as const;

export type UsageFeature = (typeof USAGE_FEATURES)[number];

const SETTINGS_KEY = 'times-up:usage-enabled';
const COUNTS_KEY = 'times-up:usage-counts';
const FLUSH_MS = 30_000;
const MAX_BATCH = 50;

interface UsageCounts {
    day: string;
    counts: Partial<Record<UsageFeature, number>>;
}

function todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

function emptyCounts(day = todayUtc()): UsageCounts {
    return { day, counts: {} };
}

export function loadUsageEnabled(): boolean {
    try {
        return localStorage.getItem(SETTINGS_KEY) === '1';
    } catch {
        return false;
    }
}

export function saveUsageEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(SETTINGS_KEY, enabled ? '1' : '0');
    } catch {
        // ignore
    }
}

export function loadUsageCounts(): UsageCounts {
    try {
        const raw = localStorage.getItem(COUNTS_KEY);
        if (!raw) return emptyCounts();
        const parsed = JSON.parse(raw) as Partial<UsageCounts>;
        if (parsed.day !== todayUtc() || typeof parsed.counts !== 'object' || !parsed.counts) {
            return emptyCounts();
        }
        const counts: Partial<Record<UsageFeature, number>> = {};
        for (const feature of USAGE_FEATURES) {
            const value = parsed.counts[feature];
            if (typeof value === 'number' && value > 0) counts[feature] = Math.floor(value);
        }
        return { day: todayUtc(), counts };
    } catch {
        return emptyCounts();
    }
}

function saveUsageCounts(value: UsageCounts): void {
    try {
        localStorage.setItem(COUNTS_KEY, JSON.stringify(value));
    } catch {
        // ignore
    }
}

export function recordUsage(feature: UsageFeature): void {
    if (!loadUsageEnabled()) return;
    const current = loadUsageCounts();
    current.counts[feature] = (current.counts[feature] ?? 0) + 1;
    saveUsageCounts(current);
    scheduleUsageFlush();
}

let flushTimer: number | undefined;
let flushing = false;

function scheduleUsageFlush(): void {
    if (flushTimer !== undefined) return;
    if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return;
    flushTimer = window.setTimeout(() => {
        flushTimer = undefined;
        void flushUsage().catch(() => undefined);
    }, FLUSH_MS);
}

export function flushUsageNow(): Promise<void> {
    if (flushTimer !== undefined) {
        if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') window.clearTimeout(flushTimer);
        flushTimer = undefined;
    }
    return flushUsage().catch(() => undefined);
}

async function flushUsage(): Promise<void> {
    if (flushing || !loadUsageEnabled()) return;
    const current = loadUsageCounts();
    const events = USAGE_FEATURES.flatMap((feature) => {
        const count = current.counts[feature] ?? 0;
        return count > 0 ? [{ feature, count: Math.min(count, 1000) }] : [];
    }).slice(0, MAX_BATCH);
    if (events.length === 0) return;
    flushing = true;
    try {
        const res = await authedFetch('/usage', {
            method: 'POST',
            body: JSON.stringify({ events }),
        });
        if (res.ok) {
            const next = loadUsageCounts();
            for (const event of events) {
                const remaining = (next.counts[event.feature as UsageFeature] ?? 0) - event.count;
                if (remaining > 0) next.counts[event.feature as UsageFeature] = remaining;
                else delete next.counts[event.feature as UsageFeature];
            }
            saveUsageCounts(next);
            return;
        }
        if (res.status === 404) {
            // Server has usage disabled; keep local counts visible but stop retry churn.
            return;
        }
    } finally {
        flushing = false;
    }
}

export function usageFeatureLabel(feature: UsageFeature): string {
    switch (feature) {
        case 'tab_opened':
            return 'Tabs opened';
        case 'body_loaded':
            return 'Article bodies loaded';
        case 'board_opened':
            return 'Boards opened';
        case 'older_article_opened':
            return 'Older articles opened';
        case 'digest_read':
            return 'Digests read';
        case 'settings_panel_viewed':
            return 'Settings panels viewed';
    }
}
