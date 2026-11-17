import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, type Ref } from 'lit/directives/ref.js';
import { Virtualizer } from '@tanstack/virtual-core';
import { QueryController, fetchLibrary, libraryKey } from '../../query';
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
import {
    renderAdvancedMenu,
    renderInterestingHint,
    renderScroll,
    renderSelectionBar,
    renderToolbar,
} from './article-list-render';
import { renderSlideshowSection } from './article-list-slideshow-render';
import { handleSlideshowUpdated, handleSlideshowWillUpdate } from './article-list-slideshow';
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';
import { areHighlightsEnabled } from '../../services/highlights';
import { syncHighlightsEnabled, toggleRowHighlight, type RowHighlightsHost } from './article-list-row-highlights';
import {
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

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

export { INTERESTING_BATCH } from './article-list-interesting';

/**
 * The element itself: reactive state plus thin delegators. Behavior lives in
 * the sibling `article-list-*` modules, each receiving the element as an
 * explicitly typed host (`this as never`), so this class stays under the
 * max-lines budget and every group stays unit-testable on its own.
 */
@customElement('article-list')
export class ArticleList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) view: View = { kind: 'all' };
    @property({ attribute: false }) resumeArticleId: string | null = null;
    @property({ attribute: false }) active = true;

    @state() items: Article[] = [];
    @state() loadState: LoadState = initialLoadState();
    @state() unreadOnly = false;
    @state() hideRead = false;
    @state() markOnScroll = false;
    @state() selectedIds: string[] = [];
    @state() sort: ArticleSort = 'hot';
    @state() cursor = -1;
    @state() listView: ListViewType = 'detailed';
    @state() maxCardCols = 4;
    @state() cols = 3;
    @state() pageSize = DEFAULT_PAGE_SIZE;
    @state() advancedOpen = false;
    @state() marking = false;
    @state() advancedAnchor: MenuAnchor | null = null;
    @state() interestingStrictness = DEFAULT_INTERESTING_STRICTNESS;
    /** Last page-load failure, cleared on the next attempt. Rendered as a banner, never silent. */
    @state() loadError: string | null = null;
    /** Articles hidden by mute filters in the current loaded batch/page. */
    @state() mutedHidden = 0;
    /** Row-level key lines expansion (N1). */
    @state() highlightsOn = areHighlightsEnabled();
    @state() rowHighlights: {
        open: Record<string, boolean>;
        loading: Record<string, boolean>;
        data: Record<string, RowHighlight | null>;
    } = { open: {}, loading: {}, data: {} };

    /** Slideshow view mode: current article index and playback options. */
    @state() slideshowIndex = 0;
    @state() slideshowAutoAdvance = false;
    @state() slideshowSavedIds = new Set<string>();
    slideshowAutoTimer: ReturnType<typeof setTimeout> | null = null;
    slideshowMarked = new Set<string>();
    slideshowSuppressRead = new Set<string>();

    scrollElRef: Ref<HTMLDivElement> = createRef();
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
    @state() activeRefreshKeys: string[] = [];
    /** A background refresh arrived while the article overlay had focus; apply it once active again. */
    pendingFeedsRefresh = false;
    /** Folder whose transient hide-read state is mirrored for count refresh. */
    interestingHideReadFolderId: string | null = null;

    library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

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

    override firstUpdated() {
        reinitVirtualizer(this as never);
        syncScrollBindingsLayout(this as never);
    }

    updateCols() {
        updateColsLayout(this as never);
    }

    override connectedCallback() {
        super.connectedCallback();
        attachHostListeners(this as never);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        teardownHost(this as never);
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

    override willUpdate(changed: Map<string, unknown>) {
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

    override updated(changed: Map<string, unknown>) {
        handleUpdateHost(this, currentViewKeyHost(this));
        syncInterestingCountHost(this, changed);
        applyPendingFeedsRefresh(this as never, changed);
        handleSlideshowUpdated(this as never, changed);
        syncScrollBindingsLayout(this as never);
    }

    override render() {
        const host = this as never;
        if (this.listView === 'slideshow') {
            return html`${renderToolbar(host)}${renderInterestingHint(host)}${renderAdvancedMenu(host)}${renderSlideshowSection(host)}`;
        }
        const virtualItems = this.virtualizer?.getVirtualItems() ?? [];
        const showFeed = this.view.kind !== 'feed';
        return html`
      ${renderToolbar(host)}
      ${renderSelectionBar(host)}
      ${renderInterestingHint(host)}
      ${renderAdvancedMenu(host)}
      ${renderScroll(host, virtualItems, showFeed)}
    `;
    }

    interestingActive(): boolean {
        return interestingActiveFor(this.view);
    }

    onRetryLibrary() {
        onRetryLibraryHost();
    }

    onScroll = () => {
        onScrollHost(this);
    };

    folderFeeds(): Feed[] {
        return folderFeedsHost(this);
    }

    private loadViewSettings() {
        loadViewSettingsHost(this);
    }

    saveViewSettings() {
        saveViewSettingsHost(this);
    }

    /** Thin delegator so actions and menus keep one reset entry point. */
    async reset() {
        await resetList(this as never);
    }

    onRetryArticles() {
        void resetList(this as never);
    }

    onUndoMute() {
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

    async openArticle(article: Article) {
        await openArticleAction(this as never, article);
    }

    showShortcuts() {
        showShortcutsAction();
    }

    toggleStarCursor() {
        toggleStarCursorAction(this as never);
    }

    toggleUnread() {
        toggleUnreadHost(this);
    }

    setListView(listView: ListViewType) {
        setListViewPrefHost(this, listView);
    }

    setSort(sort: ArticleSort) {
        setSortPrefHost(this, sort);
    }

    onRowClick(e: MouseEvent, index: number) {
        onRowClickAction(this as never, e, index);
    }

    toggleSelectCursor() {
        toggleSelectCursorAction(this as never);
    }

    clearSelection() {
        clearSelectionAction(this as never);
    }

    async onBulkMarkRead() {
        await bulkMarkReadAction(this as never);
    }

    async onBulkStar() {
        await bulkStarAction(this as never);
    }

    async onBulkDerank() {
        bulkDerankAction(this as never);
        this.requestUpdate();
    }

    onToggleAdvanced(e: Event) {
        toggleAdvancedAction(this as never, e);
    }

    onAdvancedUnread(e: Event) {
        advancedUnreadAction(this as never, e);
    }

    onAdvancedMarkScroll(e: Event) {
        advancedMarkScrollAction(this as never, e);
    }

    scopeLabel(): string {
        return scopeLabelHost(this);
    }

    freshnessLabel(): string {
        return freshnessLabelHost(this);
    }

    async onMarkBefore(e: Event) {
        await onMarkBeforeHost(this, e);
    }

    async onRefresh() {
        await refreshViewAction(this as never, viewRefreshKeyOf(this.view));
    }

    async onStar(e: Event, article: Article) {
        await onStarAction(this as never, e, article);
    }

    onInterestingStrictness(e: Event) {
        onInterestingStrictnessHost(this, e);
    }

    async onMarkShownRead() {
        await markShownReadAction(this as never);
    }

    async onCatchMeUp() {
        await catchMeUpAction(this as never);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
