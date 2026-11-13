import { html, svg } from 'lit';
import type { Feed, Folder, SavedSearch, View } from '../../types';
import type { ActionHost } from './source-list-actions';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH } from './source-list-settings';
import {
    feedSortChangeAction,
    folderMenuDeleteAction,
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
    openTodayMenuAction,
} from './source-list-menus';

/**
 * State and handlers the sidebar templates read. The component passes
 * itself (`this as never`, matching source-list-drag.ts) so the html
 * strings stay identical to the ones the class used to render.
 */
export interface SourceListRenderHost extends ActionHost {
    autoHide: boolean;
    totalUnread: number;
    interestingOrder: string[];
    toggleInterestingSection(): void;
    library: { error: Error | undefined; data?: { savedSearches?: SavedSearch[] } };
    icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash'): unknown;
    pinIcon(): unknown;
    filterIcon(): unknown;
    menuIcon(): unknown;
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

export function iconTemplate(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') {
    const paths: Record<string, ReturnType<typeof svg>> = {
        rss: svg`<circle cx="6" cy="18" r="2" fill="currentColor"></circle><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>`,
        folder: svg`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6"></path>`,
        all: svg`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle>`,
        refresh: svg`<path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>`,
        trash: svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>`,
    };
    return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
}

export function pinIconTemplate(autoHide: boolean) {
    const pin = svg`<line x1="12" x2="12" y1="17" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>`;
    const off = svg`<line x1="2" x2="22" y1="2" y2="22"></line>`;
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pin}${autoHide ? off : ''}</svg>`;
}

export function filterIconTemplate() {
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v5l-4 2v-7L3 4z"></path></svg>`;
}

export function menuIconTemplate() {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 10.2l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function feedRowTemplate(
    feed: Feed,
    active: boolean,
    onSelect: (feed: Feed) => void,
    onDragStart: (e: DragEvent, feed: Feed) => void,
    actions: unknown,
) {
    return html`
      <!-- pointer-only: the row opens the feed on pointer; keyboard users open it with the name button. -->
      <div class="feed-row ${active ? 'active' : ''} ${feed.unread > 0 ? 'has-unread' : ''}" data-feed-id="${feed.id}" draggable="true" @dragstart=${(e: DragEvent) => onDragStart(e, feed)} @click=${() => onSelect(feed)}>
        <button class="feed-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            onSelect(feed);
        }}><span class="dot"></span><span class="label" title="${feed.title}${feed.lastError ? ` — ${feed.lastError}` : ''}">${feed.title}</span>${feed.unread > 0 ? html`<span class="badge">${feed.unread}</span>` : ''}${feed.lastError ? html`<span class="feed-error" title="${feed.lastError}">⚠</span>` : ''}</button>
        ${actions}
      </div>
    `;
}

function folderToggleTemplate(isCollapsed: boolean, onToggle: (id: string) => void, folderId: string) {
    // A real button rather than a span with a click handler: this is the only
    // way to collapse a folder, and the arrow glyph says nothing to a screen
    // reader, so it carries the name and the expanded state too.
    return html`<button
        type="button"
        class="icon"
        aria-expanded=${!isCollapsed}
        aria-label=${isCollapsed ? 'Expand folder' : 'Collapse folder'}
        @click=${(e: Event) => {
            e.stopPropagation();
            onToggle(folderId);
        }}
    >${isCollapsed ? '▸' : '▾'}</button>`;
}

function folderHeaderTemplate(
    folder: Folder,
    active: boolean,
    isCollapsed: boolean,
    unread: number,
    onSelect: (folder: Folder) => void,
    onDragStart: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
) {
    return html`
      <!-- pointer-only: the row opens the folder on pointer; keyboard users open it with the name button. -->
      <div class="item ${active ? 'active' : ''}" data-folder-id="${folder.id}" draggable="true" @dragstart=${(e: DragEvent) => onDragStart(e, folder)} @click=${() => onSelect(folder)}>
        ${folderToggleTemplate(isCollapsed, onToggle, folder.id)}
        <button class="item-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            onSelect(folder);
        }}>${iconTemplate('folder')}<span class="label" title="${folder.title}">${folder.title}</span>${unread > 0 ? html`<span class="badge">${unread}</span>` : ''}</button>
        <button class="menu-btn" title="Folder options" @click=${(e: MouseEvent) => onOpenMenu(e, folder)}>${menuIconTemplate()}</button>
      </div>
    `;
}

/**
 * One Interesting section row. The visible text carries the folder title so
 * every row is distinct: "Interesting in Tech", "Interesting in Sport".
 */
function interestingRowTemplate(
    host: SourceListRenderHost,
    folder: Folder,
    active: boolean,
    count: number | undefined,
) {
    const name = `Interesting in ${folder.title}`;
    const empty = count === 0;
    return html`
      <div
        class="item ${active ? 'active' : ''} ${empty ? 'empty' : ''}"
        data-interesting-id="${folder.id}"
        draggable="true"
        @dragstart=${(e: DragEvent) => host.onDragStart(e, 'interesting', folder.id)}
        @click=${() => host.select({ kind: 'interesting', id: folder.id })}
      >
        <button
          class="item-open"
          aria-label=${name}
          title=${name}
          @click=${(e: MouseEvent) => {
              e.stopPropagation();
              host.select({ kind: 'interesting', id: folder.id });
          }}
        ><span class="icon" aria-hidden="true">✨</span><span class="label">${name}</span>${count && count > 0 ? html`<span class="badge">${count}</span>` : ''}</button>
      </div>
    `;
}

/**
 * Standalone Interesting section: one row per folder whose toggle is on.
 * Rendered above the folders so the smart views stay visible without
 * scrolling past a long folder list; the folders themselves are untouched.
 */
function renderInterestingSection(host: SourceListRenderHost, folders: Folder[]) {
    const ids = orderedInterestingFolderIds(host.interestingShadow, folders, host.interestingOrder);
    if (!ids.length) return html``;
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const enabled = ids.map((id) => folderById.get(id)).filter((f): f is Folder => !!f);
    if (!enabled.length) return html``;
    const collapsed = host.collapsed['__interesting__'] === true;
    return html`
      <div class="section-row">
        <button class="section-label-btn" aria-expanded=${!collapsed} @click=${() => host.toggleInterestingSection()}>
          <span class="chev" aria-hidden="true">${collapsed ? '▸' : '▾'}</span><span>Interesting</span>
        </button>
      </div>
      ${
          collapsed
              ? ''
              : enabled.map((folder) =>
                    interestingRowTemplate(
                        host,
                        folder,
                        host.isActive({ kind: 'interesting', id: folder.id }),
                        host.interestingCount(folder.id),
                    ),
                )
      }
    `;
}

export function folderRowTemplate(
    folder: Folder,
    feeds: Feed[],
    isCollapsed: boolean,
    active: boolean,
    unread: number,
    onSelectFolder: (folder: Folder) => void,
    onDragFolder: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
    feedRow: (feed: Feed) => unknown,
) {
    return html`
      <div>
        ${folderHeaderTemplate(folder, active, isCollapsed, unread, onSelectFolder, onDragFolder, onToggle, onOpenMenu)}
        ${isCollapsed ? '' : html`<div class="folder-children">${feeds.map((f) => feedRow(f))}</div>`}
      </div>
    `;
}

export function renderHead(host: SourceListRenderHost) {
    return html`<div class="sidebar-head"><button class="pin-btn filter-btn" title="Feed list options" @click=${(e: MouseEvent) => openFeedListMenuAction(host, e)}>${host.filterIcon()}</button><button class="pin-btn" title=${host.autoHide ? 'Pin the feed list open' : 'Auto-hide the feed list'} @click=${() => toggleAutoHideAction(host)}>${host.pinIcon()}</button></div>`;
}

export function renderNav(host: SourceListRenderHost, folders: Folder[], uncategorized: Feed[]) {
    const savedSearches = (host.libraryData as { savedSearches?: SavedSearch[] }).savedSearches ?? [];
    return html`<nav class="nav" @dragover=${host.onDragOver} @dragleave=${host.onDragLeave} @drop=${host.onDrop} @dragend=${host.onDragEnd}>${renderNavError(host)}${renderStaticNav(host)}${renderSavedSearches(host, savedSearches)}${renderInterestingSection(host, folders)}${folders.map((folder) => folderRow(host, folder))}${renderUncategorized(host, uncategorized)}<div class="drop-zone" data-no-folder>Drop here to move out of folders</div></nav>`;
}

function renderNavError(host: SourceListRenderHost) {
    return host.library.error
        ? html`<div class="nav-error">Could not load feeds. <button @click=${host.onRetryLibrary}>Retry</button></div>`
        : '';
}

function renderStaticNav(host: SourceListRenderHost) {
    return html`
      ${renderFrontPageNav(host)}${renderBriefNav(host)}${renderTodayNav(host)}${renderSavedNav(host)}${renderSearchNav(host)}${renderOrganizeNav(host)}${renderMuteFiltersNav(host)}${renderAllNav(host)}
    `;
}

function renderSavedNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'saved' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'saved' })}><span class="icon" aria-hidden="true">🔖</span><span class="label">Saved for later</span></button>`;
}

function renderOrganizeNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'organize' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'organize' })}><span class="icon" aria-hidden="true">⚙</span><span class="label">Organize</span></button>`;
}

function renderMuteFiltersNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'mute-filters' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'mute-filters' })}><span class="icon" aria-hidden="true">🔇</span><span class="label">Mute filters</span></button>`;
}

function savedSearchRow(host: SourceListRenderHost, search: SavedSearch) {
    const active = host.isActive({ kind: 'search', savedId: search.id });
    return html`
      <div class="item ${active ? 'active' : ''}" data-saved-search-id="${search.id}" draggable="true" @dragstart=${(e: DragEvent) => host.onDragStart(e, 'savedSearch', search.id)} @click=${() => host.select({ kind: 'search', q: search.query, scope: search.scopeKind, ...(search.scopeId ? { id: search.scopeId } : {}), savedId: search.id })}>
        <button class="item-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            host.select({
                kind: 'search',
                q: search.query,
                scope: search.scopeKind,
                ...(search.scopeId ? { id: search.scopeId } : {}),
                savedId: search.id,
            });
        }}><span class="icon" aria-hidden="true">🔎</span><span class="label" title="${search.title}">${search.title}</span>${search.unread > 0 ? html`<span class="badge">${search.unread}</span>` : ''}</button>
        <button class="menu-btn" title="Saved search options" @click=${(e: MouseEvent) => openSavedSearchMenuAction(host, search, e)}>${menuIconTemplate()}</button>
      </div>`;
}

function renderSavedSearches(host: SourceListRenderHost, searches: SavedSearch[]) {
    if (!searches.length) return html``;
    return html`<div class="section-label">Saved searches</div>${searches.map((s) => savedSearchRow(host, s))}`;
}

function renderSearchNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'search' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'search' })}><span class="icon" aria-hidden="true">🔎</span><span class="label">Search</span></button>`;
}

function renderFrontPageNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'frontpage' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'frontpage' })}><span class="icon">📰</span><span class="label">Front Page</span></button>`;
}

function renderBriefNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'brief' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'brief' })}><span class="icon">✨</span><span class="label">Daily Brief</span></button>`;
}

function renderTodayNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'today' });
    return html`
      <!-- pointer-only: the row opens Today on pointer; keyboard users open it with the name button. -->
      <div class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'today' })}>
        <button class="item-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            host.select({ kind: 'today' });
        }}><span class="icon">🗓</span><span class="label">Today</span></button><button class="menu-btn" title="Today options" @click=${(e: MouseEvent) => openTodayMenuAction(host, e)}>${host.menuIcon()}</button>
      </div>`;
}

function renderAllNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'all' });
    return html`<button class="item ${active ? 'active' : ''}" @click=${() => host.select({ kind: 'all' })}>${host.icon('all')}<span class="label">All</span>${host.totalUnread > 0 ? html`<span class="badge">${host.totalUnread}</span>` : ''}</button>`;
}

function renderUncategorized(host: SourceListRenderHost, uncategorized: Feed[]) {
    if (!uncategorized.length) return html``;
    return html`<div class="section-label">No folder</div>${uncategorized.map((feed) => feedRow(host, feed))}`;
}

export function renderResizeHandle(host: SourceListRenderHost) {
    // The WAI-ARIA window splitter: a separator the keyboard can move. Without
    // role, tabindex and a key path the sidebar width is reachable by pointer
    // only, and a keyboard user cannot set it at all.
    return html`<div
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow=${Math.round(host.sidebarWidth)}
        aria-valuemin=${MIN_SIDEBAR_WIDTH}
        aria-valuemax=${MAX_SIDEBAR_WIDTH}
        tabindex="0"
        title="Drag to resize"
        @pointerdown=${host.onResizeStart}
        @pointermove=${host.onResizeMove}
        @pointerup=${host.onResizeEnd}
        @pointercancel=${host.onResizeEnd}
        @keydown=${host.onResizeKey}
    ></div>`;
}

