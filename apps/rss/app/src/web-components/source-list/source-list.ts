import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import { navigate } from '../../router';
import { loadTodaySettings, type TodaySettings } from '../../services/today-settings';
import { loadInterestingShadow } from '../../services/interesting-settings';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { Feed, FeedSort, Folder, View } from '../../types';
import '../feed-list-menu/feed-list-menu';
import '../today-menu/today-menu';
import styles from './source-list.css?inline';
import {
    filterIconTemplate,
    iconTemplate,
    menuIconTemplate,
    pinIconTemplate,
    renderHead,
    renderMenus,
    renderNav,
    renderResizeHandle,
} from './source-list-render';
import { dropFolderId, folderFeedsFor, folderUnreadFor, uncategorizedFor } from './source-list-helpers';
import {
    handleDragOver,
    handleDragStart,
    handleEndDrag,
    handleFeedMove,
    handleFolderReorder,
} from './source-list-drag';
import { toggleFolderAction } from './source-list-actions';
import {
    loadAutoHide,
    loadCollapsed,
    loadFeedSort,
    loadHideReadByFolder,
    loadSidebarWidth,
    clampSidebarWidth,
    nextSidebarWidth,
    saveSidebarWidth,
} from './source-list-settings';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

@customElement('source-list')
export class SourceList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) view: View = { kind: 'all' };
    @property({ attribute: 'auto-hide', type: Boolean, reflect: true }) autoHide = loadAutoHide();
    @property({ attribute: 'hover', type: Boolean, reflect: true }) hover = false;
    @state() collapsed: Record<string, boolean> = loadCollapsed();
    @state() private feedSort: FeedSort = loadFeedSort();
    @state() private hideReadByFolder: Record<string, boolean> = loadHideReadByFolder();
    @state() interestingShadow: Record<string, true> = loadInterestingShadow();

    private hideTimer: number | null = null;
    private resizing = false;
    private resizeHandleEl: HTMLElement | null = null;
    /**
     * Current sidebar width, the source of truth for aria-valuenow. Kept as a
     * plain field rather than reactive state: a drag calls applySidebarWidth on
     * every pointermove, and re-rendering the whole list that often would fight
     * the pointer capture. The template reads it on render and
     * applySidebarWidth writes the attribute directly in between.
     */
    sidebarWidth = loadSidebarWidth();
    feedListMenuTriggerId: string | null = null;
    @state() feedListMenuOpen = false;
    @state() feedListMenuAnchor: MenuAnchor | null = null;

    private dragging: { kind: 'folder' | 'feed'; id: string } | null = null;
    private dragTargetEl: HTMLElement | null = null;
    menuTriggerFeedId: string | null = null;
    @state() menuOpen = false;
    @state() private menuFeedId: string | null = null;
    @state() menuAnchor: MenuAnchor | null = null;
    folderMenuTriggerId: string | null = null;
    @state() folderMenuOpen = false;
    @state() private folderMenuFolderId: string | null = null;
    @state() folderMenuAnchor: MenuAnchor | null = null;
    @state() todayMenuOpen = false;
    @state() todayMenuAnchor: MenuAnchor | null = null;
    @state() todaySettings: TodaySettings = loadTodaySettings();

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    private get libraryData(): Library {
        return this.library.data ?? { folders: [], feeds: [] };
    }

    get totalUnread(): number {
        return this.libraryData.feeds.reduce((sum, f) => sum + f.unread, 0);
    }

    override connectedCallback() {
        super.connectedCallback();
        this.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);
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
        const host = this as never;
        const { folders } = this.libraryData;
        const uncategorized = this.uncategorizedFeeds();
        const menuFeed = this.menuFeed();
        const folderMenuFolder = this.folderMenuFolder();
        return html`
      ${renderHead(host)}
      ${renderNav(host, folders, uncategorized)}
      ${renderResizeHandle(host)}
      ${renderMenus(host, folders, menuFeed, folderMenuFolder)}
    `;
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

    onResizeStart(e: PointerEvent) {
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

    onResizeMove(e: PointerEvent) {
        if (!this.resizing) return;
        const rect = this.getBoundingClientRect();
        this.applySidebarWidth(e.clientX - rect.left);
    }

    /**
     * The handle element, whether or not a drag is in progress.
     *
     * resizeHandleEl only exists between pointerdown and pointerup, because it
     * exists to hold the pointer capture and the resizing class. A keyboard
     * resize never sets it, so writing aria-valuenow through it alone left the
     * attribute frozen at its rendered value for exactly the users this change
     * exists for: the sidebar would widen while the announced width stayed put.
     * Falling back to the shadow root keeps the two paths honest.
     */
    private get resizeHandle(): HTMLElement | null {
        return this.resizeHandleEl ?? this.renderRoot?.querySelector<HTMLElement>('.resize-handle') ?? null;
    }

    /**
     * The one place a sidebar width is applied, so the pointer and keyboard
     * paths cannot drift apart. It also writes aria-valuenow, because a drag
     * does not re-render and a stale value on a separator is a lie a screen
     * reader will report.
     */
    private applySidebarWidth(raw: number) {
        const width = clampSidebarWidth(raw);
        this.style.setProperty('--sidebar-width', `${width}px`);
        this.sidebarWidth = width;
        this.resizeHandle?.setAttribute('aria-valuenow', String(width));
        saveSidebarWidth(width);
    }

    /**
     * Keyboard equivalent of the drag. The stepping and clamping live in
     * nextSidebarWidth so they are testable without a DOM; this only decides
     * whether the key is ours.
     */
    onResizeKey(e: KeyboardEvent) {
        const next = nextSidebarWidth(this.sidebarWidth, e.key, e.shiftKey);
        if (next === null) return;
        e.preventDefault();
        this.applySidebarWidth(next);
    }

    onResizeEnd(e: PointerEvent) {
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
                e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!over) this.onHoverLeave();
        }
    }

    icon(kind: 'rss' | 'folder' | 'all' | 'refresh' | 'trash') {
        return iconTemplate(kind);
    }

    pinIcon() {
        return pinIconTemplate(this.autoHide);
    }

    filterIcon() {
        return filterIconTemplate();
    }

    menuIcon() {
        return menuIconTemplate();
    }

    folderUnread(folderId: string): number {
        return folderUnreadFor(this.libraryData.feeds, folderId);
    }

    folderFeeds(folderId: string): Feed[] {
        return folderFeedsFor(this.libraryData.feeds, folderId, this.feedSort, this.hideReadByFolder);
    }

    private uncategorizedFeeds(): Feed[] {
        return uncategorizedFor(this.libraryData.feeds, this.feedSort);
    }

    private menuFeed(): Feed | undefined {
        return this.libraryData.feeds.find((f) => f.id === this.menuFeedId);
    }

    private folderMenuFolder(): Folder | undefined {
        return this.libraryData.folders.find((f) => f.id === this.folderMenuFolderId);
    }

    private select(view: View) {
        navigate(view);
    }

    isActive(view: View): boolean {
        if (this.view.kind !== view.kind) return false;
        if (
            this.view.kind === 'all' ||
            this.view.kind === 'brief' ||
            this.view.kind === 'today' ||
            this.view.kind === 'frontpage'
        )
            return true;
        if (this.view.kind === 'folder' && view.kind === 'folder') return this.view.id === view.id;
        if (this.view.kind === 'feed' && view.kind === 'feed') return this.view.id === view.id;
        return false;
    }

    toggleFolder(id: string) {
        toggleFolderAction(this as never, id);
    }

    onDragStart(e: DragEvent, kind: 'folder' | 'feed', id: string) {
        handleDragStart(this as never, e, kind, id);
    }

    onDragOver(e: DragEvent) {
        handleDragOver(this as never, e);
    }

    onDragLeave(e: DragEvent) {
        const nav = this.shadowRoot?.querySelector('.nav');
        const related = e.relatedTarget as Node | null;
        if (!nav || !nav.contains(related)) this.clearDragOver();
    }

    private clearDragOver() {
        this.dragTargetEl?.classList.remove('drag-over');
        this.dragTargetEl = null;
    }

    private dropTarget(e: DragEvent): { folderId: string | null } {
        return { folderId: dropFolderId(this.dragging?.kind ?? null, e.target as HTMLElement, this.libraryData.feeds) };
    }

    async onDrop(e: DragEvent) {
        e.preventDefault();
        if (!this.dragging) return;
        const target = this.dropTarget(e);
        if (this.dragging.kind === 'folder') await this.applyFolderReorder(this.dragging.id, target);
        else await this.applyFeedMove(this.dragging.id, target);
        this.endDrag();
    }

    onDragEnd() {
        handleEndDrag(this as never);
    }

    private endDrag() {
        handleEndDrag(this as never);
    }

    private async applyFolderReorder(folderId: string, target: { folderId: string | null }) {
        await handleFolderReorder(this as never, folderId, target);
    }

    private async applyFeedMove(feedId: string, target: { folderId: string | null }) {
        await handleFeedMove(this as never, feedId, target);
    }

    onItemKey(e: KeyboardEvent, view: View) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Let child controls (menu buttons, toggles) handle their own keys.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        this.select(view);
    }

    onRetryLibrary() {
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'source-list': SourceList;
    }
}
