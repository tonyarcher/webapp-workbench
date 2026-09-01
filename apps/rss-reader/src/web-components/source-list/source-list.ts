import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {libraryKey, queryClient, QueryController} from '../../query';
import {deleteFeed, deleteFolder, refreshFeed, refreshFolder, reorderFolders, setFeedFolderMembership, syncAllFeeds} from '../../mutations';
import {getLibrary} from '../../services/api';
import {navigate} from '../../router';
import {loadTodaySettings, pruneTodaySettings, saveTodaySettings, type TodaySettings} from '../../services/today-settings';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import type {Feed, FeedSort, Folder, View} from '../../types';
import '../feed-list-menu/feed-list-menu';
import '../today-menu/today-menu';
import styles from './source-list.css?inline';
import {feedRowTemplate, filterIconTemplate, folderRowTemplate, iconTemplate, menuIconTemplate, pinIconTemplate} from './source-list-render';
import {dropFolderId, folderFeedsFor, folderUnreadFor, uncategorizedFor} from './source-list-helpers';
import {handleDragOver, handleDragStart, handleEndDrag, handleFeedMove, handleFolderReorder} from './source-list-drag';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const COLLAPSED_KEY = 'rss-reader:collapsed-folders';
const AUTO_HIDE_KEY = 'rss-reader:auto-hide-sidebar';
const SIDEBAR_WIDTH_KEY = 'rss-reader:sidebar-width';
const FEED_SORT_KEY = 'rss-reader:feed-sort';
const HIDE_READ_KEY = 'rss-reader:hide-read-by-folder';
const MIN_SIDEBAR_WIDTH = 140;
const MAX_SIDEBAR_WIDTH = 480;

