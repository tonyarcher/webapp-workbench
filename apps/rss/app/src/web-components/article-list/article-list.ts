import { Virtualizer } from '@tanstack/virtual-core';
import {
    QueryController,
    fetchLibrary,
    libraryKey,
    type ReactiveController,
    type ReactiveControllerHost,
} from '../../query';
import { markShownReadAction, openArticleAction } from './article-list-actions';
import { bulkDerankAction, bulkMarkReadAction, bulkStarAction, clearSelectionAction } from './article-list-selection';
import { onRowClickAction, toggleSelectCursorAction, toggleStarCursorAction } from './article-list-cursor';
import {
    applyPendingFeedsRefresh,
    isRefreshing,
    libraryFeedsOf,
    onFeedsRefreshedAction,
    refreshViewAction,
    setRefreshingKey as setRefreshingKeyAction,
} from './article-list-refresh';
import { reinitVirtualizer, resetList } from './article-list-loading';
import { initialLoadState, isLoading, type LoadState } from './article-list-load-state';
import { interestingActiveFor } from './article-list-interesting';
import { DEFAULT_INTERESTING_STRICTNESS } from '../../services/interesting-settings';
import { DwellTracker } from './article-list-dwell';
import { handleKeyDown, showShortcutsAction } from './article-list-keyboard';
import {
    syncScrollBindings as syncScrollBindingsLayout,
    trackPointerActivity,
    updateCols as updateColsLayout,
} from './article-list-layout';
import { attachHostListeners, teardownHost } from './article-list-lifecycle';
import { catchMeUpAction } from './article-list-catch-up';
import { advancedMarkScrollAction, advancedUnreadAction, toggleAdvancedAction } from './article-list-advanced';
import { onStarAction, onToggleDerankAction } from './article-list-star-derank';
import {
    DEFAULT_PAGE_SIZE,
    feedTitleOf,
    readViewSettings,
    viewKeyOf,
    viewRefreshKeyOf,
    viewTitleOf,
    virtualizerOptionsFor,
} from './article-list-helpers';
import { anchor, paint as paintRegions, type Regions } from './article-list-paint';
import { handleSlideshowUpdated, handleSlideshowWillUpdate } from './article-list-slideshow';
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';
import { areHighlightsEnabled } from '../../services/highlights';
import { syncHighlightsEnabled, toggleRowHighlight, type RowHighlightsHost } from './article-list-row-highlights';
import {
    applyAllViewsAction,
    canUndoMute as canUndoMuteHost,
    currentViewKey as currentViewKeyHost,
    freshnessLabel as freshnessLabelHost,
    folderFeeds as folderFeedsHost,
    handleUpdate as handleUpdateHost,
    loadViewSettings as loadViewSettingsHost,
    onArticleRead as onArticleReadHost,
    onArticleStarred as onArticleStarredHost,
    onInterestingStrictness as onInterestingStrictnessHost,
    onMarkBefore as onMarkBeforeHost,
    onRetryLibrary as onRetryLibraryHost,
    onScroll as onScrollHost,
    onUndoMute as onUndoMuteHost,
    saveViewSettings as saveViewSettingsHost,
    scopeLabel as scopeLabelHost,
    setListViewPref as setListViewPrefHost,
    setSortPref as setSortPrefHost,
    syncInterestingCount as syncInterestingCountHost,
    toggleUnread as toggleUnreadHost,
} from './article-list-host-handlers';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { RowHighlight } from '../../types';
import '../advanced-menu/advanced-menu';
import '../lazy-img/lazy-img';
import '../video-header/video-header';
import styles from './article-list.css?inline';
// removed

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

export { INTERESTING_BATCH } from './article-list-interesting';

/** Install a reactive accessor. Assignments request the same batched paint Lit used to. */
function defineReactive<T>(host: ArticleList, name: string, initial: T): void {
    let current = initial;
    Object.defineProperty(host, name, {
        configurable: true,
        enumerable: true,
        get(): T {
            return current;
        },
        set(next: T): void {
            if (Object.is(current, next)) return;
            const previous = current;
            current = next;
            host.requestUpdate(name, previous);
        },
    });
}

/**
 * Vanilla custom element: reactive fields plus thin delegators. Behavior lives
 * in the sibling `article-list-*` modules, each receiving the element as an
 * explicitly typed host (`this as never`), so every group stays unit-testable.
 * DOM is built imperatively; no template literal or html tag is involved.
 */
