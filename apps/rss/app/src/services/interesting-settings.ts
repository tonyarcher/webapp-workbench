/**
 * Local settings for per-folder "Interesting" rows.
 * Same localStorage precedent as the unread-only folder toggles in
 * source-list.ts (HIDE_READ_KEY): validated loads, silent saves, {} on
 * anything unexpected. No API changes — these toggles never leave the browser.
 */
import { extractWords } from './interesting-words';

const SHADOW_KEY = 'rss-reader:interesting-shadow';
const WORD_MAP_KEY = 'rss-reader:word-map';
const HIDE_READ_KEY = 'rss-reader:hide-read-by-folder';

/** Folder ids with the ✨ Interesting row enabled. */
export function loadInterestingShadow(): Record<string, true> {
    try {
        const raw = localStorage.getItem(SHADOW_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: Record<string, true> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === 'string' && value === true) out[key] = true;
        }
        return out;
    } catch {
        return {};
    }
}

export function saveInterestingShadow(shadow: Record<string, true>): void {
    try {
        localStorage.setItem(SHADOW_KEY, JSON.stringify(shadow));
    } catch {
        // storage unavailable; the toggle just won't persist
    }
}

/** Learned word weights shared across folders. Zero entries are dropped, negatives kept. */
export function loadWordMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(WORD_MAP_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === 'string' && typeof value === 'number' && Number.isFinite(value) && value !== 0) {
                out[key] = value;
            }
        }
        return out;
    } catch {
        return {};
    }
}

export function saveWordMap(wordMap: Record<string, number>): void {
    try {
        localStorage.setItem(WORD_MAP_KEY, JSON.stringify(wordMap));
    } catch {
        // storage unavailable; learned weights just won't persist
    }
}

const WORD_MAP_IDS_KEY = 'rss-reader:word-map-ids';
const MAX_COUNTED_IDS = 2000;

/** Lifetime per-article engagement accrual, so time cannot compound past the cap. */
const ENGAGEMENT_TOTALS_KEY = 'rss-reader:engagement-totals';

/** Last daily decay run, so old lessons fade and recent behavior dominates. */
const DECAY_AT_KEY = 'rss-reader:engagement-decayed-at';
const DECAY_INTERVAL_MS = 24 * 3_600_000;
const DECAY_FACTOR = 0.5;
/** Bound the map: beyond this many words the tail is noise, not signal. */
const MAX_WORD_MAP_WORDS = 500;

export type EngagementKind = 'share' | 'summary' | 'original' | 'open' | 'dwell' | 'derank';

const totalsEntry = (articleId: string, kind: EngagementKind): string => `${articleId}:${kind}`;

/** Articles explicitly marked not interesting. Ranking, not hiding, carries it. */
const DERANKED_IDS_KEY = 'rss-reader:deranked-ids';
const MAX_DERANKED_IDS = 2000;

/** Article ids already folded into the cached map (bounds the list). */
export function loadWordMapIds(): string[] {
    try {
        const raw = localStorage.getItem(WORD_MAP_IDS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_COUNTED_IDS);
    } catch {
        return [];
    }
}

function saveWordMapIds(ids: string[]): void {
    try {
        localStorage.setItem(WORD_MAP_IDS_KEY, JSON.stringify(ids.slice(0, MAX_COUNTED_IDS)));
    } catch {
        // storage unavailable; dedupe just won't persist
    }
}

/**
 * Fold one star toggle into the cached map so every star/unstar anywhere in
 * the app teaches the shadow views, even for articles outside the currently
 * open folder page. Zero totals are removed; negatives persist so a derank
 * sinks even a never-starred topic. Each article counts once: repeats are
 * skipped, un-starring forgets the id so a later re-star counts again.
 */
export function adjustWordMap(title: string, weight: number, articleId?: string): void {
    if (weight === 0) return;
    if (articleId !== undefined) {
        const counted = new Set(loadWordMapIds());
        if (weight > 0) {
            if (counted.has(articleId)) return;
            counted.add(articleId);
            saveWordMapIds([...counted]);
        } else {
            if (!counted.delete(articleId)) return;
            saveWordMapIds([...counted]);
        }
    }
    const map = loadWordMap();
    for (const word of extractWords(title)) {
        const next = (map[word] ?? 0) + weight;
        if (next === 0) delete map[word];
        else map[word] = next;
    }
    saveWordMap(map);
}

