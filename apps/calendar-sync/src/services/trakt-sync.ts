import type { CalEvent, SyncProgress } from '../core/index.js';
import {
    calendarWindows,
    DEFAULT_CALENDAR_FUTURE_DAYS,
    DEFAULT_CALENDAR_PAST_DAYS,
    mapCalendarMovie,
    mapCalendarShow,
    mapHistoryItem,
    TRAKT_HISTORY_MAX_PAGES,
    TRAKT_HISTORY_PAGE_SIZE,
} from '../core/index.js';
import { fetchCalendarMovies, fetchCalendarShows, fetchHistoryPage } from './api';

const DAY_MS = 86_400_000;

/** Consecutive failed polls before giving up: rides out a network blip
    without polling a dead server forever. */
const MAX_POLL_FAILURES = 5;

export type DevicePollOutcome = 'authorized' | 'expired' | 'unreachable';

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
        );
    });
}

export interface DevicePollLoop {
    poll: () => Promise<boolean>;
    intervalMs: number;
    expiresAt: number;
    signal?: AbortSignal;
    now?: () => number;
    sleepFn?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Poll a device code until authorized, expired, or unreachable. Transient
 * failures retry against the budget (an abort during sleep still propagates);
 * terminal server rejections propagate immediately. Pure apart from the
 * injected clock and sleep, so smoke tests drive it deterministically.
 */
export async function pollDeviceUntil(loop: DevicePollLoop): Promise<DevicePollOutcome> {
    const now = loop.now ?? Date.now;
    const sleepFn = loop.sleepFn ?? sleep;
    let failures = 0;
    while (now() < loop.expiresAt) {
        await sleepFn(loop.intervalMs, loop.signal);
        try {
            if (await loop.poll()) {
                throwIfAborted(loop.signal);
                return 'authorized';
            }
            failures = 0;
        } catch (err) {
            // Abort wins over everything, including a terminal rejection that
            // landed at the same moment: the flow is dead by user action, and
            // surfacing the terminal error would clear the replacement card.
            throwIfAborted(loop.signal);
            if (isTerminalDeviceError(err)) throw err;
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) {
                throwIfAborted(loop.signal);
                return 'unreachable';
            }
        }
    }
    throwIfAborted(loop.signal);
    return 'expired';
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/**
 * Server-reported terminal device-flow failures: the code is dead and
 * polling further is pointless. Matches the DevicePoll error text the API
 * forwards in its envelope, plus our own loop-expiry message below.
 */
const TERMINAL_DEVICE_ERRORS = ['Trakt access denied', 'Trakt device code expired'];

/** True when the device flow cannot recover without a fresh code. */
export function isTerminalDeviceError(err: unknown): boolean {
    return err instanceof Error && TERMINAL_DEVICE_ERRORS.includes(err.message);
}

export interface TraktSyncOptions {
    includeCalendar?: boolean;
    includeHistory?: boolean;
    now?: number;
    onProgress?: (progress: SyncProgress) => void;
    onTruncate?: (info: { type: 'shows' | 'movies'; page: number }) => void;
}

/**
 * Trakt sync through the server vault: the same windows and pages the direct
 * client used, but each fetch goes to the API (which injects the vault token)
 * and mapping reuses the core mappers, so no Trakt-JSON knowledge forks here.
 */
export async function fetchTraktEventsViaApi(options: TraktSyncOptions = {}): Promise<CalEvent[]> {
    const includeCalendar = options.includeCalendar ?? true;
    const includeHistory = options.includeHistory ?? true;
    const now = options.now ?? Date.now();
    const events: CalEvent[] = [];
    if (includeCalendar) await loadCalendarViaApi(now, events, options.onProgress);
    if (includeHistory) await loadHistoryViaApi(events, options.onProgress, options.onTruncate);
    options.onProgress?.({ phase: 'convert', done: events.length, total: events.length });
    return events;
}

function appendCalendarEvents(shows: unknown[], movies: unknown[], events: CalEvent[]): void {
    for (const item of shows) {
        const event = mapCalendarShow(item);
        if (event) events.push(event);
    }
    for (const item of movies) {
        const event = mapCalendarMovie(item);
        if (event) events.push(event);
    }
}

async function loadCalendarViaApi(
    now: number,
    events: CalEvent[],
    onProgress?: (progress: SyncProgress) => void,
): Promise<void> {
    const from = now - DEFAULT_CALENDAR_PAST_DAYS * DAY_MS;
    const to = now + DEFAULT_CALENDAR_FUTURE_DAYS * DAY_MS;
    const windows = calendarWindows(from, to);
    const total = windows.length * 2;
    let processed = 0;
    for (const window of windows) {
        onProgress?.({ phase: 'fetch', done: processed, total, label: `calendar ${window.start}` });
        const [shows, movies] = await Promise.all([
            fetchCalendarShows(window.start, window.days),
            fetchCalendarMovies(window.start, window.days),
        ]);
        appendCalendarEvents(shows, movies, events);
        processed += 2;
        onProgress?.({ phase: 'fetch', done: processed, total, label: `calendar ${window.start}` });
    }
}

function appendHistoryEvents(items: unknown[], events: CalEvent[]): void {
    for (const item of items) {
        const event = mapHistoryItem(item);
        if (event) events.push(event);
    }
}

async function loadHistoryViaApi(
    events: CalEvent[],
    onProgress?: (progress: SyncProgress) => void,
    onTruncate?: (info: { type: 'shows' | 'movies'; page: number }) => void,
): Promise<void> {
    for (const type of ['shows', 'movies'] as const) {
        for (let page = 1; page <= TRAKT_HISTORY_MAX_PAGES; page++) {
            onProgress?.({ phase: 'fetch', done: page - 1, label: `history ${type} page ${page}` });
            const items = await fetchHistoryPage(type, page, TRAKT_HISTORY_PAGE_SIZE);
            appendHistoryEvents(items, events);
            onProgress?.({ phase: 'fetch', done: page, label: `history ${type} page ${page}` });
            // A short page ends the listing; a full run to the cap truncates.
            if (items.length < TRAKT_HISTORY_PAGE_SIZE) break;
            if (page === TRAKT_HISTORY_MAX_PAGES) onTruncate?.({ type, page });
        }
    }
}
