import { html, svg } from 'lit';
import type { Feed, Folder, View } from '../../types';
import type { ActionHost } from './source-list-actions';
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
    sortFoldersAction,
    todaySettingsChangeAction,
    toggleAutoHideAction,
} from './source-list-actions';
import {
    closeFeedListMenuAction,
    closeFolderMenuAction,
    closeMenuAction,
    openFeedListMenuAction,
    openFeedMenuAction,
    openFolderMenuAction,
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
    library: { error: Error | undefined };
    icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash'): unknown;
    pinIcon(): unknown;
    filterIcon(): unknown;
    menuIcon(): unknown;
    folderFeeds(folderId: string): Feed[];
    folderUnread(folderId: string): number;
    isActive(view: View): boolean;
    select(view: View): void;
    onItemKey(e: KeyboardEvent, view: View): void;
    onDragStart(e: DragEvent, kind: 'folder' | 'feed', id: string): void;
    onDragOver(e: DragEvent): void;
    onDragLeave(e: DragEvent): void;
    onDrop(e: DragEvent): Promise<void>;
    onDragEnd(): void;
    onResizeStart(e: PointerEvent): void;
    onResizeMove(e: PointerEvent): void;
    onResizeEnd(e: PointerEvent): void;
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
    onKey: (e: KeyboardEvent, feed: Feed) => void,
    onDragStart: (e: DragEvent, feed: Feed) => void,
    actions: unknown,
) {
    return html`
      <div class="feed-row ${active ? 'active' : ''} ${feed.unread > 0 ? 'has-unread' : ''}" data-feed-id="${feed.id}" draggable="true" role="button" tabindex="0" aria-label="Open feed ${feed.title}" @dragstart=${(e: DragEvent) => onDragStart(e, feed)} @click=${() => onSelect(feed)} @keydown=${(e: KeyboardEvent) => onKey(e, feed)}>
        <span class="dot"></span>
        <span class="label" title="${feed.title}${feed.lastError ? ` — ${feed.lastError}` : ''}">${feed.title}</span>
        ${feed.unread > 0 ? html`<span class="badge">${feed.unread}</span>` : ''}
        ${feed.lastError ? html`<span class="feed-error" title="${feed.lastError}">⚠</span>` : ''}
        ${actions}
      </div>
    `;
}

function folderHeaderTemplate(
    folder: Folder,
    active: boolean,
    isCollapsed: boolean,
    unread: number,
    onSelect: (folder: Folder) => void,
    onKey: (e: KeyboardEvent, folder: Folder) => void,
    onDragStart: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
    shadow: boolean,
) {
    return html`
      <div class="item ${active ? 'active' : ''}" data-folder-id="${folder.id}" draggable="true" role="button" tabindex="0" aria-label="Open folder ${folder.title}" @dragstart=${(e: DragEvent) => onDragStart(e, folder)} @click=${() => onSelect(folder)} @keydown=${(e: KeyboardEvent) => onKey(e, folder)}>
        <span class="icon" style="cursor:pointer" @click=${(e: Event) => {
            e.stopPropagation();
            onToggle(folder.id);
        }}>${isCollapsed ? '▸' : '▾'}</span>
        ${iconTemplate('folder')}
        <span class="label" title="${folder.title}">${folder.title}</span>
        ${shadow ? html`<span class="shadow-mark" title="Interesting filter available">✨</span>` : ''}
        ${unread > 0 ? html`<span class="badge">${unread}</span>` : ''}
        <button class="menu-btn" title="Folder options" @click=${(e: MouseEvent) => onOpenMenu(e, folder)}>${menuIconTemplate()}</button>
      </div>
    `;
}

export function folderRowTemplate(
    folder: Folder,
    feeds: Feed[],
    isCollapsed: boolean,
    active: boolean,
    unread: number,
    onSelectFolder: (folder: Folder) => void,
    onKeyFolder: (e: KeyboardEvent, folder: Folder) => void,
    onDragFolder: (e: DragEvent, folder: Folder) => void,
    onToggle: (id: string) => void,
    onOpenMenu: (e: MouseEvent, folder: Folder) => void,
    feedRow: (feed: Feed) => unknown,
    shadow = false,
) {
    return html`
      <div>
        ${folderHeaderTemplate(folder, active, isCollapsed, unread, onSelectFolder, onKeyFolder, onDragFolder, onToggle, onOpenMenu, shadow)}
        ${isCollapsed ? '' : html`<div class="folder-children">${feeds.map((f) => feedRow(f))}</div>`}
      </div>
    `;
}

export function renderHead(host: SourceListRenderHost) {
    return html`<div class="sidebar-head"><button class="pin-btn filter-btn" title="Feed list options" @click=${(e: MouseEvent) => openFeedListMenuAction(host, e)}>${host.filterIcon()}</button><button class="pin-btn" title=${host.autoHide ? 'Pin the feed list open' : 'Auto-hide the feed list'} @click=${() => toggleAutoHideAction(host)}>${host.pinIcon()}</button></div>`;
}

