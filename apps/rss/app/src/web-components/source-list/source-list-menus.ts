import type { MenuAnchor } from '../feed-menu/feed-menu';
import { anchorFromEvent } from './menu-popover';
import type { Feed, Folder, SavedSearch } from '../../types';

/** Menu open/close/anchor state the menu actions read and update. */
export interface MenuHost {
    menuTriggerFeedId: string | null;
    menuOpen: boolean;
    menuFeedId: string | null;
    menuAnchor: MenuAnchor | null;
    folderMenuTriggerId: string | null;
    folderMenuOpen: boolean;
    folderMenuFolderId: string | null;
    folderMenuAnchor: MenuAnchor | null;
    savedSearchMenuTriggerId: string | null;
    savedSearchMenuOpen: boolean;
    savedSearchMenuId: string | null;
    savedSearchMenuAnchor: MenuAnchor | null;
    feedListMenuTriggerId: string | null;
    feedListMenuOpen: boolean;
    feedListMenuAnchor: MenuAnchor | null;
    todayMenuOpen: boolean;
    todayMenuAnchor: MenuAnchor | null;
}

export function openFeedMenuAction(host: MenuHost, feed: Feed, e: MouseEvent): void {
    e.stopPropagation();
    if (host.menuOpen && host.menuTriggerFeedId === feed.id) {
        host.menuOpen = false;
        host.menuTriggerFeedId = null;
        return;
    }
    host.menuTriggerFeedId = feed.id;
    host.menuAnchor = anchorFromEvent(e);
    host.menuFeedId = feed.id;
    host.menuOpen = true;
}

export function closeMenuAction(host: MenuHost): void {
    host.menuOpen = false;
    host.menuTriggerFeedId = null;
}

export function openFolderMenuAction(host: MenuHost, folder: Folder, e: MouseEvent): void {
    e.stopPropagation();
    if (host.folderMenuOpen && host.folderMenuTriggerId === folder.id) {
        host.folderMenuOpen = false;
        host.folderMenuTriggerId = null;
        return;
    }
    host.folderMenuTriggerId = folder.id;
    host.folderMenuAnchor = anchorFromEvent(e);
    host.folderMenuFolderId = folder.id;
    host.folderMenuOpen = true;
}

export function closeFolderMenuAction(host: MenuHost): void {
    host.folderMenuOpen = false;
    host.folderMenuTriggerId = null;
}

export function openSavedSearchMenuAction(host: MenuHost, search: SavedSearch, e: MouseEvent): void {
    e.stopPropagation();
    if (host.savedSearchMenuOpen && host.savedSearchMenuTriggerId === search.id) {
        host.savedSearchMenuOpen = false;
        host.savedSearchMenuTriggerId = null;
        return;
    }
    host.savedSearchMenuTriggerId = search.id;
    host.savedSearchMenuAnchor = anchorFromEvent(e);
    host.savedSearchMenuId = search.id;
    host.savedSearchMenuOpen = true;
}

export function closeSavedSearchMenuAction(host: MenuHost): void {
    host.savedSearchMenuOpen = false;
    host.savedSearchMenuTriggerId = null;
}

export function openFeedListMenuAction(host: MenuHost, e: MouseEvent): void {
    e.stopPropagation();
    if (host.feedListMenuOpen && host.feedListMenuTriggerId === 'list') {
        host.feedListMenuOpen = false;
        host.feedListMenuTriggerId = null;
        return;
    }
    host.feedListMenuTriggerId = 'list';
    host.feedListMenuAnchor = anchorFromEvent(e);
    host.feedListMenuOpen = true;
}

export function closeFeedListMenuAction(host: MenuHost): void {
    host.feedListMenuOpen = false;
    host.feedListMenuTriggerId = null;
}

export function openTodayMenuAction(host: MenuHost, e: MouseEvent): void {
    e.stopPropagation();
    host.todayMenuOpen = !host.todayMenuOpen;
    if (host.todayMenuOpen) {
        host.todayMenuAnchor = anchorFromEvent(e);
    }
}
