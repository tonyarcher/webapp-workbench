/**
 * Today view configuration. Stored as an exclusion list so a fresh install
 * starts with every folder included; unchecking a folder adds its id here.
 * New folders are automatically included, deleted ones are pruned on load.
 */
export interface TodaySettings {
    excludedFolderIds: string[];
    perFolder: number;
}

export const DEFAULT_PER_FOLDER = 5;
export const PER_FOLDER_OPTIONS = [3, 5, 10] as const;

const STORAGE_KEY = 'rss-reader:today-settings';

export function loadTodaySettings(): TodaySettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {excludedFolderIds: [], perFolder: DEFAULT_PER_FOLDER};
        const parsed = JSON.parse(raw) as Partial<TodaySettings>;
        return {
            excludedFolderIds: Array.isArray(parsed.excludedFolderIds)
                ? parsed.excludedFolderIds.filter((id): id is string => typeof id === 'string')
                : [],
            perFolder:
                typeof parsed.perFolder === 'number' &&
                (PER_FOLDER_OPTIONS as readonly number[]).includes(parsed.perFolder)
                    ? parsed.perFolder
                    : DEFAULT_PER_FOLDER,
        };
    } catch {
        return {excludedFolderIds: [], perFolder: DEFAULT_PER_FOLDER};
    }
}

export function saveTodaySettings(settings: TodaySettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // storage unavailable; settings just won't persist
    }
}

/**
 * Drop excluded ids that no longer exist as folders (deleted or imported
 * away), so settings never reference dead folders.
 */
export function pruneTodaySettings(
    settings: TodaySettings,
    existingFolderIds: string[],
): TodaySettings {
    const valid = new Set(existingFolderIds);
    const excluded = settings.excludedFolderIds.filter((id) => valid.has(id));
    return excluded.length === settings.excludedFolderIds.length
        ? settings
        : {...settings, excludedFolderIds: excluded};
}
