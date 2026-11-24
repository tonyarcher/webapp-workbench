/**
 * Per-article reading progress (scroll position), persisted locally so a long
 * article can be resumed where it was left off. Stores a 0..1 fraction rather
 * than pixels because layout and font size can change between sessions.
 *
 * `services/` stays DOM-free; the view owns scroll events and applies restores.
 */

const STORAGE_KEY = 'times-up:reading-progress';

/** At or above this fraction the article counts as finished and progress clears. */
export const READING_COMPLETE_FRACTION = 0.985;

/** Ignore tiny progress so opening an article does not pin it as "in progress". */
const MIN_SAVE_FRACTION = 0.02;

const MAX_ENTRIES = 300;

export interface ReadingProgressEntry {
    fraction: number;
    updatedAt: number;
}

type ProgressMap = Record<string, ReadingProgressEntry>;

function readMap(): ProgressMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
        const out: ProgressMap = {};
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!id || typeof value !== 'object' || value === null || Array.isArray(value)) continue;
            const row = value as Record<string, unknown>;
            const fraction = typeof row['fraction'] === 'number' ? row['fraction'] : NaN;
            const updatedAt = typeof row['updatedAt'] === 'number' ? row['updatedAt'] : 0;
            if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) continue;
            out[id] = { fraction: Math.min(1, Math.max(0, fraction)), updatedAt };
        }
        return out;
    } catch {
        return {};
    }
}

function writeMap(map: ProgressMap): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // storage unavailable; progress just won't persist
    }
}

function prune(map: ProgressMap): ProgressMap {
    const entries = Object.entries(map);
    if (entries.length <= MAX_ENTRIES) return map;
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    return Object.fromEntries(entries.slice(0, MAX_ENTRIES));
}

export function loadReadingProgress(articleId: string): number | null {
    if (!articleId) return null;
    const entry = readMap()[articleId];
    if (!entry) return null;
    if (entry.fraction >= READING_COMPLETE_FRACTION) return null;
    return entry.fraction;
}

export function saveReadingProgress(articleId: string, fraction: number, now = Date.now()): void {
    if (!articleId || !Number.isFinite(fraction)) return;
    const clamped = Math.min(1, Math.max(0, fraction));
    const map = readMap();
    if (clamped >= READING_COMPLETE_FRACTION || clamped < MIN_SAVE_FRACTION) {
        if (map[articleId]) {
            delete map[articleId];
            writeMap(map);
        }
        return;
    }
    map[articleId] = { fraction: clamped, updatedAt: now };
    writeMap(prune(map));
}

export function clearReadingProgress(articleId: string): void {
    if (!articleId) return;
    const map = readMap();
    if (!map[articleId]) return;
    delete map[articleId];
    writeMap(map);
}
