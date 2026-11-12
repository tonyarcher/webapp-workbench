/**
 * Last known size of the Interesting view per folder, persisted so the
 * sidebar can show a real count without re-running the ranker. Updated
 * whenever the Interesting view finishes loading; stale until the view
 * has been opened at least once, in which case the sidebar shows no count
 * and dims the row rather than lying about a number.
 */

const STORAGE_KEY = 'rss-reader:interesting-counts';

export function loadInterestingCount(folderId: string): number | undefined {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const value = parsed[folderId];
        return typeof value === 'number' && value >= 0 ? value : undefined;
    } catch {
        return undefined;
    }
}

export function saveInterestingCount(folderId: string, count: number): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        map[folderId] = Math.max(0, Math.round(count));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Storage unavailable (private mode, quota): the badge just stays stale.
    }
}
