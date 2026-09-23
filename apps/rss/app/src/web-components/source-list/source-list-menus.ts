import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { Feed, Folder } from '../../types';

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
    feedListMenuTriggerId: string | null;
    feedListMenuOpen: boolean;
    feedListMenuAnchor: MenuAnchor | null;
    todayMenuOpen: boolean;
    todayMenuAnchor: MenuAnchor | null;
}

export function openFeedMenuAction(host: MenuHost, feed: Feed, e: MouseEvent): void {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    if (host.menuOpen && host.menuTriggerFeedId === feed.id) {
        host.menuOpen = false;
        host.menuTriggerFeedId = null;
        return;
    }
    const rect = btn.getBoundingClientRect();
    host.menuTriggerFeedId = feed.id;
    host.menuAnchor = { x: rect.left, y: rect.bottom };
    host.menuFeedId = feed.id;
    host.menuOpen = true;
}

export function closeMenuAction(host: MenuHost): void {
    host.menuOpen = false;
    host.menuTriggerFeedId = null;
}

export function openFolderMenuAction(host: MenuHost, folder: Folder, e: MouseEvent): void {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    if (host.folderMenuOpen && host.folderMenuTriggerId === folder.id) {
        host.folderMenuOpen = false;
        host.folderMenuTriggerId = null;
        return;
    }
    const rect = btn.getBoundingClientRect();
    host.folderMenuTriggerId = folder.id;
    host.folderMenuAnchor = { x: rect.left, y: rect.bottom };
    host.folderMenuFolderId = folder.id;
    host.folderMenuOpen = true;
}

export function closeFolderMenuAction(host: MenuHost): void {
    host.folderMenuOpen = false;
    host.folderMenuTriggerId = null;
}

export function openFeedListMenuAction(host: MenuHost, e: MouseEvent): void {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    if (host.feedListMenuOpen && host.feedListMenuTriggerId === 'list') {
        host.feedListMenuOpen = false;
        host.feedListMenuTriggerId = null;
        return;
    }
    const rect = btn.getBoundingClientRect();
    host.feedListMenuTriggerId = 'list';
    host.feedListMenuAnchor = { x: rect.left, y: rect.bottom };
    host.feedListMenuOpen = true;
}

export function closeFeedListMenuAction(host: MenuHost): void {
    host.feedListMenuOpen = false;
    host.feedListMenuTriggerId = null;
}

export function openTodayMenuAction(host: MenuHost, e: MouseEvent): void {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    host.todayMenuOpen = !host.todayMenuOpen;
    if (host.todayMenuOpen) {
        const rect = btn.getBoundingClientRect();
        host.todayMenuAnchor = { x: rect.left, y: rect.bottom };
    }
}