export function renderMenus(
    host: SourceListRenderHost,
    folders: Folder[],
    menuFeed: Feed | undefined,
    folderMenuFolder: Folder | undefined,
    savedSearchMenuSearch?: SavedSearch | undefined,
) {
    return html`
      <feed-menu .feed=${menuFeed ?? null} .folders=${folders} .open=${host.menuOpen && menuFeed !== undefined} .anchor=${host.menuAnchor} @close=${() => closeMenuAction(host)} @refresh=${() => menuRefreshAction(host)} @delete=${() => menuDeleteAction(host)} @folders-change=${(e: Event) => menuFoldersChangeAction(host, e)}></feed-menu>
      <folder-menu .folder=${folderMenuFolder ?? null} .open=${host.folderMenuOpen && folderMenuFolder !== undefined} .anchor=${host.folderMenuAnchor} .unreadOnly=${folderMenuFolder ? Boolean(host.hideReadByFolder[folderMenuFolder.id]) : false} .shadow=${folderMenuFolder ? host.interestingShadow[folderMenuFolder.id] === true : false} @close=${() => closeFolderMenuAction(host)} @delete=${() => folderMenuDeleteAction(host)} @refresh=${() => folderMenuRefreshAction(host)} @unread-only-change=${(e: Event) => folderMenuUnreadOnlyAction(host, e)} @shadow-change=${(e: Event) => folderMenuShadowAction(host, e)}></folder-menu>
      <saved-search-menu .search=${savedSearchMenuSearch ?? null} .open=${host.savedSearchMenuOpen && savedSearchMenuSearch !== undefined} .anchor=${host.savedSearchMenuAnchor} @close=${() => closeSavedSearchMenuAction(host)} @rename=${() => savedSearchMenuRenameAction(host)} @delete=${() => savedSearchMenuDeleteAction(host)}></saved-search-menu>
      <feed-list-menu .open=${host.feedListMenuOpen} .anchor=${host.feedListMenuAnchor} .feedSort=${host.feedSort} @close=${() => closeFeedListMenuAction(host)} @sort-change=${(e: Event) => feedSortChangeAction(host, e)} @sort-folders=${() => sortFoldersAction(host)} @refresh-all=${() => refreshAllAction(host)}></feed-list-menu>
      <today-menu .open=${host.todayMenuOpen} .anchor=${host.todayMenuAnchor} .folders=${folders} .settings=${host.todaySettings} @close=${() => (host.todayMenuOpen = false)} @settings-change=${(e: Event) => todaySettingsChangeAction(host, e)}></today-menu>
    `;
}

function feedActions(host: SourceListRenderHost, feed: Feed) {
    return html`
      <button
        class="menu-btn"
        title="Feed options"
        @click=${(e: MouseEvent) => openFeedMenuAction(host, feed, e)}
      >⋯</button>
    `;
}

function feedRow(host: SourceListRenderHost, feed: Feed) {
    const active = host.isActive({ kind: 'feed', id: feed.id });
    return feedRowTemplate(
        feed,
        active,
        (f) => host.select({ kind: 'feed', id: f.id }),
        (e, f) => host.onDragStart(e, 'feed', f.id),
        feedActions(host, feed),
    );
}

function folderRow(host: SourceListRenderHost, folder: Folder) {
    const feeds = host.folderFeeds(folder.id);
    const isCollapsed = Boolean(host.collapsed[folder.id]);
    const active = host.isActive({ kind: 'folder', id: folder.id });
    const unread = host.folderUnread(folder.id);
    return html`${folderRowTemplate(
        folder,
        feeds,
        isCollapsed,
        active,
        unread,
        (f) => host.select({ kind: 'folder', id: f.id }),
        (e, f) => host.onDragStart(e, 'folder', f.id),
        (id) => host.toggleFolder(id),
        (e, f) => openFolderMenuAction(host, f, e),
        (feed) => feedRow(host, feed),
    )}`;
}
