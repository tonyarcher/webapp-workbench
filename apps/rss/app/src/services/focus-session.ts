import type { Article } from '../types';
import { loadWordMap } from './interesting-settings';
import { selectInteresting } from './interesting-words';

const STATE_KEY = 'rss-reader:focus-session';
const STREAK_KEY = 'rss-reader:focus-streak';
let stagedSeed: Article[] | null = null;

export function stageFocusSeed(articles: Article[]): void {
    stagedSeed = articles.length ? articles : null;
}

export function takeFocusSeed(): Article[] | null {
    const seed = stagedSeed;
    stagedSeed = null;
    return seed;
}

export interface FocusStreak {
    kept: number;
    lastKeptDate: string | null;
}

export interface FocusSessionState {
    status: 'running' | 'done';
    queueIds: string[];
    doneIds: string[];
    startedAt: number;
    durationMs: number;
    endsAt: number;
}

export function loadFocusStreak(): FocusStreak {
    try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (!raw) return { kept: 0, lastKeptDate: null };
        const parsed = JSON.parse(raw) as Partial<FocusStreak>;
        return {
            kept:
                typeof parsed.kept === 'number' && Number.isFinite(parsed.kept)
                    ? Math.max(0, Math.floor(parsed.kept))
                    : 0,
            lastKeptDate: typeof parsed.lastKeptDate === 'string' ? parsed.lastKeptDate : null,
        };
    } catch {
        return { kept: 0, lastKeptDate: null };
    }
}

function saveFocusStreak(streak: FocusStreak): void {
    try {
        localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    } catch {
        // ignore
    }
}

export function localDateKey(at = Date.now()): string {
    const d = new Date(at);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function recordKeptSession(now = Date.now()): FocusStreak {
    const current = loadFocusStreak();
    const today = localDateKey(now);
    if (current.lastKeptDate === today) return current;
    const next: FocusStreak = { kept: current.kept + 1, lastKeptDate: today };
    saveFocusStreak(next);
    return next;
}

export function loadFocusSession(): FocusSessionState | null {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as Partial<FocusSessionState>;
        if (p.status !== 'running' && p.status !== 'done') return null;
        if (!Array.isArray(p.queueIds) || !Array.isArray(p.doneIds)) return null;
        const queueIds = p.queueIds.filter((x): x is string => typeof x === 'string');
        const doneIds = p.doneIds.filter((x): x is string => typeof x === 'string');
        const startedAt = typeof p.startedAt === 'number' ? p.startedAt : 0;
        const durationMs = typeof p.durationMs === 'number' ? p.durationMs : 0;
        const endsAt = typeof p.endsAt === 'number' ? p.endsAt : startedAt + durationMs;
        if (!startedAt || !durationMs) return null;
        return { status: p.status, queueIds, doneIds, startedAt, durationMs, endsAt };
    } catch {
        return null;
    }
}

export function saveFocusSession(state: FocusSessionState | null): void {
    try {
        if (!state) localStorage.removeItem(STATE_KEY);
        else localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
}

export function rankFocusQueue(articles: Article[], limit: number): Article[] {
    const unread = articles.filter((a) => a.read === 0);
    const wordMap = loadWordMap();
    const ranked = selectInteresting(unread, wordMap, 0);
    if (ranked.length) return ranked.slice(0, limit);
    // fallback: hot/newest-ish by published desc
    return [...unread].sort((a, b) => (b.hot ?? 0) - (a.hot ?? 0) || b.published - a.published).slice(0, limit);
}

export function startFocusSession(
    articles: Article[],
    durationMs: number,
    now = Date.now(),
    limit = 10,
    priorityIds: string[] = [],
): FocusSessionState {
    const priority: Article[] = [];
    const seen = new Set<string>();
    for (const id of priorityIds) {
        const article = articles.find((item) => item.id === id && item.read === 0);
        if (article && !seen.has(id)) {
            priority.push(article);
            seen.add(id);
        }
    }
    const rest = rankFocusQueue(
        articles.filter((article) => !seen.has(article.id)),
        limit,
    );
    const queue = [...priority, ...rest].slice(0, limit).map((a) => a.id);
    const state: FocusSessionState = {
        status: 'running',
        queueIds: queue,
        doneIds: [],
        startedAt: now,
        durationMs,
        endsAt: now + durationMs,
    };
    saveFocusSession(state);
    return state;
}

export function markFocusDone(state: FocusSessionState, articleId: string): FocusSessionState {
    if (state.doneIds.includes(articleId) || !state.queueIds.includes(articleId)) return state;
    const next = { ...state, doneIds: [...state.doneIds, articleId] };
    if (next.doneIds.length >= next.queueIds.length) next.status = 'done';
    saveFocusSession(next);
    return next;
}

export function finishFocusSession(state: FocusSessionState): FocusSessionState {
    if (state.status === 'done') return state;
    const next = { ...state, status: 'done' as const };
    saveFocusSession(next);
    return next;
}

export function clearFocusSession(): void {
    saveFocusSession(null);
}

export function remainingFocusIds(state: FocusSessionState): string[] {
    const done = new Set(state.doneIds);
    return state.queueIds.filter((id) => !done.has(id));
}
