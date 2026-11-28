// Alert notifications (S3).
//
// F1 already selects the hits: `/alerts` returns each flagged saved search with
// its unread matches. This module is only the delivery half. It runs on a timer
// while the app is open, and notifies when new hits appear while the tab is in
// the background. Quiet hours defer a check without advancing the baseline, so
// a hit that arrived at 23:00 is still announced at 07:00.
//
// The payload carries a label, a count, and the app's own `/alerts` route. It
// never carries an article title, body, URL, token, or user id: the reader
// opens the rows in the app to see what matched.
//
// A real push channel is F3's job. Until then a closed tab gets nothing, and
// this module does not pretend otherwise.

import { fetchAlerts } from './api-alerts';
import { safeLocalStorage } from './local-storage';
import { notificationState, showNotification, type NotificationState } from './notifications';
import { isQuietAt, loadQuietHours, minutesOfDay, type QuietHours } from './quiet-hours';

export const ALERT_SNAPSHOT_KEY = 'times-up:alert-hits';
export const ALERT_NOTIFICATION_TAG = 'times-up-alerts';
export const ALERTS_ROUTE = '/alerts';
export const ALERT_CHECK_MS = 5 * 60_000;

/** Unread hit count per alert id. Counts only, never article ids. */
export type AlertHitCounts = Record<string, number>;

export interface AlertNotificationPayload {
    title: string;
    body: string;
    tag: string;
    data: { route: string };
}

export interface AlertGroupLike {
    id: string;
    hits: ReadonlyArray<unknown>;
}

function validCount(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

export function parseAlertSnapshot(raw: string | null): AlertHitCounts {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== 'object') return {};
        const counts: AlertHitCounts = {};
        for (const [id, value] of Object.entries(parsed)) {
            const count = validCount(value);
            if (id && count > 0) counts[id] = count;
        }
        return counts;
    } catch {
        return {};
    }
}

export function loadAlertSnapshot(storage?: Storage | null): AlertHitCounts {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return {};
    try {
        return parseAlertSnapshot(store.getItem(ALERT_SNAPSHOT_KEY));
    } catch {
        return {};
    }
}

export function saveAlertSnapshot(counts: AlertHitCounts, storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return;
    try {
        store.setItem(ALERT_SNAPSHOT_KEY, JSON.stringify(counts));
    } catch {
        // A full or blocked store only costs a duplicate notice next check.
    }
}

export function clearAlertSnapshot(storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return;
    try {
        store.removeItem(ALERT_SNAPSHOT_KEY);
    } catch {
        // Nothing to clear if the store refuses.
    }
}

export function alertHitCounts(groups: ReadonlyArray<AlertGroupLike>): AlertHitCounts {
    const counts: AlertHitCounts = {};
    for (const group of groups) counts[group.id] = group.hits.length;
    return counts;
}

/** New unread hits since the last check. A drop never offsets another alert's rise. */
export function newAlertHits(previous: AlertHitCounts, current: AlertHitCounts): number {
    let total = 0;
    for (const [id, count] of Object.entries(current)) {
        total += Math.max(0, count - (previous[id] ?? 0));
    }
    return total;
}

export function buildAlertNotification(count: number): AlertNotificationPayload {
    const label = count === 1 ? '1 new story matches your alerts.' : `${count} new stories match your alerts.`;
    return {
        title: 'Times Up alerts',
        body: label,
        tag: ALERT_NOTIFICATION_TAG,
        data: { route: ALERTS_ROUTE },
    };
}

export type AlertGate = 'show' | 'focused' | 'quiet' | 'blocked' | 'unsupported';

/**
 * The rule that decides whether a check may notify. Permission and quiet hours
 * come first: a focused tab has its own Alerts row, so it only records a
 * baseline. `default` counts as blocked because a notification cannot be shown.
 */
export function alertNotificationGate(input: {
    permission: NotificationState;
    hidden: boolean;
    quiet: boolean;
}): AlertGate {
    if (input.permission === 'unsupported') return 'unsupported';
    if (input.permission !== 'granted') return 'blocked';
    if (input.quiet) return 'quiet';
    return input.hidden ? 'show' : 'focused';
}

export type AlertCheckResult = 'shown' | 'no-new-hits' | 'focused' | 'quiet' | 'blocked' | 'unsupported' | 'failed';

export interface AlertCheckDeps {
    fetchGroups: () => Promise<ReadonlyArray<AlertGroupLike>>;
    show: (payload: AlertNotificationPayload) => Promise<boolean>;
    storage?: Storage | null;
    now?: Date;
    hidden?: boolean;
    permission?: NotificationState;
    quietHours?: QuietHours;
}

export async function runAlertCheck(deps: AlertCheckDeps): Promise<AlertCheckResult> {
    const storage = deps.storage === undefined ? safeLocalStorage() : deps.storage;
    const permission = deps.permission ?? notificationState();
    const hidden = deps.hidden ?? (typeof document !== 'undefined' && document.hidden);
    const prefs = deps.quietHours ?? loadQuietHours(storage);
    const gate = alertNotificationGate({
        permission,
        hidden,
        quiet: isQuietAt(minutesOfDay(deps.now ?? new Date()), prefs),
    });
    if (gate === 'unsupported' || gate === 'blocked' || gate === 'quiet') return gate;

    let groups: ReadonlyArray<AlertGroupLike>;
    try {
        groups = await deps.fetchGroups();
    } catch {
        return 'failed';
    }
    const current = alertHitCounts(groups);
    if (gate === 'focused') {
        saveAlertSnapshot(current, storage);
        return 'focused';
    }
    const hits = newAlertHits(loadAlertSnapshot(storage), current);
    if (hits <= 0) {
        saveAlertSnapshot(current, storage);
        return 'no-new-hits';
    }
    const shown = await deps.show(buildAlertNotification(hits));
    if (shown) saveAlertSnapshot(current, storage);
    return shown ? 'shown' : 'failed';
}

/** `renotify` is in the Notifications spec but absent from this DOM lib's type. */
export interface AlertNotificationOptions extends NotificationOptions {
    renotify?: boolean;
}

export async function showAlertNotification(payload: AlertNotificationPayload): Promise<boolean> {
    // `renotify` re-alerts when this notice replaces the previous batch under the
    // same tag; without it a second batch would swap in silently.
    const options: AlertNotificationOptions = {
        body: payload.body,
        tag: payload.tag,
        data: payload.data,
        renotify: true,
    };
    return showNotification(payload.title, options);
}

let started = false;
let timer: number | null = null;
let checking = false;

function checkAlerts(): void {
    if (checking) return;
    checking = true;
    void runAlertCheck({ fetchGroups: fetchAlerts, show: showAlertNotification }).finally(() => {
        checking = false;
    });
}

/** Leaving the tab is the moment a hit found while reading is worth announcing. */
function onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) checkAlerts();
}

export function startAlertNotifications(): void {
    if (started || typeof window === 'undefined') return;
    started = true;
    timer = window.setInterval(checkAlerts, ALERT_CHECK_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    checkAlerts();
}

export function stopAlertNotifications(): void {
    if (!started) return;
    started = false;
    if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
}