/** Mirror of the folder hide-read toggle owned by source-list.ts. */
export function isHideReadFolder(folderId: string): boolean {
    try {
        const raw = localStorage.getItem(HIDE_READ_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' && parsed ? parsed[folderId] === true : false;
    } catch {
        return false;
    }
}

/** Lifetime per-article engagement totals, bounded so time cannot compound past the cap. */
export function loadEngagementTotals(): Record<string, number> {
    try {
        const raw = localStorage.getItem(ENGAGEMENT_TOTALS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === 'string' && typeof value === 'number' && Number.isFinite(value) && value !== 0) {
                out[key] = value;
            }
        }
        return out;
    } catch {
        return {};
    }
}

function saveEngagementTotals(totals: Record<string, number>): void {
    try {
        localStorage.setItem(ENGAGEMENT_TOTALS_KEY, JSON.stringify(totals));
    } catch {
        // storage unavailable; caps just won't persist
    }
}

/** Ids currently carrying the derank preference, bounded like the counted ids. */
export function loadDerankedIds(): string[] {
    try {
        const raw = localStorage.getItem(DERANKED_IDS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_DERANKED_IDS);
    } catch {
        return [];
    }
}

function saveDerankedIds(ids: string[]): void {
    try {
        localStorage.setItem(DERANKED_IDS_KEY, JSON.stringify(ids.slice(0, MAX_DERANKED_IDS)));
    } catch {
        // storage unavailable; the preference just won't persist
    }
}

/**
 * Daily decay: halve every learned weight and lifetime total so recent
 * behavior dominates and stale interests fade instead of flattening the
 * ranking forever. Zeros drop out and the map prunes to its strongest
 * words. Runs at most once a day, piggybacked on the next accrual, so no
 * timer outlives anything.
 */
export function decayLearnedIfDue(now: number): void {
    let last = 0;
    try {
        last = Number(localStorage.getItem(DECAY_AT_KEY) ?? 0);
    } catch {
        return;
    }
    if (Number.isFinite(last) && now - last < DECAY_INTERVAL_MS) return;
    const map = loadWordMap();
    for (const [word, weight] of Object.entries(map)) {
        const next = weight * DECAY_FACTOR;
        // Halving never reaches exactly zero, so anything below an eighth
        // of a star-step counts as forgotten.
        if (Math.abs(next) < 0.125) delete map[word];
        else map[word] = next;
    }
    const pruned = Object.entries(map).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const kept: Record<string, number> = {};
    for (const [word, weight] of pruned.slice(0, MAX_WORD_MAP_WORDS)) kept[word] = weight;
    saveWordMap(kept);
    const totals = loadEngagementTotals();
    for (const [key, total] of Object.entries(totals)) {
        const next = total * DECAY_FACTOR;
        if (Math.abs(next) < 0.125) delete totals[key];
        else totals[key] = next;
    }
    saveEngagementTotals(totals);
    try {
        localStorage.setItem(DECAY_AT_KEY, String(now));
    } catch {
        // storage unavailable; decay just retries next time
    }
}

export function isDeranked(articleId: string): boolean {
    return loadDerankedIds().includes(articleId);
}

export function setDeranked(articleId: string, deranked: boolean): void {
    const ids = loadDerankedIds().filter((id) => id !== articleId);
    if (deranked) ids.unshift(articleId);
    saveDerankedIds(ids);
}

/**
 * Fold engagement into the learned map with a lifetime per-article,
 * per-signal cap. Unlike star toggles (counted once via WORD_MAP_IDS_KEY),
 * time and repeat actions legitimately recur, so a totals ledger bounds
 * them instead: each signal's lifetime total for the article stays within
 * its own [-cap, cap], and only the newly applied slice reaches the word
 * map. Separate totals per signal keep a low-cap signal from clawing back
 * weight a high-cap signal earned.
 */
export function accrueEngagement(
    title: string,
    weight: number,
    articleId: string,
    cap: number,
    kind: EngagementKind,
): void {
    if (weight === 0 || cap <= 0 || !Number.isFinite(weight)) return;
    decayLearnedIfDue(Date.now());
    const totals = loadEngagementTotals();
    const entry = totalsEntry(articleId, kind);
    const total = totals[entry] ?? 0;
    const next = Math.max(-cap, Math.min(cap, total + weight));
    const applied = next - total;
    if (applied === 0) return;
    if (next === 0) delete totals[entry];
    else totals[entry] = next;
    saveEngagementTotals(totals);
    adjustWordMap(title, applied);
}
