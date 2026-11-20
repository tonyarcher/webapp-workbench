import type { Feed, Folder, SavedSearch, View } from '../../types';
import type { ActionHost } from './source-list-actions';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './source-list-settings';
import {
    feedSortChangeAction,
    folderMenuDeleteAction,
    folderMenuIgnoreAction,
    folderMenuRefreshAction,
    folderMenuShadowAction,
    folderMenuUnreadOnlyAction,
    menuDeleteAction,
    menuFoldersChangeAction,
    menuRefreshAction,
    refreshAllAction,
    savedSearchMenuDeleteAction,
    savedSearchMenuRenameAction,
    sortFoldersAction,
    todaySettingsChangeAction,
    toggleAutoHideAction,
} from './source-list-actions';
import { orderedInterestingFolderIds } from '../../services/interesting-settings';
import {
    closeFeedListMenuAction,
    closeFolderMenuAction,
    closeMenuAction,
    closeSavedSearchMenuAction,
    openFeedListMenuAction,
    openFeedMenuAction,
    openFolderMenuAction,
    openSavedSearchMenuAction,
} from './source-list-menus';
import { append, el } from './source-list-dom';
import { icon, menuIcon, type IconKind } from './source-list-icons';
import { renderSettingsRow, renderStaticNav } from './source-list-nav';

/**
 * State and handlers the sidebar renderers read. The component passes itself
 * (`this as never`, matching source-list-drag.ts) so the group stays testable
 * without a live custom element.
 */
export interface SourceListRenderHost extends ActionHost {
    autoHide: boolean;
    totalUnread: number;
    toggleInterestingSection(): void;
    library: { readonly error: Error | undefined };
    icon(kind: IconKind): Node;
    pinIcon(): Node;
    filterIcon(): Node;
    menuIcon(): Node;
    folderFeeds(folderId: string): Feed[];
    folderUnread(folderId: string): number;
    interestingCount(folderId: string): number | undefined;
    isActive(view: View): boolean;
    select(view: View): void;
    onDragStart(e: DragEvent, kind: 'folder' | 'feed' | 'savedSearch' | 'interesting', id: string): void;
    onDragOver(e: DragEvent): void;
    onDragLeave(e: DragEvent): void;
    onDrop(e: DragEvent): Promise<void>;
    onDragEnd(): void;
    onResizeStart(e: PointerEvent): void;
    onResizeMove(e: PointerEvent): void;
    onResizeEnd(e: PointerEvent): void;
    onResizeKey(e: KeyboardEvent): void;
    sidebarWidth: number;
    onRetryLibrary(): void;
    toggleFolder(id: string): void;
}

function rowClass(active: boolean): string {
    return active ? 'item active' : 'item';
}

function feedRowClass(active: boolean, hasUnread: boolean): string {
    return `feed-row${active ? ' active' : ''}${hasUnread ? ' has-unread' : ''}`;
}

/** The scrolling nav. Created once: drag state lives on its class list. */
export function createNav(host: SourceListRenderHost): HTMLElement {
    const nav = el('nav', 'nav');
    nav.addEventListener('dragover', (e) => host.onDragOver(e));
    nav.addEventListener('dragleave', (e) => host.onDragLeave(e));
    nav.addEventListener('drop', (e) => void host.onDrop(e));
    nav.addEventListener('dragend', () => host.onDragEnd());
    return nav;
}

/** The landmark wrapper for the whole sidebar, created once. */
export function createSidebar(): HTMLElement {
    const sidebar = el('div', 'sidebar');
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'Feeds');
    return sidebar;
}

export function renderHead(host: SourceListRenderHost): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const filter = el('button', 'pin-btn filter-btn');
    filter.title = 'Feed list options';
    append(filter, host.filterIcon());
    filter.addEventListener('click', (e) => openFeedListMenuAction(host, e));
    const pin = el('button', 'pin-btn');
    pin.title = host.autoHide ? 'Pin the feed list open' : 'Auto-hide the feed list';
    append(pin, host.pinIcon());
    pin.addEventListener('click', () => toggleAutoHideAction(host));
    append(fragment, filter, pin);
    return fragment;
}

