/**
 * Local settings for per-folder "interesting shadow" views.
 * Same localStorage precedent as the unread-only folder toggles in
 * source-list.ts (HIDE_READ_KEY): validated loads, silent saves, {} on
 * anything unexpected. No API changes — these toggles never leave the browser.
 */
import { extractWords } from './interesting-words';

const SHADOW_KEY = 'rss-reader:interesting-shadow';
const WORD_MAP_KEY = 'rss-reader:word-map';
const HIDE_READ_KEY = 'rss-reader:hide-read-by-folder';

/** Folder ids with the ✨ Interesting shadow row enabled. */
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

/** Learned word weights shared across folders, keyed by word. */
export function loadWordMap(): Record<string, number> {
    try {
        const raw = localStorage.getItem(WORD_MAP_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return {};
        const out: Record<string, number> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === 'string' && typeof value === 'number' && Number.isFinite(value) && value > 0) {
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
 * open folder page. Weights clamp at zero (entries removed) so un-starring
 * can fully erase what starring taught. Each article counts once: repeats
 * are skipped, un-starring forgets the id so a later re-star counts again.
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
        if (next <= 0) delete map[word];
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
