import type { ReactiveController, ReactiveControllerHost } from '../../query';
import { libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import { navigate } from '../../router';
import { requestAddFeed } from '../../services/add-feed-intent';
import type { TodaySettings } from '../../services/today-settings';
import { orderedInterestingFolderIds, saveInterestingOrder } from '../../services/interesting-settings';
import { loadInterestingCount } from '../../services/interesting-counts';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { Feed, FeedSort, Folder, SavedSearch, View } from '../../types';
import '../feed-list-menu/feed-list-menu';
import '../folder-menu/folder-menu';
import '../saved-search-menu/saved-search-menu';
import '../today-menu/today-menu';
import styles from './source-list.css?inline';
import {
    createMenus,
    createNav,
    createResizeHandle,
    createSidebar,
    renderHead,
    renderNav,
    syncResizeHandle,
    updateMenus,
    type SourceListMenus,
} from './source-list-render';
import {
    dropFolderId,
    folderFeedsFor,
    folderUnreadFor,
    interestingBadgeCap,
    uncategorizedFor,
} from './source-list-helpers';
import {
    handleDragOver,
    handleDragStart,
    handleEndDrag,
    handleFeedMove,
    handleFolderReorder,
} from './source-list-drag';
import { toggleFolderAction } from './source-list-actions';
import { loadSidebarWidth, saveCollapsed, saveIgnoredFolders } from './source-list-settings';
import { append, el } from './source-list-dom';
import { filterIcon, icon, menuIcon, pinIcon, type IconKind } from './source-list-icons';
import { initMenuState, initViewState, reflectAttribute } from './source-list-state';
import { endResize, keyResize, moveResize, startResize } from './source-list-resize';

interface Library {
    folders: Folder[];
    feeds: Feed[];
    savedSearches: SavedSearch[];
}

function menuNodes(menus: SourceListMenus): HTMLElement[] {
    return [menus.feed, menus.folder, menus.savedSearch, menus.feedList, menus.today];
}

/**
 * Vanilla custom element: reactive fields plus thin delegators. Rendering lives
 * in source-list-render.ts and source-list-nav.ts and builds DOM imperatively;
 * behavior lives in the sibling source-list-* modules, each receiving the
 * element as an explicitly typed host (`this as never`).
 */
export class SourceList extends HTMLElement implements ReactiveControllerHost {
    static styles = { cssText: styles };

    private _view: View = { kind: 'all' };
    get view(): View {
        return this._view;
    }
    set view(v: View) {
        this._view = v;
        this.paint();
    }
    declare autoHide: boolean;
    declare hover: boolean;
    declare collapsed: Record<string, boolean>;
    declare feedSort: FeedSort;
    declare hideReadByFolder: Record<string, boolean>;
    declare ignoredFolders: Record<string, boolean>;
    declare interestingShadow: Record<string, true>;
    declare interestingOrder: string[];
    declare feedListMenuOpen: boolean;
    declare feedListMenuAnchor: MenuAnchor | null;
    declare menuOpen: boolean;
    declare menuFeedId: string | null;
    declare menuAnchor: MenuAnchor | null;
    declare folderMenuOpen: boolean;
    declare folderMenuFolderId: string | null;
    declare folderMenuAnchor: MenuAnchor | null;
    declare savedSearchMenuOpen: boolean;
    declare savedSearchMenuId: string | null;
    declare savedSearchMenuAnchor: MenuAnchor | null;
    declare todayMenuOpen: boolean;
    declare todayMenuAnchor: MenuAnchor | null;
    declare todaySettings: TodaySettings;

    private hideTimer: number | null = null;
    private dragging: { kind: 'folder' | 'feed' | 'savedSearch' | 'interesting'; id: string } | null = null;
    private dragTargetEl: HTMLElement | null = null;

    private readonly controllers = new Set<ReactiveController>();
    private changedProperties = new Map<string, unknown>();
    private updatePending = false;
    private updatePromise: Promise<boolean> = Promise.resolve(true);
    private resolveUpdate: ((value: boolean) => void) | null = null;

    private readonly sidebar: HTMLElement;
    private readonly head: HTMLElement;
    private readonly nav: HTMLElement;
    private readonly handle: HTMLElement;
    private readonly menus: SourceListMenus;

    feedListMenuTriggerId: string | null = null;
    menuTriggerFeedId: string | null = null;
    folderMenuTriggerId: string | null = null;
    savedSearchMenuTriggerId: string | null = null;

    /**
     * Current sidebar width, the source of truth for aria-valuenow. Kept as a
     * plain field rather than reactive state: a drag rewrites it on every
     * pointermove, and re-rendering the whole list that often would fight the
     * pointer capture. A paint reads it and the resize module writes the
     * attribute directly in between.
     */
    sidebarWidth = loadSidebarWidth();

    library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        this.adoptStyles(shadow);
        // The sidebar chrome is built once so the resize handle keeps its
        // pointer capture across paints; only the head and nav contents churn.
        this.sidebar = createSidebar();
        this.head = el('div', 'sidebar-head');
        this.nav = createNav(this as never);
        this.handle = createResizeHandle(this as never);
        this.menus = createMenus(this as never);
        append(this.sidebar, this.head, this.nav, this.handle);
        append(shadow, this.sidebar, ...menuNodes(this.menus));
        initViewState(this);
        initMenuState(this);
    }

    private adoptStyles(shadow: ShadowRoot): void {
        const cssText = (this.constructor as typeof SourceList).styles.cssText;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        shadow.adoptedStyleSheets = [sheet];
    }

    static get observedAttributes(): string[] {
        return ['auto-hide', 'hover'];
    }

    attributeChangedCallback(name: string, _oldValue: string | null, value: string | null): void {
        if (name === 'auto-hide') this.autoHide = value !== null;
        if (name === 'hover') this.hover = value !== null;
    }

    addController(controller: ReactiveController): void {
        this.controllers.add(controller);
    }

    removeController(controller: ReactiveController): void {
        this.controllers.delete(controller);
    }

    requestUpdate(name?: string, oldValue?: unknown): void {
        if (name !== undefined && !this.changedProperties.has(name)) this.changedProperties.set(name, oldValue);
        if (this.updatePending || !this.isConnected) return;
        this.updatePending = true;
        this.updatePromise = new Promise((resolve) => {
            this.resolveUpdate = resolve;
        });
        queueMicrotask(() => this.performUpdate());
    }

    get updateComplete(): Promise<boolean> {
        return this.updatePromise;
    }

    private performUpdate(): void {
        if (!this.updatePending) return;
        this.updatePending = false;
        if (!this.isConnected) {
            this.resolveUpdate?.(true);
            this.resolveUpdate = null;
            return;
        }
        const changed = this.changedProperties;
        this.changedProperties = new Map();
        for (const controller of this.controllers) controller.hostUpdate?.();
        this.willUpdate(changed);
        this.paint();
        for (const controller of this.controllers) controller.hostUpdated?.();
        this.resolveUpdate?.(true);
        this.resolveUpdate = null;
    }

    private paint(): void {
        const host = this as never;
        this.head.replaceChildren(renderHead(host));
        // A refetch can land mid-drag. Rebuilding the nav then would drop the
        // dragging and drag-over classes and the pointer's drop target, so the
        // nav waits for endDrag, which requests its own paint.
        if (this.dragging === null) {
            this.nav.replaceChildren(renderNav(host, this.libraryData.folders, this.uncategorizedFeeds()));
        }
        syncResizeHandle(this.handle, host);
        updateMenus(
            this.menus,
            host,
            this.libraryData.folders,
            this.menuFeed(),
            this.folderMenuFolder(),
            this.savedSearchMenuSearch(),
        );
    }

    private willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('autoHide')) reflectAttribute(this, 'auto-hide', this.autoHide);
        if (changed.has('hover')) reflectAttribute(this, 'hover', this.hover);
    }

    connectedCallback(): void {
        this.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);
        reflectAttribute(this, 'auto-hide', this.autoHide);
        reflectAttribute(this, 'hover', this.hover);
        this.addEventListener('mouseenter', this.onHoverEnter);
        this.addEventListener('mouseleave', this.onHoverLeave);
        window.addEventListener('interesting-counts-changed', this.onInterestingCountsChanged);
        for (const controller of this.controllers) controller.hostConnected?.();
        this.requestUpdate();
    }

    disconnectedCallback(): void {
        for (const controller of this.controllers) controller.hostDisconnected?.();
        window.removeEventListener('interesting-counts-changed', this.onInterestingCountsChanged);
        this.removeEventListener('mouseenter', this.onHoverEnter);
        this.removeEventListener('mouseleave', this.onHoverLeave);
        if (this.hideTimer !== null) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }

    private get libraryData(): Library {
        return this.library.data ?? { folders: [], feeds: [], savedSearches: [] };
    }

    get totalUnread(): number {
        return this.libraryData.feeds.reduce((sum, f) => {
            const ignored = f.folderIds.some((fid) => this.ignoredFolders[fid]);
            return ignored ? sum : sum + f.unread;
        }, 0);
    }

    private onInterestingCountsChanged = (): void => {
        this.requestUpdate();
    };

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
        startResize(this as never, e);
    }

    onResizeMove(e: PointerEvent) {
        moveResize(this as never, e);
    }

    onResizeKey(e: KeyboardEvent) {
        keyResize(this as never, e);
    }

    onResizeEnd(e: PointerEvent) {
        endResize(this as never, e);
    }

    icon(kind: IconKind) {
        return icon(kind);
    }

    pinIcon() {
        return pinIcon(this.autoHide);
    }

    filterIcon() {
        return filterIcon();
    }

    menuIcon() {
        return menuIcon();
    }

    folderUnread(folderId: string): number {
        return folderUnreadFor(this.libraryData.feeds, folderId);
    }

    interestingCount(folderId: string): number | undefined {
        const count = loadInterestingCount(folderId);
        if (count === undefined) return undefined;
        // Interesting is a subset of the folder's unread, and All skips ignored
        // folders. A stale cached count must never outnumber either one.
        return Math.min(count, interestingBadgeCap(this.libraryData.feeds, folderId, this.ignoredFolders));
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

    private savedSearchMenuSearch(): SavedSearch | undefined {
        return this.libraryData.savedSearches.find((s) => s.id === this.savedSearchMenuId);
    }

    select(view: View) {
        navigate(view);
    }

    isActive(view: View): boolean {
        if (this.view.kind !== view.kind) return false;
        if (this.simpleKindActive()) return true;
        if (this.view.kind === 'search' && view.kind === 'search') return this.sameSearch(view);
        if (this.view.kind === 'folder' && view.kind === 'folder') return this.view.id === view.id;
        if (this.view.kind === 'interesting' && view.kind === 'interesting') return this.view.id === view.id;
        if (this.view.kind === 'feed' && view.kind === 'feed') return this.view.id === view.id;
        if (this.view.kind === 'board' && view.kind === 'board') return this.view.id === view.id;
        return false;
    }

    /** Kinds that are active on their own, with no id or section to compare. */
    private simpleKindActive(): boolean {
        return (
            this.view.kind === 'all' ||
            this.view.kind === 'brief' ||
            this.view.kind === 'today' ||
            this.view.kind === 'frontpage' ||
            this.view.kind === 'focus' ||
            this.view.kind === 'settings' ||
            this.view.kind === 'saved' ||
            this.view.kind === 'boards' ||
            this.view.kind === 'coverage' ||
            this.view.kind === 'listen' ||
            this.view.kind === 'backgrounder'
        );
    }

    /** A saved search is active only when it is the one asked for; a plain search is not. */
    private sameSearch(view: { savedId?: string | undefined }): boolean {
        if (view.savedId) return this.view.kind === 'search' && this.view.savedId === view.savedId;
        if (this.view.kind === 'search' && this.view.savedId) return false;
        return true;
    }

    toggleFolder(id: string) {
        toggleFolderAction(this as never, id);
    }

    toggleIgnored(id: string) {
        const next = { ...this.ignoredFolders };
        if (next[id]) delete next[id];
        else next[id] = true;
        this.ignoredFolders = next;
        saveIgnoredFolders(next);
    }

    toggleInterestingSection() {
        this.collapsed = { ...this.collapsed, __interesting__: !this.collapsed['__interesting__'] };
        saveCollapsed(this.collapsed);
    }

    onDragStart(e: DragEvent, kind: 'folder' | 'feed' | 'savedSearch' | 'interesting', id: string) {
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

    private dropTarget(e: DragEvent): {
        folderId: string | null;
        savedSearchId: string | null;
        interestingId: string | null;
    } {
        const savedSearchId =
            this.dragging?.kind === 'savedSearch'
                ? ((e.target as HTMLElement).closest<HTMLElement>('[data-saved-search-id]')?.dataset['savedSearchId'] ??
                  null)
                : null;
        const interestingId =
            this.dragging?.kind === 'interesting'
                ? ((e.target as HTMLElement).closest<HTMLElement>('[data-interesting-id]')?.dataset['interestingId'] ??
                  null)
                : null;
        return {
            folderId: dropFolderId(this.dragging?.kind ?? null, e.target as HTMLElement, this.libraryData.feeds),
            savedSearchId,
            interestingId,
        };
    }

    async onDrop(e: DragEvent) {
        e.preventDefault();
        if (!this.dragging) return;
        const target = this.dropTarget(e);
        if (this.dragging.kind === 'folder') await this.applyFolderReorder(this.dragging.id, target);
        else if (this.dragging.kind === 'feed') await this.applyFeedMove(this.dragging.id, target);
        else if (this.dragging.kind === 'savedSearch')
            await this.applySavedSearchReorder(this.dragging.id, target.savedSearchId);
        else this.applyInterestingReorder(this.dragging.id, target.interestingId);
        this.endDrag();
    }

    private applyInterestingReorder(draggedId: string, targetId: string | null) {
        const current = orderedInterestingFolderIds(
            this.interestingShadow,
            this.libraryData.folders,
            this.interestingOrder,
        );
        const next = this.reorderInterestingIdsLocal(current, draggedId, targetId);
        this.interestingOrder = next;
        saveInterestingOrder(next);
    }

    private reorderInterestingIdsLocal(current: string[], draggedId: string, targetId: string | null): string[] {
        if (targetId === draggedId) return [...current];
        const ids = [...current];
        const from = ids.indexOf(draggedId);
        if (from < 0) return ids;
        ids.splice(from, 1);
        if (targetId) {
            const to = ids.indexOf(targetId);
            ids.splice(to < 0 ? ids.length : to, 0, draggedId);
        } else {
            ids.push(draggedId);
        }
        return ids;
    }

    onDragEnd() {
        this.endDrag();
    }

    private endDrag() {
        handleEndDrag(this as never);
        this.requestUpdate();
    }

    private async applyFolderReorder(folderId: string, target: { folderId: string | null }) {
        await handleFolderReorder(this as never, folderId, target);
    }

    private async applyFeedMove(feedId: string, target: { folderId: string | null }) {
        await handleFeedMove(this as never, feedId, target);
    }

    private async applySavedSearchReorder(searchId: string, targetId: string | null) {
        const { handleSavedSearchReorder } = await import('./source-list-drag');
        await handleSavedSearchReorder(this as never, searchId, targetId);
    }

    onAddFeed() {
        requestAddFeed();
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

customElements.define('source-list', SourceList);