export function renderNav(host: SourceListRenderHost, folders: Folder[], uncategorized: Feed[]): DocumentFragment {
    // Reading order: Interesting, then the feed tree, then the views. The
    // settings panels are one row at the bottom: they used to sit above the
    // feeds, which pushed a reader's actual sources below the fold.
    const fragment = document.createDocumentFragment();
    append(
        fragment,
        renderNavError(host),
        renderInterestingSection(host, folders),
        ...folders.map((folder) => folderRow(host, folder)),
        renderUncategorized(host, uncategorized),
        dropZone(),
        renderSavedSearches(host, host.libraryData.savedSearches),
        renderStaticNav(host),
        renderSettingsRow(host),
    );
    return fragment;
}

function dropZone(): HTMLElement {
    const zone = el('div', 'drop-zone', 'Drop here to move out of folders');
    zone.setAttribute('data-no-folder', '');
    return zone;
}

function renderNavError(host: SourceListRenderHost): HTMLElement | null {
    if (!host.library.error) return null;
    const banner = el('div', 'nav-error', 'Could not load feeds. ');
    const retry = el('button', undefined, 'Retry');
    retry.addEventListener('click', () => host.onRetryLibrary());
    banner.appendChild(retry);
    return banner;
}

function savedSearchView(search: SavedSearch): View {
    return {
        kind: 'search',
        q: search.query,
        scope: search.scopeKind,
        ...(search.scopeId ? { id: search.scopeId } : {}),
        savedId: search.id,
    };
}

function savedSearchRow(host: SourceListRenderHost, search: SavedSearch): HTMLElement {
    const view = savedSearchView(search);
    const row = el('div', rowClass(host.isActive(view)));
    row.setAttribute('data-saved-search-id', search.id);
    row.draggable = true;
    row.addEventListener('dragstart', (e) => host.onDragStart(e, 'savedSearch', search.id));
    row.addEventListener('click', () => host.select(view));
    const open = el('button', 'item-open');
    open.addEventListener('click', (e) => {
        e.stopPropagation();
        host.select(view);
    });
    const glyph = el('span', 'icon', '🔎');
    glyph.setAttribute('aria-hidden', 'true');
    const label = el('span', 'label', search.title);
    label.title = search.title;
    append(open, glyph, label);
    if (search.unread > 0) append(open, el('span', 'badge', search.unread));
    const menu = el('button', 'menu-btn');
    menu.title = 'Saved search options';
    append(menu, host.menuIcon());
    menu.addEventListener('click', (e) => openSavedSearchMenuAction(host, search, e));
    append(row, open, menu);
    return row;
}

function renderSavedSearches(host: SourceListRenderHost, searches: SavedSearch[]): DocumentFragment | null {
    if (!searches.length) return null;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(el('div', 'section-label', 'Saved searches'));
    for (const search of searches) fragment.appendChild(savedSearchRow(host, search));
    return fragment;
}

/**
 * One Interesting row. The visible text carries the folder title so every row
 * is distinct: "Interesting in Tech", "Interesting in Sport".
 */
function interestingRow(
    host: SourceListRenderHost,
    folder: Folder,
    active: boolean,
    count: number | undefined,
): HTMLElement {
    const name = `Interesting in ${folder.title}`;
    const row = el('div', `item${active ? ' active' : ''}${count === 0 ? ' empty' : ''}`);
    row.setAttribute('data-interesting-id', folder.id);
    row.draggable = true;
    row.addEventListener('dragstart', (e) => host.onDragStart(e, 'interesting', folder.id));
    row.addEventListener('click', () => host.select({ kind: 'interesting', id: folder.id }));
    row.appendChild(interestingOpenButton(name, count, () => host.select({ kind: 'interesting', id: folder.id })));
    return row;
}

function interestingOpenButton(name: string, count: number | undefined, onSelect: () => void): HTMLButtonElement {
    const open = el('button', 'item-open');
    open.setAttribute('aria-label', name);
    open.title = name;
    open.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect();
    });
    const glyph = el('span', 'icon', '✨');
    glyph.setAttribute('aria-hidden', 'true');
    append(open, glyph, el('span', 'label', name));
    if (count && count > 0) append(open, el('span', 'badge', count));
    return open;
}