export class ArticleList extends HTMLElement implements ReactiveControllerHost {
    static styles = { cssText: styles };

    declare view: View;
    declare resumeArticleId: string | null;
    declare active: boolean;
    declare items: Article[];
    declare loadState: LoadState;
    declare unreadOnly: boolean;
    declare hideRead: boolean;
    declare markOnScroll: boolean;
    declare selectedIds: string[];
    declare sort: ArticleSort;
    declare cursor: number;
    declare listView: ListViewType;
    declare maxCardCols: number;
    declare cols: number;
    declare pageSize: number;
    declare advancedOpen: boolean;
    declare marking: boolean;
    declare advancedAnchor: MenuAnchor | null;
    declare interestingStrictness: number;
    /** Last page-load failure, cleared on the next attempt. Rendered as a banner, never silent. */
    declare loadError: string | null;
    /** Articles hidden by mute filters in the current loaded batch/page. */
    declare mutedHidden: number;
    /** Row-level key lines expansion (N1). */
    declare highlightsOn: boolean;
    declare rowHighlights: {
        open: Record<string, boolean>;
        loading: Record<string, boolean>;
        data: Record<string, RowHighlight | null>;
    };
    /** Slideshow view mode: current article index and playback options. */
    declare slideshowIndex: number;
    declare slideshowAutoAdvance: boolean;
    declare slideshowSavedIds: Set<string>;
    declare activeRefreshKeys: string[];

    slideshowAutoTimer: ReturnType<typeof setTimeout> | null = null;
    slideshowMarked = new Set<string>();
    slideshowSuppressRead = new Set<string>();

    scrollElRef: { value: HTMLDivElement | null } = { value: null };
    virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>;
    virtualizerCleanup?: () => void;
    cursors = new Map<string, string | undefined>();
    feedHasMore = new Map<string, boolean>();
    hasMoreSingle = true;
    lastViewKey = '';
    resumeApplied = false;
    /** Feed membership last loaded: folder feeds, or every feed for All/Hot. */
    lastFeedSetKey = '';
    /** Headline dwell with an active mouse, owned by this element's lifetime. */
    dwell = new DwellTracker();
    selectAnchor = -1;
    lastAutoMark = 0;
    resizeObserver: ResizeObserver | undefined;
    boundScrollEl: HTMLDivElement | null = null;
    feedWindowOffset = 0;
    /** In-flight refresh jobs by view key. Each folder is its own elevator button. */
    refreshJobs = new Map<string, Promise<void>>();
    /** A background refresh arrived while the article overlay had focus; apply it once active again. */
    pendingFeedsRefresh = false;
    /** Folder whose transient hide-read state is mirrored for count refresh. */
    interestingHideReadFolderId: string | null = null;

    private readonly controllers = new Set<ReactiveController>();
    private changedProperties = new Map<string, unknown>();
    private updatePending = false;
    private updatePromise: Promise<boolean> = Promise.resolve(true);
    private resolveUpdate: ((value: boolean) => void) | null = null;
    private firstPaintDone = false;
    readonly regionNodes = new Map<Comment, Node>();
    readonly anchors: Regions;
    private readonly scrollEl: HTMLDivElement;
    readonly renderRoot: ShadowRoot;

    library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        this.renderRoot = shadow;
        const cssText = (this.constructor as typeof ArticleList).styles.cssText;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        shadow.adoptedStyleSheets = [sheet];
        this.anchors = {
            toolbar: anchor(shadow),
            selection: anchor(shadow),
            hint: anchor(shadow),
            advanced: anchor(shadow),
            slideshow: anchor(shadow),
            loadError: anchor(shadow),
        };
        this.scrollEl = document.createElement('div');
        this.scrollEl.className = 'scroll';
        this.scrollEl.addEventListener('scroll', this.onScroll);
        shadow.appendChild(this.scrollEl);
        this.scrollElRef.value = this.scrollEl;