function loadCollapsed(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(COLLAPSED_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

function loadFeedSort(): FeedSort {
    try {
        return localStorage.getItem(FEED_SORT_KEY) === 'unread' ? 'unread' : 'alpha';
    } catch {
        return 'alpha';
    }
}

function loadHideReadByFolder(): Record<string, boolean> {
    try {
        const raw = localStorage.getItem(HIDE_READ_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

function loadAutoHide(): boolean {
    try {
        return localStorage.getItem(AUTO_HIDE_KEY) === '1';
    } catch {
        return false;
    }
}

@customElement('source-list')
export class SourceList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) view: View = {kind: 'all'};
    @property({attribute: 'auto-hide', type: Boolean, reflect: true}) autoHide = loadAutoHide();
    @property({attribute: 'hover', type: Boolean, reflect: true}) hover = false;
    @state() private collapsed: Record<string, boolean> = loadCollapsed();
    @state() private feedSort: FeedSort = loadFeedSort();
    @state() private hideReadByFolder: Record<string, boolean> = loadHideReadByFolder();

    private hideTimer: number | null = null;
    private resizing = false;
    private resizeHandleEl: HTMLElement | null = null;
    private feedListMenuTriggerId: string | null = null;
    @state() private feedListMenuOpen = false;
    @state() private feedListMenuAnchor: MenuAnchor | null = null;

    private dragging: { kind: 'folder' | 'feed'; id: string } | null = null;
    private dragTargetEl: HTMLElement | null = null;
    private menuTriggerFeedId: string | null = null;
    @state() private menuOpen = false;
    @state() private menuFeedId: string | null = null;
    @state() private menuAnchor: MenuAnchor | null = null;
    private folderMenuTriggerId: string | null = null;
    @state() private folderMenuOpen = false;
    @state() private folderMenuFolderId: string | null = null;
    @state() private folderMenuAnchor: MenuAnchor | null = null;
    @state() private todayMenuOpen = false;
    @state() private todayMenuAnchor: MenuAnchor | null = null;
    @state() private todaySettings: TodaySettings = loadTodaySettings();

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => getLibrary(),
        refetchInterval: 60_000,
    }));

    private get libraryData(): Library {
        return this.library.data ?? {folders: [], feeds: []};
    }

    private get totalUnread(): number {
        return this.libraryData.feeds.reduce((sum, f) => sum + f.unread, 0);
    }

    override connectedCallback() {
        super.connectedCallback();
        this.style.setProperty('--sidebar-width', `${this.savedWidth()}px`);
        this.addEventListener('mouseenter', this.onHoverEnter);
        this.addEventListener('mouseleave', this.onHoverLeave);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('mouseenter', this.onHoverEnter);
        this.removeEventListener('mouseleave', this.onHoverLeave);
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    override render() {
        const {folders} = this.libraryData;
        const uncategorized = this.uncategorizedFeeds();
        const menuFeed = this.menuFeed();
        const folderMenuFolder = this.folderMenuFolder();
        return html`
      ${this.renderHead()}
      ${this.renderNav(folders, uncategorized)}
      ${this.renderResizeHandle()}
      ${this.renderMenus(folders, menuFeed, folderMenuFolder)}
    `;
    }

    private renderHead() {
        return html`<div class="sidebar-head"><button class="pin-btn filter-btn" title="Feed list options" @click=${(e: MouseEvent) => this.openFeedListMenu(e)}>${this.filterIcon()}</button><button class="pin-btn" title=${this.autoHide ? 'Pin the feed list open' : 'Auto-hide the feed list'} @click=${this.toggleAutoHide}>${this.pinIcon()}</button></div>`;
    }

    private renderNav(folders: Folder[], uncategorized: Feed[]) {
        return html`<nav class="nav" @dragover=${this.onDragOver} @dragleave=${this.onDragLeave} @drop=${this.onDrop} @dragend=${this.onDragEnd}>${this.renderNavError()}${this.renderStaticNav()}${folders.map((folder) => this.folderRow(folder))}${this.renderUncategorized(uncategorized)}<div class="drop-zone" data-no-folder>Drop here to move out of folders</div></nav>`;
    }

    private renderNavError() {
        return this.library.error ? html`<div class="nav-error">Could not load feeds. <button @click=${this.onRetryLibrary}>Retry</button></div>` : '';
    }

    private renderStaticNav() {
        return html`
      ${this.renderBriefNav()}${this.renderTodayNav()}${this.renderAllNav()}
    `;
    }

    private renderBriefNav() {
        const active = this.isActive({kind: 'brief'});
        return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="Daily Brief" @click=${() => this.select({kind: 'brief'})} @keydown=${(e: KeyboardEvent) => this.onItemKey(e, {kind: 'brief'})}><span class="icon">✨</span><span class="label">Daily Brief</span></div>`;
    }

    private renderTodayNav() {
        const active = this.isActive({kind: 'today'});
        return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="Today" @click=${() => this.select({kind: 'today'})} @keydown=${(e: KeyboardEvent) => this.onItemKey(e, {kind: 'today'})}><span class="icon">🗓</span><span class="label">Today</span><button class="menu-btn" title="Today options" @click=${(e: MouseEvent) => this.openTodayMenu(e)}>${this.menuIcon()}</button></div>`;
    }

    private renderAllNav() {
        const active = this.isActive({kind: 'all'});
        return html`<div class="item ${active ? 'active' : ''}" role="button" tabindex="0" aria-label="All feeds" @click=${() => this.select({kind: 'all'})} @keydown=${(e: KeyboardEvent) => this.onItemKey(e, {kind: 'all'})}>${this.icon('all')}<span class="label">All</span>${this.totalUnread > 0 ? html`<span class="badge">${this.totalUnread}</span>` : ''}</div>`;
    }

    private renderUncategorized(uncategorized: Feed[]) {
        if (!uncategorized.length) return html``;
        return html`<div class="section-label">No folder</div>${uncategorized.map((feed) => this.feedRow(feed))}`;
    }

    private renderResizeHandle() {
        return html`<div class="resize-handle" title="Drag to resize" @pointerdown=${this.onResizeStart} @pointermove=${this.onResizeMove} @pointerup=${this.onResizeEnd} @pointercancel=${this.onResizeEnd}></div>`;
    }

    private renderMenus(folders: Folder[], menuFeed: Feed | undefined, folderMenuFolder: Folder | undefined) {
        return html`
      <feed-menu .feed=${menuFeed ?? null} .folders=${folders} .open=${this.menuOpen && menuFeed !== undefined} .anchor=${this.menuAnchor} @close=${this.closeMenu} @refresh=${this.onMenuRefresh} @delete=${this.onMenuDelete} @folders-change=${this.onMenuFoldersChange}></feed-menu>
      <folder-menu .folder=${folderMenuFolder ?? null} .open=${this.folderMenuOpen && folderMenuFolder !== undefined} .anchor=${this.folderMenuAnchor} .unreadOnly=${folderMenuFolder ? Boolean(this.hideReadByFolder[folderMenuFolder.id]) : false} @close=${this.closeFolderMenu} @delete=${this.onFolderMenuDelete} @refresh=${this.onFolderMenuRefresh} @unread-only-change=${this.onFolderMenuUnreadOnly}></folder-menu>
      <feed-list-menu .open=${this.feedListMenuOpen} .anchor=${this.feedListMenuAnchor} .feedSort=${this.feedSort} @close=${this.closeFeedListMenu} @sort-change=${this.onFeedSortChange} @sort-folders=${this.onSortFolders} @refresh-all=${this.onRefreshAll}></feed-list-menu>
      <today-menu .open=${this.todayMenuOpen} .anchor=${this.todayMenuAnchor} .folders=${folders} .settings=${this.todaySettings} @close=${() => (this.todayMenuOpen = false)} @settings-change=${this.onTodaySettingsChange}></today-menu>
    `;
    }

    private icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') { return iconTemplate(kind); }

    private onHoverEnter = () => {
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        this.hover = true;
    };

    private onHoverLeave = () => {
        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        this.hideTimer = window.setTimeout(() => {
            this.hideTimer = null;
            this.hover = false;
        }, 1500);
    };

    private savedWidth(): number {
        try {
            const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
            const width = raw ? Number(raw) : NaN;
            return Number.isFinite(width) ? width : 280;
        } catch {
            return 280;
        }
    }

    private onResizeStart(e: PointerEvent) {
        if (e.button !== 0) return;
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        this.resizeHandleEl = handle;
        this.resizing = true;
        handle.classList.add('resizing');
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
        this.hover = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }

    private onResizeMove(e: PointerEvent) {
        if (!this.resizing) return;
        const rect = this.getBoundingClientRect();
        const width = Math.round(
            Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX - rect.left)),
        );
        this.style.setProperty('--sidebar-width', `${width}px`);
        try {
            localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        } catch {
            // storage unavailable; sidebar width just won't persist
        }
    }

    private onResizeEnd(e: PointerEvent) {
        if (!this.resizing) return;
        this.resizing = false;
        this.resizeHandleEl?.classList.remove('resizing');
        if (this.resizeHandleEl?.hasPointerCapture(e.pointerId)) {
            this.resizeHandleEl.releasePointerCapture(e.pointerId);
        }
        this.resizeHandleEl = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (this.autoHide) {
            const rect = this.getBoundingClientRect();
            const over =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;
            if (!over) this.onHoverLeave();
        }
    }

    private toggleAutoHide() {
        this.autoHide = !this.autoHide;
        try {
            localStorage.setItem(AUTO_HIDE_KEY, this.autoHide ? '1' : '0');
        } catch {
            // storage unavailable; auto-hide state just won't persist
        }
    }

    private pinIcon() { return pinIconTemplate(this.autoHide); }

    private filterIcon() { return filterIconTemplate(); }

    private folderUnread(folderId: string): number { return folderUnreadFor(this.libraryData.feeds, folderId); }

    private folderFeeds(folderId: string): Feed[] { return folderFeedsFor(this.libraryData.feeds, folderId, this.feedSort, this.hideReadByFolder); }

    private uncategorizedFeeds(): Feed[] { return uncategorizedFor(this.libraryData.feeds, this.feedSort); }

    private openFeedListMenu(e: MouseEvent) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        if (this.feedListMenuOpen && this.feedListMenuTriggerId === 'list') {
            this.feedListMenuOpen = false;
            this.feedListMenuTriggerId = null;
            return;
        }
        const rect = btn.getBoundingClientRect();
        this.feedListMenuTriggerId = 'list';
        this.feedListMenuAnchor = {x: rect.left, y: rect.bottom};
        this.feedListMenuOpen = true;
    }

    private closeFeedListMenu() {
        this.feedListMenuOpen = false;
        this.feedListMenuTriggerId = null;
    }

    private onFeedSortChange(e: Event) {
        this.feedSort = (e as CustomEvent<FeedSort>).detail;
        try {
            localStorage.setItem(FEED_SORT_KEY, this.feedSort);
        } catch {
            // storage unavailable; sort preference just won't persist
        }
    }

    private onHideChange(e: Event) {
        const {key, unreadOnly} = (e as CustomEvent<{ key: string; unreadOnly: boolean }>).detail;
        this.hideReadByFolder = {...this.hideReadByFolder, [key]: unreadOnly};
        try {
            localStorage.setItem(HIDE_READ_KEY, JSON.stringify(this.hideReadByFolder));
        } catch {
            // storage unavailable; filter preference just won't persist
        }
    }

    private onFolderMenuUnreadOnly(e: Event) {
        const folder = this.folderMenuFolder();
        if (!folder) return;
        this.onHideChange(
            new CustomEvent('folder-toggle', {
                detail: {key: folder.id, unreadOnly: (e as CustomEvent<boolean>).detail},
            }),
        );
    }

    private async onSortFolders() {
        const folders = this.libraryData.folders;
        if (folders.length < 2) return;
        if (
            confirm(
                'Sort folders alphabetically? This replaces your current folder order. You can drag folders to reorder them afterward.',
            )
        ) {
            const ids = [...folders]
                .sort((a, b) => a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}))
                .map((f) => f.id);
            await reorderFolders(ids);
            this.closeFeedListMenu();
        }
    }

    private select(view: View) {
        navigate(view);
    }

    private isActive(view: View): boolean {
        if (this.view.kind !== view.kind) return false;
        if (this.view.kind === 'all' || this.view.kind === 'brief' || this.view.kind === 'today') return true;
        return (this.view as { id: string }).id === (view as { id: string }).id;
    }

    private toggleFolder(id: string) {
        const next = {...this.collapsed, [id]: !this.collapsed[id]};
        this.collapsed = next;
        try {
            localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
        } catch {
            // storage unavailable; collapse state just won't persist
        }
    }

    private onDragStart(e: DragEvent, kind: 'folder' | 'feed', id: string) { handleDragStart(this as never, e, kind, id); }

    private onDragOver(e: DragEvent) { handleDragOver(this as never, e); }

    private onDragLeave(e: DragEvent) {
        const nav = this.shadowRoot?.querySelector('.nav');
        const related = e.relatedTarget as Node | null;
        if (!nav || !nav.contains(related)) this.clearDragOver();
    }

    private clearDragOver() {
        this.dragTargetEl?.classList.remove('drag-over');
        this.dragTargetEl = null;
    }

    private dropTarget(e: DragEvent): { folderId: string | null } { return {folderId: dropFolderId(this.dragging?.kind ?? null, e.target as HTMLElement, this.libraryData.feeds)}; }

    private async onDrop(e: DragEvent) {
        e.preventDefault();
        if (!this.dragging) return;
        const target = this.dropTarget(e);
        if (this.dragging.kind === 'folder') await this.applyFolderReorder(this.dragging.id, target);
        else await this.applyFeedMove(this.dragging.id, target);
        this.endDrag();
    }

    private onDragEnd() { handleEndDrag(this as never); }

    private endDrag() { handleEndDrag(this as never); }

    private async applyFolderReorder(folderId: string, target: { folderId: string | null }) { await handleFolderReorder(this as never, folderId, target); }

    private async applyFeedMove(feedId: string, target: { folderId: string | null }) { await handleFeedMove(this as never, feedId, target); }

    private openMenu(feed: Feed, e: MouseEvent) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        if (this.menuOpen && this.menuTriggerFeedId === feed.id) {
            this.menuOpen = false;
            this.menuTriggerFeedId = null;
            return;
        }
        const rect = btn.getBoundingClientRect();
        this.menuTriggerFeedId = feed.id;
        this.menuAnchor = {x: rect.left, y: rect.bottom};
        this.menuFeedId = feed.id;
        this.menuOpen = true;
    }

    private closeMenu() {
        this.menuOpen = false;
        this.menuTriggerFeedId = null;
    }

    private menuFeed(): Feed | undefined {
        return this.libraryData.feeds.find((f) => f.id === this.menuFeedId);
    }

    private async onMenuRefresh() {
        const feed = this.menuFeed();
        this.closeMenu();
        if (feed) await this.doRefresh(feed);
        window.dispatchEvent(new CustomEvent('feeds-refreshed'));
    }

    private async onMenuDelete() {
        const feed = this.menuFeed();
        if (feed) await this.doDeleteFeed(feed);
        this.closeMenu();
    }

    private onMenuFoldersChange(e: Event) {
        const feed = this.menuFeed();
        if (feed) {
            void setFeedFolderMembership(feed.id, (e as CustomEvent<string[]>).detail);
        }
    }

    private feedActions(feed: Feed) {
        return html`
      <button
        class="menu-btn"
        title="Feed options"
        @click=${(e: MouseEvent) => this.openMenu(feed, e)}
      >⋯</button>
    `;
    }

    private menuIcon() { return menuIconTemplate(); }

    private openFolderMenu(folder: Folder, e: MouseEvent) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        if (this.folderMenuOpen && this.folderMenuTriggerId === folder.id) {
            this.folderMenuOpen = false;
            this.folderMenuTriggerId = null;
            return;
        }
        const rect = btn.getBoundingClientRect();
        this.folderMenuTriggerId = folder.id;
        this.folderMenuAnchor = {x: rect.left, y: rect.bottom};
        this.folderMenuFolderId = folder.id;
        this.folderMenuOpen = true;
    }

    private closeFolderMenu() {
        this.folderMenuOpen = false;
        this.folderMenuTriggerId = null;
    }

    private openTodayMenu(e: MouseEvent) {
        e.stopPropagation();
        const btn = e.currentTarget as HTMLElement;
        this.todayMenuOpen = !this.todayMenuOpen;
        if (this.todayMenuOpen) {
            const rect = btn.getBoundingClientRect();
            this.todayMenuAnchor = {x: rect.left, y: rect.bottom};
        }
    }

    private onTodaySettingsChange(e: Event) {
        const next = (e as CustomEvent<TodaySettings>).detail;
        this.todaySettings = pruneTodaySettings(next, this.libraryData.folders.map((f) => f.id));
        saveTodaySettings(this.todaySettings);
        window.dispatchEvent(new CustomEvent('today-settings-changed'));
    }

    private folderMenuFolder(): Folder | undefined {
        return this.libraryData.folders.find((f) => f.id === this.folderMenuFolderId);
    }

    private async onFolderMenuDelete() {
        const folder = this.folderMenuFolder();
        if (folder) await this.doDeleteFolder(folder);
        this.closeFolderMenu();
    }

    private async onFolderMenuRefresh() {
        const folder = this.folderMenuFolder();
        this.closeFolderMenu();
        if (folder) await refreshFolder(folder.id);
        window.dispatchEvent(new CustomEvent('feeds-refreshed'));
    }

    private async onRefreshAll() {
        this.closeFeedListMenu();
        await syncAllFeeds();
        window.dispatchEvent(new CustomEvent('feeds-refreshed'));
    }

    private onItemKey(e: KeyboardEvent, view: View) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Let child controls (menu buttons, toggles) handle their own keys.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        this.select(view);
    }

    private onRetryLibrary() {
        void queryClient.invalidateQueries({queryKey: libraryKey});
    }

    private feedRow(feed: Feed) {
        const active = this.isActive({kind: 'feed', id: feed.id});
        return feedRowTemplate(feed, active, (f) => this.select({kind: 'feed', id: f.id}), (e, f) => this.onItemKey(e, {kind: 'feed', id: f.id}), (e, f) => this.onDragStart(e, 'feed', f.id), this.feedActions(feed));
    }

    private folderRow(folder: Folder) {
        const feeds = this.folderFeeds(folder.id);
        const isCollapsed = Boolean(this.collapsed[folder.id]);
        const active = this.isActive({kind: 'folder', id: folder.id});
        const unread = this.folderUnread(folder.id);
        return folderRowTemplate(folder, feeds, isCollapsed, active, unread, (f) => this.select({kind: 'folder', id: f.id}), (e, f) => this.onItemKey(e, {kind: 'folder', id: f.id}), (e, f) => this.onDragStart(e, 'folder', f.id), (id) => this.toggleFolder(id), (e, f) => this.openFolderMenu(f, e), (feed) => this.feedRow(feed));
    }

    private async doRefresh(feed: Feed) {
        try {
            await refreshFeed(feed.id);
        } catch {
            // surfaced on the feed row's next sync attempt
        }
    }

    private async doDeleteFeed(feed: Feed) {
        if (confirm(`Delete ${feed.title}?`)) {
            await deleteFeed(feed.id);
        }
    }

    private async doDeleteFolder(folder: Folder) {
        if (confirm(`Delete folder ${folder.title}? Feeds will be removed from this folder.`)) {
            await deleteFolder(folder.id);
            if (folder.id in this.collapsed) {
                const {[folder.id]: _removed, ...rest} = this.collapsed;
                this.collapsed = rest;
                try {
                    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(rest));
                } catch {
                    // ignore
                }
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'source-list': SourceList;
    }
}