function interestingFolders(host: SourceListRenderHost, folders: Folder[]): Folder[] {
    const ids = orderedInterestingFolderIds(host.interestingShadow, folders, host.interestingOrder);
    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    return ids.map((id) => folderById.get(id)).filter((folder): folder is Folder => !!folder);
}

function interestingLabelRow(host: SourceListRenderHost, collapsed: boolean): HTMLElement {
    const labelRow = el('div', 'section-row');
    const label = el('button', 'section-label-btn');
    label.setAttribute('aria-expanded', String(!collapsed));
    const chevron = el('span', 'chev', collapsed ? '▸' : '▾');
    chevron.setAttribute('aria-hidden', 'true');
    append(label, chevron, el('span', undefined, 'Interesting'));
    label.addEventListener('click', () => host.toggleInterestingSection());
    labelRow.appendChild(label);
    return labelRow;
}

function renderInterestingSection(host: SourceListRenderHost, folders: Folder[]): DocumentFragment | null {
    const enabled = interestingFolders(host, folders);
    if (!enabled.length) return null;
    const collapsed = host.collapsed['__interesting__'] === true;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(interestingLabelRow(host, collapsed));
    if (collapsed) return fragment;
    for (const folder of enabled) {
        const active = host.isActive({ kind: 'interesting', id: folder.id });
        fragment.appendChild(interestingRow(host, folder, active, host.interestingCount(folder.id)));
    }
    return fragment;
}

function folderToggle(isCollapsed: boolean, onToggle: (id: string) => void, folderId: string): HTMLButtonElement {
    // A real button rather than a span with a click handler: this is the only
    // way to collapse a folder, and the arrow glyph says nothing to a screen
    // reader, so it carries the name and the expanded state too.
    const button = el('button', 'icon', isCollapsed ? '▸' : '▾');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(!isCollapsed));
    button.setAttribute('aria-label', isCollapsed ? 'Expand folder' : 'Collapse folder');
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggle(folderId);
    });
    return button;
}

function folderOpenButton(folder: Folder, unread: number, onSelect: (folder: Folder) => void): HTMLButtonElement {
    const button = el('button', 'item-open');
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(folder);
    });
    const label = el('span', 'label', folder.title);
    label.title = folder.title;
    append(button, icon('folder'), label);
    if (unread > 0) append(button, el('span', 'badge', unread));
    return button;
}

function folderHeader(
    folder: Folder,
    active: boolean,
    isCollapsed: boolean,
    unread: number,
    onSelect: (folder: Folder) => void,
    onDragStart: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
): HTMLElement {
    const row = el('div', rowClass(active));
    row.setAttribute('data-folder-id', folder.id);
    row.draggable = true;
    row.addEventListener('dragstart', (e) => onDragStart(e, folder));
    row.addEventListener('click', () => onSelect(folder));
    const menu = el('button', 'menu-btn');
    menu.title = 'Folder options';
    append(menu, menuIcon());
    menu.addEventListener('click', (e) => onOpenMenu(e, folder));
    append(row, folderToggle(isCollapsed, onToggle, folder.id), folderOpenButton(folder, unread, onSelect), menu);
    return row;
}

function folderRow(host: SourceListRenderHost, folder: Folder): HTMLElement {
    const wrapper = document.createElement('div');
    const isCollapsed = Boolean(host.collapsed[folder.id]);
    append(
        wrapper,
        folderHeader(
            folder,
            host.isActive({ kind: 'folder', id: folder.id }),
            isCollapsed,
            host.folderUnread(folder.id),
            (target) => host.select({ kind: 'folder', id: target.id }),
            (e, target) => host.onDragStart(e, 'folder', target.id),
            (id) => host.toggleFolder(id),
            (e, target) => openFolderMenuAction(host, target, e),
        ),
    );
    if (isCollapsed) return wrapper;
    const children = el('div', 'folder-children');
    for (const feed of host.folderFeeds(folder.id)) children.appendChild(feedRow(host, feed));
    wrapper.appendChild(children);
    return wrapper;
}