        defineReactive(this, 'view', { kind: 'all' } satisfies View);
        defineReactive(this, 'resumeArticleId', null);
        defineReactive(this, 'active', true);
        defineReactive(this, 'items', [] as Article[]);
        defineReactive(this, 'loadState', initialLoadState());
        defineReactive(this, 'unreadOnly', false);
        defineReactive(this, 'hideRead', false);
        defineReactive(this, 'markOnScroll', false);
        defineReactive(this, 'selectedIds', [] as string[]);
        defineReactive(this, 'sort', 'hot' as ArticleSort);
        defineReactive(this, 'cursor', -1);
        defineReactive(this, 'listView', 'detailed' as ListViewType);
        defineReactive(this, 'maxCardCols', 4);
        defineReactive(this, 'cols', 3);
        defineReactive(this, 'pageSize', DEFAULT_PAGE_SIZE);
        defineReactive(this, 'advancedOpen', false);
        defineReactive(this, 'marking', false);
        defineReactive(this, 'advancedAnchor', null as MenuAnchor | null);
        defineReactive(this, 'interestingStrictness', DEFAULT_INTERESTING_STRICTNESS);
        defineReactive(this, 'loadError', null as string | null);
        defineReactive(this, 'mutedHidden', 0);
        defineReactive(this, 'highlightsOn', areHighlightsEnabled());
        defineReactive(this, 'rowHighlights', { open: {}, loading: {}, data: {} });
        defineReactive(this, 'slideshowIndex', 0);
        defineReactive(this, 'slideshowAutoAdvance', false);
        defineReactive(this, 'slideshowSavedIds', new Set<string>());
        defineReactive(this, 'activeRefreshKeys', [] as string[]);
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
        this.updated(changed);
        this.resolveUpdate?.(true);
        this.resolveUpdate = null;
    }

    connectedCallback(): void {
        for (const controller of this.controllers) controller.hostConnected?.();
        attachHostListeners(this as never);
        this.requestUpdate();
    }

    disconnectedCallback(): void {
        for (const controller of this.controllers) controller.hostDisconnected?.();
        teardownHost(this as never);
    }

    private paint(): void {
        paintRegions(this as never);
    }

    /** True while this view's own refresh job runs. Other folders track their own keys. */
    get refreshing(): boolean {
        return isRefreshing(this as never);
    }

    /** True while a page fetch is in flight or queued; the footer renders "Loading…". */
    get loading(): boolean {
        return isLoading(this.loadState);
    }

    /** Staleness key the paging actions compare a result against. */
    get gen(): number {
        return this.loadState.gen;
    }

    setRefreshingKey(key: string, active: boolean): void {
        setRefreshingKeyAction(this as never, key, active);
    }

    libraryFeeds(): Feed[] {
        return libraryFeedsOf(this as never);
    }

    async refreshTick(): Promise<void> {
        await fetchLibrary();
    }

    isAlive(): boolean {
        return this.isConnected;
    }

    updateCols(): void {
        updateColsLayout(this as never);
    }

    // Handler fields stay public with stable arrow identities: the lifecycle
    // module adds and removes these exact references on window.
    onStorage = (e: StorageEvent) => {
        syncHighlightsEnabled(this as unknown as RowHighlightsHost, e.key);
    };
    onHighlightsEnabledChanged = () => {
        syncHighlightsEnabled(this as unknown as RowHighlightsHost, null);
    };
    onMuteRulesChanged = () => void resetList(this as never);
    onViewSettingsChanged = () => {
        loadViewSettingsHost(this);
        this.requestUpdate();
    };
    onPointerActivity = (e: Event) => trackPointerActivity(this as never, e);
    onArticleStarred = (e: Event) => onArticleStarredHost(this, e);
    onArticleRead = (e: Event) => onArticleReadHost(this, e);
    onFeedsRefreshed = () => onFeedsRefreshedAction(this as never);
    onKeyDown = (e: KeyboardEvent) => handleKeyDown(this as never, e);
    onToggleDerank = (e: Event) => onToggleDerankAction(this as never, e);

    willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('view')) {
            this.dwell.flushViewChange();
            this.markOnScroll = readViewSettings()[viewKeyOf(this.view)]?.markOnScroll ?? false;
            this.loadViewSettings();
        }
        handleSlideshowWillUpdate(this as never, changed);
        if (this.virtualizer) {
            this.virtualizer.setOptions(virtualizerOptionsFor(this as never));
            this.virtualizer._willUpdate();
        }
    }

    updated(changed: Map<string, unknown>): void {
        if (!this.firstPaintDone) {
            this.firstPaintDone = true;
            reinitVirtualizer(this as never);
            syncScrollBindingsLayout(this as never);
        }
        handleUpdateHost(this, currentViewKeyHost(this));
        syncInterestingCountHost(this, changed);
        applyPendingFeedsRefresh(this as never, changed);
        handleSlideshowUpdated(this as never, changed);
        syncScrollBindingsLayout(this as never);
    }

    interestingActive(): boolean {
        return interestingActiveFor(this.view);
    }

    onRetryLibrary(): void {
        onRetryLibraryHost();
    }

    onScroll = () => {
        onScrollHost(this);
    };

    folderFeeds(): Feed[] {
        return folderFeedsHost(this);
    }

    private loadViewSettings(): void {
        loadViewSettingsHost(this);
    }

    saveViewSettings(): void {
        saveViewSettingsHost(this);
    }

    /** Thin delegator so actions and menus keep one reset entry point. */
    async reset(): Promise<void> {
        await resetList(this as never);
    }

    onRetryArticles(): void {
        void resetList(this as never);
    }

    onUndoMute(): void {
        onUndoMuteHost();
    }

    canUndoMute(): boolean {
        return canUndoMuteHost();
    }

    isHighlightOpen(articleId: string): boolean {
        return !!this.rowHighlights.open[articleId];
    }
    highlightResult(articleId: string): RowHighlight | null | undefined {
        return this.rowHighlights.data[articleId];
    }
    highlightLoading(articleId: string): boolean {
        return !!this.rowHighlights.loading[articleId];
    }
    onToggleRowHighlight(e: Event, articleId: string): void {
        e.stopPropagation();
        toggleRowHighlight(this as never, articleId);
    }

    viewTitle(): string {
        return viewTitleOf(this.view, this.library.data);
    }

    feedTitle(feedId: string): string | undefined {
        return feedTitleOf(feedId, this.library.data);
    }

    feedIcon(feedId: string): string | undefined {
        return this.library.data?.feeds.find((f) => f.id === feedId)?.icon;
    }

    async openArticle(article: Article): Promise<void> {
        await openArticleAction(this as never, article);
    }

    showShortcuts(): void {
        showShortcutsAction();
    }

    toggleStarCursor(): void {
        toggleStarCursorAction(this as never);
    }

    toggleUnread(): void {
        toggleUnreadHost(this);
    }

    setListView(listView: ListViewType): void {
        setListViewPrefHost(this, listView);
    }

    setSort(sort: ArticleSort): void {
        setSortPrefHost(this, sort);
    }

    onRowClick(e: MouseEvent, index: number): void {
        onRowClickAction(this as never, e, index);
    }

    toggleSelectCursor(): void {
        toggleSelectCursorAction(this as never);
    }

    clearSelection(): void {
        clearSelectionAction(this as never);
    }

    async onBulkMarkRead(): Promise<void> {
        await bulkMarkReadAction(this as never);
    }

    async onBulkStar(): Promise<void> {
        await bulkStarAction(this as never);
    }

    async onBulkDerank(): Promise<void> {
        bulkDerankAction(this as never);
        this.requestUpdate();
    }

    onToggleAdvanced(e: Event): void {
        toggleAdvancedAction(this as never, e);
    }

    onAdvancedUnread(e: Event): void {
        advancedUnreadAction(this as never, e);
    }

    onAdvancedMarkScroll(e: Event): void {
        advancedMarkScrollAction(this as never, e);
    }

    onApplyAllViews(): void {
        applyAllViewsAction(this);
    }

    scopeLabel(): string {
        return scopeLabelHost(this);
    }

    freshnessLabel(): string {
        return freshnessLabelHost(this);
    }

    async onMarkBefore(e: Event): Promise<void> {
        await onMarkBeforeHost(this, e);
    }

    async onRefresh(): Promise<void> {
        await refreshViewAction(this as never, viewRefreshKeyOf(this.view));
    }

    async onStar(e: Event, article: Article): Promise<void> {
        await onStarAction(this as never, e, article);
    }

    onInterestingStrictness(e: Event): void {
        onInterestingStrictnessHost(this, e);
    }

    async onMarkShownRead(): Promise<void> {
        await markShownReadAction(this as never);
    }

    async onCatchMeUp(): Promise<void> {
        await catchMeUpAction(this as never);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}

customElements.define('article-list', ArticleList);
