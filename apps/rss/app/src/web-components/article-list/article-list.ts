import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, type Ref } from 'lit/directives/ref.js';
import { Virtualizer } from '@tanstack/virtual-core';
import { QueryController, fetchLibrary, libraryKey } from '../../query';
import {
    handleListKey,
    markShownReadAction,
    openArticleAction,
    refreshViewAction,
    toggleStarAction,
} from './article-list-actions';
import {
    bulkDerankAction,
    bulkMarkReadAction,
    bulkStarAction,
    clearSelectionAction,
    rowClickAction,
    setAnchor,
    toggleSelectAction,
} from './article-list-selection';
import { reinitVirtualizer, resetList } from './article-list-loading';
import { initialLoadState, isLoading, type LoadState } from './article-list-load-state';
import { interestingActiveFor } from './article-list-interesting';

import { DEFAULT_INTERESTING_STRICTNESS, isDeranked } from '../../services/interesting-settings';
import { noteDerank } from '../../mutations';
import { DwellTracker } from './article-list-dwell';
import {
    CARD_MIN_WIDTH,
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
import {
    clearSlideshowAuto,
    handleSlideshowKeyDown,
    handleSlideshowUpdated,
    handleSlideshowWillUpdate,
} from './article-list-slideshow';
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';

import { areHighlightsEnabled } from '../../services/highlights';
import { syncHighlightsEnabled, toggleRowHighlight, type RowHighlightsHost } from './article-list-row-highlights';
import { setInterestingHideRead } from '../../services/interesting-counts';
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
    syncInterestingCount as syncInterestingCountHost,
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
    private boundScrollEl: HTMLDivElement | null = null;

    /** True while this view's own refresh job runs. Other folders track their own keys. */
    get refreshing(): boolean {
        return this.activeRefreshKeys.includes(viewRefreshKeyOf(this.view));
    }

    setRefreshingKey(key: string, active: boolean): void {
        const has = this.activeRefreshKeys.includes(key);
        if (active && !has) this.activeRefreshKeys = [...this.activeRefreshKeys, key];
        else if (!active && has) this.activeRefreshKeys = this.activeRefreshKeys.filter((k) => k !== key);
    }

    libraryFeeds(): Feed[] {
        return this.library.data?.feeds ?? [];
    }

    async refreshTick(): Promise<void> {
        await fetchLibrary();
    }

    isAlive(): boolean {
        return this.isConnected;
    }

    scrollElRef: Ref<HTMLDivElement> = createRef();
    virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>;
    private virtualizerCleanup?: () => void;
    cursors = new Map<string, string | undefined>();
    feedHasMore = new Map<string, boolean>();
    hasMoreSingle = true;
    lastViewKey = '';
    resumeApplied = false;
    /** Feed membership last loaded: folder feeds, or every feed for All/Hot. */
    lastFeedSetKey = '';
    /** Headline dwell with an active mouse, owned by this element's lifetime. */
    private dwell = new DwellTracker();
    selectAnchor = -1;
    lastAutoMark = 0;
    private resizeObserver: ResizeObserver | undefined;
    feedWindowOffset = 0;
    /** In-flight refresh jobs by view key. Each folder is its own elevator button. */
    refreshJobs = new Map<string, Promise<void>>();
    @state() activeRefreshKeys: string[] = [];

    /** True while a page fetch is in flight or queued; the footer renders "Loading…". */
    get loading(): boolean {
        return isLoading(this.loadState);
    }

    /** Staleness key the paging actions compare a result against. */
    get gen(): number {
        return this.loadState.gen;
    }

    library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    override firstUpdated() {
        reinitVirtualizer(this as never);
        this.syncScrollBindings();
    }

    private syncScrollBindings() {
        const el = this.scrollElRef.value ?? null;
        if (el === this.boundScrollEl) return;
        if (this.boundScrollEl) {
            this.boundScrollEl.removeEventListener('pointermove', this.onPointerActivity);
            this.boundScrollEl.removeEventListener('wheel', this.onPointerActivity);
            this.resizeObserver?.disconnect();
            this.resizeObserver = undefined;
        }
        this.boundScrollEl = el;
        if (el) {
            this.updateCols();
            this.resizeObserver = new ResizeObserver(() => this.updateCols());
            this.resizeObserver.observe(el);
            el.addEventListener('pointermove', this.onPointerActivity);
            el.addEventListener('wheel', this.onPointerActivity, { passive: true });
        }
    }

    updateCols() {
        const el = this.scrollElRef.value;
        if (!el) return;
        const width = el.clientWidth;
        const cols = Math.max(1, Math.min(this.maxCardCols, Math.floor(width / CARD_MIN_WIDTH)));
        if (cols !== this.cols) {
            this.cols = cols;
        }
    }

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.addEventListener('article-read', this.onArticleRead);
        window.addEventListener('article-starred', this.onArticleStarred);
        window.addEventListener('mute-rules-changed', this.onMuteRulesChanged);
        window.addEventListener('view-settings-changed', this.onViewSettingsChanged);
        window.addEventListener('storage', this.onStorage);
        window.addEventListener('highlights-enabled-changed', this.onHighlightsEnabledChanged);
        this.addEventListener('toggle-derank', this.onToggleDerank);
        this.dwell.start();
    }

    /** Folder whose transient hide-read state is mirrored for count refresh. */
    private interestingHideReadFolderId: string | null = null;

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearSlideshowAuto(this as never);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
        window.removeEventListener('mute-rules-changed', this.onMuteRulesChanged);
        window.removeEventListener('view-settings-changed', this.onViewSettingsChanged);
        window.removeEventListener('storage', this.onStorage);
        window.removeEventListener('highlights-enabled-changed', this.onHighlightsEnabledChanged);
        this.removeEventListener('toggle-derank', this.onToggleDerank);
        if (this.boundScrollEl) {
            this.boundScrollEl.removeEventListener('pointermove', this.onPointerActivity);
            this.boundScrollEl.removeEventListener('wheel', this.onPointerActivity);
            this.boundScrollEl = null;
        }
        this.dwell.stop();
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.virtualizerCleanup?.();
        if (this.interestingHideReadFolderId) {
            setInterestingHideRead(this.interestingHideReadFolderId, false);
            this.interestingHideReadFolderId = null;
        }
    }

    private onStorage = (e: StorageEvent) => {
        syncHighlightsEnabled(this as unknown as RowHighlightsHost, e.key);
    };
    private onHighlightsEnabledChanged = () => {
        syncHighlightsEnabled(this as unknown as RowHighlightsHost, null);
    };
    private onMuteRulesChanged = () => void resetList(this as never);
    private onViewSettingsChanged = () => {
        loadViewSettingsHost(this);
        this.requestUpdate();
    };
    private onPointerActivity = (e: Event) => this.dwell.trackEvent(e, this.items, this.cols, this.renderRoot);
    private onArticleStarred = (e: Event) => onArticleStarredHost(this, e);
    private onArticleRead = (e: Event) => onArticleReadHost(this, e);

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
        if (changed.has('active') && this.active && this.pendingFeedsRefresh) {
            this.pendingFeedsRefresh = false;
            if (!this.unreadOnly && !this.hideRead) void resetList(this as never);
        }
        handleSlideshowUpdated(this as never, changed);
        this.syncScrollBindings();
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

    /** A background refresh arrived while the article overlay had focus; apply it once active again. */
    private pendingFeedsRefresh = false;

    private onFeedsRefreshed = () => {
        if (!this.active) {
            this.pendingFeedsRefresh = true;
            return;
        }
        this.pendingFeedsRefresh = false;
        void resetList(this as never);
    };

    folderFeeds(): Feed[] {
        return folderFeedsHost(this);
    }

    private loadViewSettings() {
        loadViewSettingsHost(this);
    }

    private saveViewSettings() {
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

    private onKeyDown = (e: KeyboardEvent) => {
        this.dwell.noteInput();
        if (handleSlideshowKeyDown(this as never, e, handleListKey)) return;
        handleListKey(this as never, e);
    };

    showShortcuts() {
        window.dispatchEvent(new CustomEvent('show-shortcuts', { bubbles: true, composed: true }));
    }

    toggleStarCursor() {
        const article = this.items[this.cursor];
        if (article) void toggleStarAction(this as never, article);
    }

    toggleUnread() {
        this.unreadOnly = !this.unreadOnly;
        this.saveViewSettings();
    }

    setListView(listView: ListViewType) {
        this.listView = listView;
        this.saveViewSettings();
        this.updateCols();
    }

    setSort(sort: ArticleSort) {
        this.sort = sort;
        this.saveViewSettings();
    }

    onRowClick(e: MouseEvent, index: number) {
        if (e.shiftKey) {
            rowClickAction(this as never, e, index);
            return;
        }
        setAnchor(this as never, index);
        const article = this.items[index];
        if (article) void this.openArticle(article);
    }

    toggleSelectCursor() {
        if (this.cursor >= 0) toggleSelectAction(this as never, this.cursor);
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
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.advancedAnchor = { x: rect.right, y: rect.bottom + 6 };
        this.advancedOpen = !this.advancedOpen;
    }

    onAdvancedUnread(e: Event) {
        this.unreadOnly = (e as CustomEvent<boolean>).detail;
        this.saveViewSettings();
    }

    onAdvancedMarkScroll(e: Event) {
        this.markOnScroll = (e as CustomEvent<boolean>).detail;
        this.saveViewSettings();
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
        e.stopPropagation();
        if (!article.starred) {
            // Starring clears a "not interesting" mark.
            noteDerank(article.id, article.title, false);
        }
        await toggleStarAction(this as never, article);
    }

    private onToggleDerank = (e: Event) => {
        const { id, title } = (e as CustomEvent<{ id: string; title: string }>).detail;
        const next = !isDeranked(id);
        noteDerank(id, title, next);
        if (next) {
            // Deranking clears a star.
            const item = this.items.find((a) => a.id === id);
            if (item?.starred) {
                void toggleStarAction(this as never, item);
            }
        }
        this.requestUpdate();
    };

    onInterestingStrictness(e: Event) {
        onInterestingStrictnessHost(this, e);
    }

    async onMarkShownRead() {
        await markShownReadAction(this as never);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