function feedOpenButton(feed: Feed, onSelect: (feed: Feed) => void): HTMLButtonElement {
    const button = el('button', 'feed-open');
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(feed);
    });
    const label = el('span', 'label', feed.title);
    label.title = feed.lastError ? `${feed.title} — ${feed.lastError}` : feed.title;
    append(button, el('span', 'dot'), label);
    if (feed.unread > 0) append(button, el('span', 'badge', feed.unread));
    const status = feed.status ?? 'ok';
    if (feed.lastError || status !== 'ok') {
        const error = el('span', `feed-error ${status}`, status === 'unreachable' ? '⚠' : '△');
        error.setAttribute('aria-label', status === 'unreachable' ? 'Feed unreachable' : 'Feed stale');
        error.title =
            status === 'unreachable'
                ? `${feed.title} — unreachable after ${feed.consecutiveFailures ?? 1} tries: ${feed.lastError ?? 'unknown error'}. Refresh from Feed options to retry.`
                : `${feed.title} — ${feed.lastError ?? 'no recent update'}`;
        button.appendChild(error);
    }
    return button;
}

function feedActions(host: SourceListRenderHost, feed: Feed): HTMLButtonElement {
    const button = el('button', 'menu-btn', '⋯');
    button.title = 'Feed options';
    button.addEventListener('click', (e) => openFeedMenuAction(host, feed, e));
    return button;
}

function feedRow(host: SourceListRenderHost, feed: Feed): HTMLElement {
    const row = el('div', feedRowClass(host.isActive({ kind: 'feed', id: feed.id }), feed.unread > 0));
    row.setAttribute('data-feed-id', feed.id);
    row.draggable = true;
    row.addEventListener('dragstart', (e) => host.onDragStart(e, 'feed', feed.id));
    row.addEventListener('click', () => host.select({ kind: 'feed', id: feed.id }));
    append(
        row,
        feedOpenButton(feed, (target) => host.select({ kind: 'feed', id: target.id })),
        feedActions(host, feed),
    );
    return row;
}

function renderUncategorized(host: SourceListRenderHost, uncategorized: Feed[]): DocumentFragment | null {
    if (!uncategorized.length) return null;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(el('div', 'section-label', 'No folder'));
    for (const feed of uncategorized) fragment.appendChild(feedRow(host, feed));
    return fragment;
}

export function createResizeHandle(host: SourceListRenderHost): HTMLElement {
    // The WAI-ARIA window splitter: a separator the keyboard can move. Without
    // role, tabindex and a key path the sidebar width is reachable by pointer
    // only, and a keyboard user cannot set it at all.
    const handle = el('div', 'resize-handle');
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize sidebar');
    handle.setAttribute('aria-valuemin', String(MIN_SIDEBAR_WIDTH));
    handle.setAttribute('aria-valuemax', String(MAX_SIDEBAR_WIDTH));
    handle.setAttribute('tabindex', '0');
    handle.title = 'Drag to resize';
    handle.addEventListener('pointerdown', (e) => host.onResizeStart(e));
    handle.addEventListener('pointermove', (e) => host.onResizeMove(e));
    handle.addEventListener('pointerup', (e) => host.onResizeEnd(e));
    handle.addEventListener('pointercancel', (e) => host.onResizeEnd(e));
    handle.addEventListener('keydown', (e) => host.onResizeKey(e));
    syncResizeHandle(handle, host);
    return handle;
}

/** aria-valuenow tracks the width. A drag writes it directly between paints. */
export function syncResizeHandle(handle: HTMLElement, host: SourceListRenderHost): void {
    handle.setAttribute('aria-valuenow', String(Math.round(host.sidebarWidth)));
}

export interface SourceListMenus {
    feed: HTMLElement;
    folder: HTMLElement;
    savedSearch: HTMLElement;
    feedList: HTMLElement;
    today: HTMLElement;
}

function feedMenu(host: SourceListRenderHost): HTMLElement {
    const menu = document.createElement('feed-menu');
    menu.addEventListener('close', () => closeMenuAction(host));
    menu.addEventListener('refresh', () => void menuRefreshAction(host));
    menu.addEventListener('delete', () => void menuDeleteAction(host));
    menu.addEventListener('folders-change', (e) => menuFoldersChangeAction(host, e));
    return menu;
}

