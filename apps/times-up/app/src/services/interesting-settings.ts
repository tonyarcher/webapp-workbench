/**
 * Local settings for per-folder "Interesting" rows.
 * Same localStorage precedent as the unread-only folder toggles in
 * source-list.ts (HIDE_READ_KEY): validated loads, silent saves, {} on
 * anything unexpected. No API changes — these toggles never leave the browser.
 */
import {
    DEFAULT_INTERESTING_STRICTNESS as WORDS_DEFAULT_STRICTNESS,
    clampInterestingStrictness,
    extractWords,
    titleHasLearnedWord,
} from './interesting-words';
import { isSignalEnabled } from './learning-signals';

/** Re-exported so views import settings only; the words module owns the value. */
export const DEFAULT_INTERESTING_STRICTNESS = WORDS_DEFAULT_STRICTNESS;

const SHADOW_KEY = 'times-up:interesting-shadow';
const ORDER_KEY = 'times-up:interesting-order';
const WORD_MAP_KEY = 'times-up:word-map';
const HIDE_READ_KEY = 'times-up:hide-read-by-folder';
const STRICTNESS_KEY = 'times-up:interesting-strictness';

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
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-settings-changed'));
}

/** Preferred display order for enabled Interesting rows (folder ids). */
export function loadInterestingOrder(): string[] {
    try {
        const raw = localStorage.getItem(ORDER_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        const out: string[] = [];
        const seen = new Set<string>();
        for (const id of parsed) {
            if (typeof id !== 'string' || !id || seen.has(id)) continue;
            seen.add(id);
            out.push(id);
        }
        return out;
    } catch {
        return [];
    }
}

export function saveInterestingOrder(ids: string[]): void {
    try {
        const out: string[] = [];
        const seen = new Set<string>();
        for (const id of ids) {
            if (typeof id !== 'string' || !id || seen.has(id)) continue;
            seen.add(id);
            out.push(id);
        }
        localStorage.setItem(ORDER_KEY, JSON.stringify(out));
    } catch {
        // storage unavailable; order just won't persist
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-settings-changed'));
}

/**
 * Enabled Interesting folder ids in preferred order. Keeps stored order for
 * enabled ids, appends newly-enabled ids in folder-library order, and drops ids
 * that are no longer enabled or no longer exist.
 */
export function orderedInterestingFolderIds(
    shadow: Record<string, true>,
    folders: Array<{ id: string }>,
    storedOrder: string[],
): string[] {
    const folderIds = new Set(folders.map((f) => f.id));
    const enabled = new Set(Object.keys(shadow).filter((id) => shadow[id] === true && folderIds.has(id)));
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of storedOrder) {
        if (!enabled.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    for (const folder of folders) {
        if (!enabled.has(folder.id) || seen.has(folder.id)) continue;
        seen.add(folder.id);
        out.push(folder.id);
    }
    return out;
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

const WORD_MAP_IDS_KEY = 'times-up:word-map-ids';
const MAX_COUNTED_IDS = 2000;

/** Lifetime per-article engagement accrual, so time cannot compound past the cap. */
const ENGAGEMENT_TOTALS_KEY = 'times-up:engagement-totals';

/** Last daily decay run, so old lessons fade and recent behavior dominates. */
const DECAY_AT_KEY = 'times-up:engagement-decayed-at';
export const DECAY_INTERVAL_MS = 24 * 3_600_000;
const DECAY_FACTOR = 0.5;
/** Bound the map: beyond this many words the tail is noise, not signal. */
const MAX_WORD_MAP_WORDS = 500;

export type EngagementKind = 'share' | 'summary' | 'original' | 'open' | 'dwell' | 'derank';

const totalsEntry = (articleId: string, kind: EngagementKind): string => `${articleId}:${kind}`;

/** Articles explicitly marked not interesting. Ranking, not hiding, carries it. */
const DERANKED_IDS_KEY = 'times-up:deranked-ids';
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
 * skipped, un-starring forgets the id so a later re-star counts again. A
 * counted article whose words all decayed away repairs only the missing ones,
 * so a quiet stretch cannot leave the model permanently deaf to old likes.
 * Un-starring only removes positive teaching; it never pushes a word below
 * zero, so it cannot invent a dislike the reader never expressed.
 */
export function adjustWordMap(title: string, weight: number, articleId?: string): void {
    if (weight === 0) return;
    const map = loadWordMap();
    // A counted article whose words all decayed away must be allowed to teach
    // again, or the model can never rebuild from likes it already saw.
    let repairOnly = false;
    if (articleId !== undefined) {
        const counted = new Set(loadWordMapIds());
        if (weight > 0) {
            if (counted.has(articleId)) {
                if (titleHasLearnedWord(title, map)) return;
                repairOnly = true;
            } else {
                counted.add(articleId);
                saveWordMapIds([...counted]);
            }
        } else {
            if (!counted.delete(articleId)) return;
            saveWordMapIds([...counted]);
        }
    }
    let changed = false;
    for (const word of extractWords(title)) {
        const current = map[word];
        if (repairOnly && current !== undefined) continue;
        // An unstar only removes positive teaching. Decay may already have
        // lowered or pruned the word, so subtracting the full star step would
        // leave a dislike the reader never expressed. Negatives come from an
        // explicit derank or engagement (no article id).
        if (articleId !== undefined && weight < 0) {
            if (current === undefined || current < 0) continue;
            map[word] = Math.max(0, current + weight);
            if (map[word] === 0) delete map[word];
            changed = true;
            continue;
        }
        const next = (current ?? 0) + weight;
        if (current === undefined) {
            map[word] = next;
            changed = true;
        } else if (next === 0) {
            delete map[word];
            changed = true;
        } else if (next !== current) {
            map[word] = next;
            changed = true;
        }
    }
    if (!changed) return;
    saveWordMap(map);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-model-changed'));
}

/**
 * Nudge one learned word directly (article keyword +/- controls). Unlike
 * adjustWordMap this does not fold a whole title or dedupe by article id:
 * the reader is tuning this exact word, so each press is one step.
 */
export function adjustWordWeight(word: string, delta: number): void {
    if (!word || delta === 0) return;
    const map = loadWordMap();
    const next = (map[word] ?? 0) + delta;
    if (next === 0) delete map[word];
    else map[word] = next;
    saveWordMap(map);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-model-changed'));
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
 * Last successful decay, or null when it has never run. The dashboard shows
 * this so the reader can see why an old like has a small weight now.
 */
export function loadDecayAt(): number | null {
    try {
        const raw = localStorage.getItem(DECAY_AT_KEY);
        if (!raw) return null;
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
        return null;
    }
}

/**
 * Daily decay: halve every learned weight and lifetime total so recent
 * behavior dominates and stale interests fade instead of flattening the
 * ranking forever. Zeros drop out and the map prunes to its strongest
 * words. Runs at most once a day, piggybacked on the next accrual, so no
 * timer outlives anything. Switching the decay signal off freezes the map
 * where it is; re-enabling it decays on the next accrual.
 */
export function decayLearnedIfDue(now: number): void {
    if (!isSignalEnabled('decay')) return;
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
    if (!isSignalEnabled(kind)) return;
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

/**
 * Per-folder Interesting selectivity (0 loose … 100 strict). Stored as one
 * JSON map so each folder keeps its own slider; a legacy bare number reads
 * as every folder's value. Anything unexpected is the default.
 */
export function loadInterestingStrictness(folderId: string): number {
    try {
        const raw = localStorage.getItem(STRICTNESS_KEY);
        if (!raw) return DEFAULT_INTERESTING_STRICTNESS;
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'number') return clampInterestingStrictness(parsed);
        if (typeof parsed === 'object' && parsed !== null) {
            return clampInterestingStrictness((parsed as Record<string, unknown>)[folderId]);
        }
        return DEFAULT_INTERESTING_STRICTNESS;
    } catch {
        return DEFAULT_INTERESTING_STRICTNESS;
    }
}

export function saveInterestingStrictness(folderId: string, value: number): void {
    try {
        const raw = localStorage.getItem(STRICTNESS_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : {};
        const map: Record<string, number> =
            typeof parsed === 'object' && parsed !== null ? { ...(parsed as Record<string, number>) } : {};
        map[folderId] = clampInterestingStrictness(value);
        localStorage.setItem(STRICTNESS_KEY, JSON.stringify(map));
    } catch {
        // storage unavailable; the slider just won't persist
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-settings-changed'));
}

/**
 * One-tap forget for the privacy dashboard: drop every learned weight, the
 * engagement ledger, the derank list, the decay clock, and the derived badge
 * counts. The reader's choices stay -- signal switches, Interesting folders,
 * strictness, and the stars themselves are settings or server state, not
 * inference. The next ranking starts from an empty map and (when star
 * learning is on) re-seeds from explicit likes.
 */
export function forgetLearning(): void {
    try {
        for (const key of [
            WORD_MAP_KEY,
            WORD_MAP_IDS_KEY,
            ENGAGEMENT_TOTALS_KEY,
            DECAY_AT_KEY,
            DERANKED_IDS_KEY,
            'times-up:interesting-counts',
        ]) {
            localStorage.removeItem(key);
        }
    } catch {
        // storage unavailable; there is nothing learned to forget
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-model-changed'));
}
