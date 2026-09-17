/**
 * Today view configuration. Stored as an exclusion list so a fresh install
 * starts with every folder included; unchecking a folder adds its id here.
 * New folders are automatically included, deleted ones are pruned on load.
 */
export type TodayListView = 'detailed' | 'headline' | 'cards';

export interface TodaySettings {
    excludedFolderIds: string[];
    perFolder: number;
    unreadOnly: boolean;
    listView: TodayListView;
}

export const DEFAULT_PER_FOLDER = 5;
export const PER_FOLDER_OPTIONS = [3, 5, 10] as const;
export const TODAY_LIST_VIEWS = ['detailed', 'headline', 'cards'] as const;

const STORAGE_KEY = 'rss-reader:today-settings';

export function defaultTodaySettings(): TodaySettings {
    return {
        excludedFolderIds: [],
        perFolder: DEFAULT_PER_FOLDER,
        unreadOnly: false,
        listView: 'detailed',
    };
}

export function loadTodaySettings(): TodaySettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultTodaySettings();
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
            unreadOnly: parsed.unreadOnly === true,
            listView:
                typeof parsed.listView === 'string' &&
                (TODAY_LIST_VIEWS as readonly string[]).includes(parsed.listView)
                    ? parsed.listView
                    : 'detailed',
        };
    } catch {
        return defaultTodaySettings();
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