function folderMenu(host: SourceListRenderHost): HTMLElement {
    const menu = document.createElement('folder-menu');
    menu.addEventListener('close', () => closeFolderMenuAction(host));
    menu.addEventListener('delete', () => void folderMenuDeleteAction(host));
    menu.addEventListener('refresh', () => void folderMenuRefreshAction(host));
    menu.addEventListener('unread-only-change', (e) => folderMenuUnreadOnlyAction(host, e));
    menu.addEventListener('shadow-change', (e) => folderMenuShadowAction(host, e));
    menu.addEventListener('ignore', () => folderMenuIgnoreAction(host));
    return menu;
}

function savedSearchMenu(host: SourceListRenderHost): HTMLElement {
    const menu = document.createElement('saved-search-menu');
    menu.addEventListener('close', () => closeSavedSearchMenuAction(host));
    menu.addEventListener('rename', () => void savedSearchMenuRenameAction(host));
    menu.addEventListener('delete', () => void savedSearchMenuDeleteAction(host));
    return menu;
}

function feedListMenu(host: SourceListRenderHost): HTMLElement {
    const menu = document.createElement('feed-list-menu');
    menu.addEventListener('close', () => closeFeedListMenuAction(host));
    menu.addEventListener('sort-change', (e) => feedSortChangeAction(host, e));
    menu.addEventListener('sort-folders', () => void sortFoldersAction(host));
    menu.addEventListener('refresh-all', () => void refreshAllAction(host));
    return menu;
}

function todayMenu(host: SourceListRenderHost): HTMLElement {
    const menu = document.createElement('today-menu');
    menu.addEventListener('close', () => {
        host.todayMenuOpen = false;
    });
    menu.addEventListener('settings-change', (e) => todaySettingsChangeAction(host, e));
    return menu;
}

export function createMenus(host: SourceListRenderHost): SourceListMenus {
    return {
        feed: feedMenu(host),
        folder: folderMenu(host),
        savedSearch: savedSearchMenu(host),
        feedList: feedListMenu(host),
        today: todayMenu(host),
    };
}

function updateFeedMenu(
    menu: HTMLElement,
    host: SourceListRenderHost,
    folders: Folder[],
    feed: Feed | undefined,
): void {
    Object.assign(menu, {
        feed: feed ?? null,
        folders,
        open: host.menuOpen && feed !== undefined,
        anchor: host.menuAnchor,
    });
}

function updateFolderMenu(menu: HTMLElement, host: SourceListRenderHost, folder: Folder | undefined): void {
    Object.assign(menu, {
        folder: folder ?? null,
        open: host.folderMenuOpen && folder !== undefined,
        anchor: host.folderMenuAnchor,
        unreadOnly: folder ? Boolean(host.hideReadByFolder[folder.id]) : false,
        shadow: folder ? host.interestingShadow[folder.id] === true : false,
        ignored: folder ? Boolean(host.ignoredFolders?.[folder.id]) : false,
    });
}

function updateSavedSearchMenu(menu: HTMLElement, host: SourceListRenderHost, search: SavedSearch | undefined): void {
    Object.assign(menu, {
        search: search ?? null,
        open: host.savedSearchMenuOpen && search !== undefined,
        anchor: host.savedSearchMenuAnchor,
    });
}

function updatePanelMenus(menus: SourceListMenus, host: SourceListRenderHost, folders: Folder[]): void {
    Object.assign(menus.feedList, {
        open: host.feedListMenuOpen,
        anchor: host.feedListMenuAnchor,
        feedSort: host.feedSort,
    });
    Object.assign(menus.today, {
        open: host.todayMenuOpen,
        anchor: host.todayMenuAnchor,
        folders,
        settings: host.todaySettings,
    });
}

export function updateMenus(
    menus: SourceListMenus,
    host: SourceListRenderHost,
    folders: Folder[],
    menuFeed: Feed | undefined,
    folderMenuFolder: Folder | undefined,
    savedSearchMenuSearch: SavedSearch | undefined,
): void {
    updateFeedMenu(menus.feed, host, folders, menuFeed);
    updateFolderMenu(menus.folder, host, folderMenuFolder);
    updateSavedSearchMenu(menus.savedSearch, host, savedSearchMenuSearch);
    updatePanelMenus(menus, host, folders);
}