export function renderNav(host: SourceListRenderHost, folders: Folder[], uncategorized: Feed[]) {
    return html`<nav class="nav" @dragover=${host.onDragOver} @dragleave=${host.onDragLeave} @drop=${host.onDrop} @dragend=${host.onDragEnd}>${renderNavError(host)}${renderStaticNav(host)}${folders.map((folder) => folderRow(host, folder))}${renderUncategorized(host, uncategorized)}<div class="drop-zone" data-no-folder>Drop here to move out of folders</div></nav>`;
}

function renderNavError(host: SourceListRenderHost) {
    return host.library.error
        ? html`<div class="nav-error">Could not load feeds. <button @click=${host.onRetryLibrary}>Retry</button></div>`
        : '';
}

function renderStaticNav(host: SourceListRenderHost) {
    return html`
      ${renderFrontPageNav(host)}${renderBriefNav(host)}${renderTodayNav(host)}${renderAllNav(host)}
    `;
}

function renderFrontPageNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'frontpage' });
    return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="Front Page" @click=${() => host.select({ kind: 'frontpage' })} @keydown=${(e: KeyboardEvent) => host.onItemKey(e, { kind: 'frontpage' })}><span class="icon">📰</span><span class="label">Front Page</span></div>`;
}

function renderBriefNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'brief' });
    return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="Daily Brief" @click=${() => host.select({ kind: 'brief' })} @keydown=${(e: KeyboardEvent) => host.onItemKey(e, { kind: 'brief' })}><span class="icon">✨</span><span class="label">Daily Brief</span></div>`;
}

function renderTodayNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'today' });
    return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="Today" @click=${() => host.select({ kind: 'today' })} @keydown=${(e: KeyboardEvent) => host.onItemKey(e, { kind: 'today' })}><span class="icon">🗓</span><span class="label">Today</span><button class="menu-btn" title="Today options" @click=${(e: MouseEvent) => openTodayMenuAction(host, e)}>${host.menuIcon()}</button></div>`;
}

function renderAllNav(host: SourceListRenderHost) {
    const active = host.isActive({ kind: 'all' });
    return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="All feeds" @click=${() => host.select({ kind: 'all' })} @keydown=${(e: KeyboardEvent) => host.onItemKey(e, { kind: 'all' })}>${host.icon('all')}<span class="label">All</span>${host.totalUnread > 0 ? html`<span class="badge">${host.totalUnread}</span>` : ''}</div>`;
}

function renderUncategorized(host: SourceListRenderHost, uncategorized: Feed[]) {
    if (!uncategorized.length) return html``;
    return html`<div class="section-label">No folder</div>${uncategorized.map((feed) => feedRow(host, feed))}`;
}

export function renderResizeHandle(host: SourceListRenderHost) {
    return html`<div class="resize-handle" title="Drag to resize" @pointerdown=${host.onResizeStart} @pointermove=${host.onResizeMove} @pointerup=${host.onResizeEnd} @pointercancel=${host.onResizeEnd}></div>`;
}

export function renderMenus(
    host: SourceListRenderHost,
    folders: Folder[],
    menuFeed: Feed | undefined,
    folderMenuFolder: Folder | undefined,
) {
    return html`
      <feed-menu .feed=${menuFeed ?? null} .folders=${folders} .open=${host.menuOpen && menuFeed !== undefined} .anchor=${host.menuAnchor} @close=${() => closeMenuAction(host)} @refresh=${() => menuRefreshAction(host)} @delete=${() => menuDeleteAction(host)} @folders-change=${(e: Event) => menuFoldersChangeAction(host, e)}></feed-menu>
      <folder-menu .folder=${folderMenuFolder ?? null} .open=${host.folderMenuOpen && folderMenuFolder !== undefined} .anchor=${host.folderMenuAnchor} .unreadOnly=${folderMenuFolder ? Boolean(host.hideReadByFolder[folderMenuFolder.id]) : false} .shadow=${folderMenuFolder ? host.interestingShadow[folderMenuFolder.id] === true : false} @close=${() => closeFolderMenuAction(host)} @delete=${() => folderMenuDeleteAction(host)} @refresh=${() => folderMenuRefreshAction(host)} @unread-only-change=${(e: Event) => folderMenuUnreadOnlyAction(host, e)} @shadow-change=${(e: Event) => folderMenuShadowAction(host, e)}></folder-menu>
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
        (e, f) => host.onItemKey(e, { kind: 'feed', id: f.id }),
        (e, f) => host.onDragStart(e, 'feed', f.id),
        feedActions(host, feed),
    );
}

function folderRow(host: SourceListRenderHost, folder: Folder) {
    const feeds = host.folderFeeds(folder.id);
    const isCollapsed = Boolean(host.collapsed[folder.id]);
    const active = host.isActive({ kind: 'folder', id: folder.id });
    const unread = host.folderUnread(folder.id);
    const shadow = host.interestingShadow[folder.id] === true;
    return html`${folderRowTemplate(
        folder,
        feeds,
        isCollapsed,
        active,
        unread,
        (f) => host.select({ kind: 'folder', id: f.id }),
        (e, f) => host.onItemKey(e, { kind: 'folder', id: f.id }),
        (e, f) => host.onDragStart(e, 'folder', f.id),
        (id) => host.toggleFolder(id),
        (e, f) => openFolderMenuAction(host, f, e),
        (feed) => feedRow(host, feed),
        shadow,
    )}`;
}
