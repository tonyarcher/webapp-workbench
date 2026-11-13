/**
 * Last known size of the Interesting view per folder, persisted so the
 * sidebar can show a real count without re-running the ranker. Updated
 * whenever the Interesting view finishes loading; stale until the view
 * has been opened at least once, in which case the sidebar shows no count
 * and dims the row rather than lying about a number.
 */

const STORAGE_KEY = 'rss-reader:interesting-counts';

/**
 * The active Interesting view's transient "hide read" filter, held in memory
 * only. The background badge refresh reads it so its count matches the list
 * right after "Mark shown as read", then forgets it on view change/disconnect.
 */
const hideReadFolders = new Set<string>();

export function setInterestingHideRead(folderId: string, active: boolean): void {
    if (active) hideReadFolders.add(folderId);
    else hideReadFolders.delete(folderId);
}

export function isInterestingHideRead(folderId: string): boolean {
    return hideReadFolders.has(folderId);
}

export function clearInterestingHideRead(): void {
    hideReadFolders.clear();
}

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
    const next = Math.max(0, Math.round(count));
    let prev: number | undefined;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        const existing = map[folderId];
        if (typeof existing === 'number') prev = existing;
        map[folderId] = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Storage unavailable (private mode, quota): the badge just stays stale.
    }
    if (prev === next) return;
    window.dispatchEvent(new CustomEvent('interesting-counts-changed', { detail: { folderId, count: next } }));
}
