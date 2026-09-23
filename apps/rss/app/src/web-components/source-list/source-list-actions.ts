import {
    deleteFeed,
    deleteFolder,
    refreshFeed,
    refreshFolder,
    reorderFolders,
    setFeedFolderMembership,
    syncAllFeeds,
} from '../../mutations';
import { pruneTodaySettings, saveTodaySettings, type TodaySettings } from '../../services/today-settings';
import { saveInterestingShadow } from '../../services/interesting-settings';
import type { Feed, FeedSort, Folder } from '../../types';
import type { MenuHost } from './source-list-menus';
import { closeFeedListMenuAction, closeFolderMenuAction, closeMenuAction } from './source-list-menus';
import { saveAutoHide, saveCollapsed, saveFeedSort, saveHideReadByFolder } from './source-list-settings';

/** Menu command state the sidebar actions read and update on the component. */
export interface ActionHost extends MenuHost {
    libraryData: { folders: Folder[]; feeds: Feed[] };
    collapsed: Record<string, boolean>;
    feedSort: FeedSort;
    hideReadByFolder: Record<string, boolean>;
    interestingShadow: Record<string, true>;
    todaySettings: TodaySettings;
    menuFeed(): Feed | undefined;
    folderMenuFolder(): Folder | undefined;
}

async function doRefresh(feed: Feed) {
    try {
        await refreshFeed(feed.id);
    } catch {
        // surfaced on the feed row's next sync attempt
    }
}

async function doDeleteFeed(feed: Feed) {
    if (confirm(`Delete ${feed.title}?`)) {
        await deleteFeed(feed.id);
    }
}

async function doDeleteFolderAction(host: ActionHost, folder: Folder) {
    if (confirm(`Delete folder ${folder.title}? Feeds will be removed from this folder.`)) {
        await deleteFolder(folder.id);
        if (folder.id in host.collapsed) {
            const { [folder.id]: _removed, ...rest } = host.collapsed;
            host.collapsed = rest;
            saveCollapsed(rest);
        }
    }
}

export function toggleFolderAction(host: { collapsed: Record<string, boolean> }, id: string): void {
    const next = { ...host.collapsed, [id]: !host.collapsed[id] };
    host.collapsed = next;
    saveCollapsed(next);
}

export function toggleAutoHideAction(host: { autoHide: boolean }): void {
    host.autoHide = !host.autoHide;
    saveAutoHide(host.autoHide);
}

export function hideChangeAction(host: ActionHost, e: Event): void {
    const { key, unreadOnly } = (e as CustomEvent<{ key: string; unreadOnly: boolean }>).detail;
    host.hideReadByFolder = { ...host.hideReadByFolder, [key]: unreadOnly };
    saveHideReadByFolder(host.hideReadByFolder);
}

export function folderMenuUnreadOnlyAction(host: ActionHost, e: Event): void {
    const folder = host.folderMenuFolder();
    if (!folder) return;
    hideChangeAction(
        host,
        new CustomEvent('folder-toggle', {
            detail: { key: folder.id, unreadOnly: (e as CustomEvent<boolean>).detail },
        }),
    );
}

export function folderMenuShadowAction(host: ActionHost, e: Event): void {
    const folder = host.folderMenuFolder();
    if (!folder) return;
    const enabled = (e as CustomEvent<boolean>).detail;
    const next = { ...host.interestingShadow };
    if (enabled) next[folder.id] = true;
    else delete next[folder.id];
    host.interestingShadow = next;
    saveInterestingShadow(next);
}

export function feedSortChangeAction(host: ActionHost, e: Event): void {
    host.feedSort = (e as CustomEvent<FeedSort>).detail;
    saveFeedSort(host.feedSort);
}

export async function menuRefreshAction(host: ActionHost): Promise<void> {
    const feed = host.menuFeed();
    closeMenuAction(host);
    if (feed) await doRefresh(feed);
    window.dispatchEvent(new CustomEvent('feeds-refreshed'));
}

export async function menuDeleteAction(host: ActionHost): Promise<void> {
    const feed = host.menuFeed();
    if (feed) await doDeleteFeed(feed);
    closeMenuAction(host);
}

export function menuFoldersChangeAction(host: ActionHost, e: Event): void {
    const feed = host.menuFeed();
    if (feed) {
        void setFeedFolderMembership(feed.id, (e as CustomEvent<string[]>).detail);
    }
}

export async function folderMenuDeleteAction(host: ActionHost): Promise<void> {
    const folder = host.folderMenuFolder();
    if (folder) await doDeleteFolderAction(host, folder);
    closeFolderMenuAction(host);
}

export async function folderMenuRefreshAction(host: ActionHost): Promise<void> {
    const folder = host.folderMenuFolder();
    closeFolderMenuAction(host);
    if (folder) await refreshFolder(folder.id);
    window.dispatchEvent(new CustomEvent('feeds-refreshed'));
}

export async function sortFoldersAction(host: ActionHost): Promise<void> {
    const folders = host.libraryData.folders;
    if (folders.length < 2) return;
    if (
        confirm(
            'Sort folders alphabetically? This replaces your current folder order. You can drag folders to reorder them afterward.',
        )
    ) {
        const ids = [...folders]
            .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
            .map((f) => f.id);
        await reorderFolders(ids);
        closeFeedListMenuAction(host);
    }
}

export async function refreshAllAction(host: ActionHost): Promise<void> {
    closeFeedListMenuAction(host);
    await syncAllFeeds();
    window.dispatchEvent(new CustomEvent('feeds-refreshed'));
}

export function todaySettingsChangeAction(host: ActionHost, e: Event): void {
    const next = (e as CustomEvent<TodaySettings>).detail;
    host.todaySettings = pruneTodaySettings(
        next,
        host.libraryData.folders.map((f) => f.id),
    );
    saveTodaySettings(host.todaySettings);
    window.dispatchEvent(new CustomEvent('today-settings-changed'));
}
