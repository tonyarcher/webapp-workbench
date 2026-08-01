import { LitElement, html, svg, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { libraryKey, QueryController } from '../../query';
import { deleteFeed, deleteFolder, moveFeed, refreshFeed, reorderFolders, setFeedFolderMembership } from '../../mutations';
import { getFeeds, getFolders } from '../../db/db';
import { navigate } from '../../router';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { Feed, FeedSort, Folder, View } from '../../types';
import '../feed-list-menu/feed-list-menu';
import styles from './source-list.css?inline';

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

  @property({ attribute: false }) view: View = { kind: 'all' };

  @state() private collapsed: Record<string, boolean> = loadCollapsed();

  @property({ attribute: 'auto-hide', type: Boolean, reflect: true }) autoHide = loadAutoHide();
  @property({ attribute: 'hover', type: Boolean, reflect: true }) hover = false;

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

  private library = new QueryController<Library>(this, () => ({
    queryKey: libraryKey,
    queryFn: async () => {
      const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
      return { folders, feeds };
    },
  }));

  private icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') {
    const paths: Record<string, ReturnType<typeof svg>> = {
      rss: svg`<circle cx="6" cy="18" r="2" fill="currentColor"></circle><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>`,
      folder: svg`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="currentColor" stroke-width="1.6"></path>`,
      all: svg`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="12" cy="12" r="3" fill="currentColor"></circle>`,
      refresh: svg`<path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>`,
      trash: svg`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>`,
    };
    return html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
  }

  private get libraryData(): Library {
    return this.library.data ?? { folders: [], feeds: [] };
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

  private pinIcon() {
    const pin = svg`
      <line x1="12" x2="12" y1="17" y2="22"></line>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
    `;
    const off = svg`<line x1="2" x2="22" y1="2" y2="22"></line>`;
    return html`
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >${pin}${this.autoHide ? off : ''}</svg>
    `;
  }

  private get totalUnread(): number {
    return this.libraryData.feeds.reduce((sum, f) => sum + f.unread, 0);
  }

  private filterIcon() {
    return html`
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 4h18l-7 8v5l-4 2v-7L3 4z"></path>
      </svg>
    `;
  }

  private folderUnread(folderId: string): number {
    return this.libraryData.feeds
      .filter((f) => f.folderIds.includes(folderId))
      .reduce((sum, f) => sum + f.unread, 0);
  }

  private sortedFeeds(feeds: Feed[]): Feed[] {
    if (this.feedSort !== 'unread') return feeds;
    return [...feeds].sort(
      (a, b) =>
        Number(b.unread > 0) - Number(a.unread > 0) ||
        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  private visibleFeeds(feeds: Feed[], folderKey: string): Feed[] {
    return this.hideReadByFolder[folderKey] ? feeds.filter((f) => f.unread > 0) : feeds;
  }

  private folderFeeds(folderId: string): Feed[] {
    return this.sortedFeeds(
      this.visibleFeeds(
        this.libraryData.feeds.filter((f) => f.folderIds.includes(folderId)),
        folderId,
      ),
    );
  }

  private uncategorizedFeeds(): Feed[] {
    return this.sortedFeeds(
      this.libraryData.feeds.filter((f) => f.folderIds.length === 0),
    );
  }

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
    this.feedListMenuAnchor = { x: rect.left, y: rect.bottom };
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
    const { key, unreadOnly } = (e as CustomEvent<{ key: string; unreadOnly: boolean }>).detail;
    this.hideReadByFolder = { ...this.hideReadByFolder, [key]: unreadOnly };
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
        detail: { key: folder.id, unreadOnly: (e as CustomEvent<boolean>).detail },
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
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
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
    if (this.view.kind === 'all' || this.view.kind === 'brief') return true;
    return (this.view as { id: string }).id === (view as { id: string }).id;
  }

  private toggleFolder(id: string) {
    const next = { ...this.collapsed, [id]: !this.collapsed[id] };
    this.collapsed = next;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; collapse state just won't persist
    }
  }

  private onDragStart(e: DragEvent, kind: 'folder' | 'feed', id: string) {
    this.dragging = { kind, id };
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ kind, id }));
    }
    (e.target as HTMLElement).closest('.item, .feed-row')?.classList.add('dragging');
    if (kind === 'feed') {
      this.shadowRoot?.querySelector('[data-no-folder]')?.classList.add('visible');
    }
  }

  private onDragOver(e: DragEvent) {
    if (!this.dragging) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const selector =
      this.dragging.kind === 'feed'
        ? '[data-folder-id], [data-feed-id], [data-no-folder]'
        : '[data-folder-id]';
    const target =
      (e.target as HTMLElement).closest<HTMLElement>(selector) ??
      (this.shadowRoot?.querySelector('.nav') as HTMLElement | null);
    if (this.dragTargetEl !== target) {
      this.dragTargetEl?.classList.remove('drag-over');
      this.dragTargetEl = target;
      this.dragTargetEl?.classList.add('drag-over');
    }
  }

  private onDragLeave(e: DragEvent) {
    const nav = this.shadowRoot?.querySelector('.nav');
    const related = e.relatedTarget as Node | null;
    if (!nav || !nav.contains(related)) this.clearDragOver();
  }

  private clearDragOver() {
    this.dragTargetEl?.classList.remove('drag-over');
    this.dragTargetEl = null;
  }

  private dropTarget(e: DragEvent): { folderId: string | null } {
    const selector =
      this.dragging?.kind === 'feed' ? '[data-folder-id], [data-feed-id]' : '[data-folder-id]';
    const el = (e.target as HTMLElement).closest<HTMLElement>(selector);
    if (el?.dataset.folderId) return { folderId: el.dataset.folderId };
    if (el?.dataset.feedId) {
      const feed = this.libraryData.feeds.find((f) => f.id === el.dataset.feedId);
      return { folderId: feed?.folderIds[0] ?? null };
    }
    return { folderId: null };
  }

  private async onDrop(e: DragEvent) {
    e.preventDefault();
    if (!this.dragging) return;
    const target = this.dropTarget(e);
    if (this.dragging.kind === 'folder') {
      await this.applyFolderReorder(this.dragging.id, target);
    } else {
      await this.applyFeedMove(this.dragging.id, target);
    }
    this.endDrag();
  }

  private onDragEnd() {
    this.endDrag();
  }

  private endDrag() {
    this.dragging = null;
    this.shadowRoot?.querySelector('.dragging')?.classList.remove('dragging');
    this.shadowRoot?.querySelector('[data-no-folder]')?.classList.remove('visible');
    this.clearDragOver();
  }

  private async applyFolderReorder(folderId: string, target: { folderId: string | null }) {
    const ids = this.libraryData.folders.map((f) => f.id);
    const from = ids.indexOf(folderId);
    if (from < 0) return;
    ids.splice(from, 1);
    const targetId = target.folderId;
    if (targetId && targetId !== folderId) {
      const to = ids.indexOf(targetId);
      ids.splice(to < 0 ? ids.length : to, 0, folderId);
    } else {
      ids.push(folderId);
    }
    await reorderFolders(ids);
  }

  private async applyFeedMove(feedId: string, target: { folderId: string | null }) {
    const feed = this.libraryData.feeds.find((f) => f.id === feedId);
    if (!feed) return;
    const next = target.folderId ? [target.folderId] : [];
    const same =
      feed.folderIds.length === next.length && feed.folderIds.every((id, i) => id === next[i]);
    if (same) return;
    await moveFeed(feedId, target.folderId);
    if (target.folderId && this.collapsed[target.folderId]) this.toggleFolder(target.folderId);
  }

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
    this.menuAnchor = { x: rect.left, y: rect.bottom };
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
    if (feed) await this.doRefresh(feed);
    this.closeMenu();
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

  private menuIcon() {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
      <path d="M9 10.2l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

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
    this.folderMenuAnchor = { x: rect.left, y: rect.bottom };
    this.folderMenuFolderId = folder.id;
    this.folderMenuOpen = true;
  }

  private closeFolderMenu() {
    this.folderMenuOpen = false;
    this.folderMenuTriggerId = null;
  }

  private folderMenuFolder(): Folder | undefined {
    return this.libraryData.folders.find((f) => f.id === this.folderMenuFolderId);
  }

  private async onFolderMenuDelete() {
    const folder = this.folderMenuFolder();
    if (folder) await this.doDeleteFolder(folder);
    this.closeFolderMenu();
  }

  private feedRow(feed: Feed) {
    const active = this.isActive({ kind: 'feed', id: feed.id });
    return html`
      <div
        class="feed-row ${active ? 'active' : ''} ${feed.unread > 0 ? 'has-unread' : ''}"
        data-feed-id="${feed.id}"
        draggable="true"
        @dragstart=${(e: DragEvent) => this.onDragStart(e, 'feed', feed.id)}
        @click=${() => this.select({ kind: 'feed', id: feed.id })}
      >
        <span class="dot"></span>
        <span class="label" title="${feed.title}">${feed.title}</span>
        ${feed.unread > 0 ? html`<span class="badge">${feed.unread}</span>` : ''}
        ${this.feedActions(feed)}
      </div>
    `;
  }

  private folderRow(folder: Folder) {
    const feeds = this.folderFeeds(folder.id);
    const isCollapsed = this.collapsed[folder.id];
    const active = this.isActive({ kind: 'folder', id: folder.id });
    const unread = this.folderUnread(folder.id);
    return html`
      <div>
        <div
          class="item ${active ? 'active' : ''}"
          data-folder-id="${folder.id}"
          draggable="true"
          @dragstart=${(e: DragEvent) => this.onDragStart(e, 'folder', folder.id)}
          @click=${() => this.select({ kind: 'folder', id: folder.id })}
        >
          <span
            class="icon"
            style="cursor:pointer"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.toggleFolder(folder.id);
            }}
          >${isCollapsed ? '▸' : '▾'}</span>
          ${this.icon('folder')}
          <span class="label" title="${folder.title}">${folder.title}</span>
          ${unread > 0 ? html`<span class="badge">${unread}</span>` : ''}
          <button
            class="menu-btn"
            title="Folder options"
            @click=${(e: MouseEvent) => this.openFolderMenu(folder, e)}
          >${this.menuIcon()}</button>
        </div>
        ${isCollapsed
          ? ''
          : html`<div class="folder-children">${feeds.map((f) => this.feedRow(f))}</div>`}
      </div>
    `;
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
        const { [folder.id]: _removed, ...rest } = this.collapsed;
        this.collapsed = rest;
        try {
          localStorage.setItem(COLLAPSED_KEY, JSON.stringify(rest));
        } catch {
          // ignore
        }
      }
    }
  }

  override render() {
    const { folders } = this.libraryData;
    const uncategorized = this.uncategorizedFeeds();
    const allActive = this.isActive({ kind: 'all' });
    const briefActive = this.isActive({ kind: 'brief' });
    const menuFeed = this.menuFeed();
    const folderMenuFolder = this.folderMenuFolder();

    return html`
      <div class="sidebar-head">
        <button
          class="pin-btn filter-btn"
          title="Feed list options"
          @click=${(e: MouseEvent) => this.openFeedListMenu(e)}
        >${this.filterIcon()}</button>
        <button
          class="pin-btn"
          title=${this.autoHide ? 'Pin the feed list open' : 'Auto-hide the feed list'}
          @click=${this.toggleAutoHide}
        >${this.pinIcon()}</button>
      </div>
      <nav
        class="nav"
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
        @dragend=${this.onDragEnd}
      >
        <div class="item ${briefActive ? 'active' : ''}" @click=${() => this.select({ kind: 'brief' })}>
          <span class="icon">✨</span>
          <span class="label">Daily Brief</span>
        </div>
        <div class="item ${allActive ? 'active' : ''}" @click=${() => this.select({ kind: 'all' })}>
          ${this.icon('all')}
          <span class="label">All</span>
          ${this.totalUnread > 0 ? html`<span class="badge">${this.totalUnread}</span>` : ''}
        </div>

        ${folders.map((folder) => this.folderRow(folder))}

        ${uncategorized.length
          ? html`
              <div class="section-label">No folder</div>
              ${uncategorized.map((feed) => this.feedRow(feed))}
            `
          : ''}
        <div class="drop-zone" data-no-folder>Drop here to move out of folders</div>
      </nav>
      <div
        class="resize-handle"
        title="Drag to resize"
        @pointerdown=${this.onResizeStart}
        @pointermove=${this.onResizeMove}
        @pointerup=${this.onResizeEnd}
        @pointercancel=${this.onResizeEnd}
      ></div>
      <feed-menu
        .feed=${menuFeed ?? null}
        .folders=${folders}
        .open=${this.menuOpen && menuFeed !== undefined}
        .anchor=${this.menuAnchor}
        @close=${this.closeMenu}
        @refresh=${this.onMenuRefresh}
        @delete=${this.onMenuDelete}
        @folders-change=${this.onMenuFoldersChange}
      ></feed-menu>
      <folder-menu
        .folder=${folderMenuFolder ?? null}
        .open=${this.folderMenuOpen && folderMenuFolder !== undefined}
        .anchor=${this.folderMenuAnchor}
        .unreadOnly=${folderMenuFolder ? Boolean(this.hideReadByFolder[folderMenuFolder.id]) : false}
        @close=${this.closeFolderMenu}
        @delete=${this.onFolderMenuDelete}
        @unread-only-change=${this.onFolderMenuUnreadOnly}
      ></folder-menu>
      <feed-list-menu
        .open=${this.feedListMenuOpen}
        .anchor=${this.feedListMenuAnchor}
        .feedSort=${this.feedSort}
        @close=${this.closeFeedListMenu}
        @sort-change=${this.onFeedSortChange}
        @sort-folders=${this.onSortFolders}
      ></feed-list-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'source-list': SourceList;
  }
}
