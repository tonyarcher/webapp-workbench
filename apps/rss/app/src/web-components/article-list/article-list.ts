import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, type Ref } from 'lit/directives/ref.js';
import { Virtualizer } from '@tanstack/virtual-core';
import { libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import {
    handleListKey,
    markBeforeAction,
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
    markAboveViewport,
    rowClickAction,
    setAnchor,
    toggleSelectAction,
} from './article-list-selection';
import {
    applyStep,
    canLoadMore,
    loadNextPageAction,
    needsLibrary,
    refreshFeedSetKey,
    reinitVirtualizer,
    resetList,
} from './article-list-loading';
import {
    initialLoadState,
    isIdle,
    isLoading,
    libraryArrived,
    viewChanged,
    type LoadState,
} from './article-list-load-state';
import { interestingActiveFor } from './article-list-interesting';
import { clampInterestingStrictness } from '../../services/interesting-words';
import {
    loadInterestingStrictness,
    saveInterestingStrictness,
    DEFAULT_INTERESTING_STRICTNESS,
} from '../../services/interesting-settings';
import { saveInterestingCount } from '../../services/interesting-counts';
import { DwellTracker } from './article-list-dwell';
import {
    CARD_MIN_WIDTH,
    DEFAULT_PAGE_SIZE,
    describeFreshness,
    feedTitleOf,
    folderFeedsOf,
    freshestFetchAt,
    loadViewSettingsFor,
    readViewSettings,
    saveViewSettingsFor,
    scopeLabelOf,
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
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';
import { toastApiError, toastInfo } from '../../services/toast';
import type { MenuAnchor } from '../feed-menu/feed-menu';
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

    @state() private items: Article[] = [];
    @state() private loadState: LoadState = initialLoadState();
    @state() private unreadOnly = false;
    @state() hideRead = false;
    @state() markOnScroll = false;
    @state() selectedIds: string[] = [];
    @state() private sort: ArticleSort = 'hot';
    @state() cursor = -1;
    @state() private listView: ListViewType = 'detailed';
    @state() private maxCardCols = 4;
    @state() private cols = 3;
    @state() private pageSize = DEFAULT_PAGE_SIZE;
    @state() private advancedOpen = false;
    @state() private marking = false;
    @state() advancedAnchor: MenuAnchor | null = null;
    @state() interestingStrictness = DEFAULT_INTERESTING_STRICTNESS;
    /** Last page-load failure, cleared on the next attempt. Rendered as a banner, never silent. */
    @state() loadError: string | null = null;

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

    private scrollElRef: Ref<HTMLDivElement> = createRef();
    private virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>;
    private virtualizerCleanup?: () => void;
    cursors = new Map<string, string | undefined>();
    feedHasMore = new Map<string, boolean>();
    hasMoreSingle = true;
    private lastViewKey = '';
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

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => fetchLibrary(),
        refetchInterval: 60_000,
    }));

    override firstUpdated() {
        reinitVirtualizer(this as never);
        const el = this.scrollElRef.value;
        if (el) {
            this.updateCols();
            this.resizeObserver = new ResizeObserver(() => this.updateCols());
            this.resizeObserver.observe(el);
            // Inside the shadow root the event target is the row itself.
            // On window it would be retargeted to this host and dwell could
            // never resolve a row.
            el.addEventListener('pointermove', this.onPointerActivity);
            el.addEventListener('wheel', this.onPointerActivity, { passive: true });
        }
    }

    private updateCols() {
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
        this.dwell.start();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
        window.removeEventListener('mute-rules-changed', this.onMuteRulesChanged);
        this.scrollElRef.value?.removeEventListener('pointermove', this.onPointerActivity);
        this.scrollElRef.value?.removeEventListener('wheel', this.onPointerActivity);
        this.dwell.stop();
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.virtualizerCleanup?.();
    }

    private onMuteRulesChanged = () => {
        void resetList(this as never);
    };

    /** Stable listener identity; the tracker owns the dwell state. */
    private onPointerActivity = (e: Event) => {
        this.dwell.trackEvent(e, this.items, this.cols, this.renderRoot);
    };

    private onArticleStarred = (e: Event) => {
        const { id, starred } = (e as CustomEvent<{ id: string; starred: boolean }>).detail;
        let changed = false;
        this.items = this.items.map((a) => {
            if (a.id === id && a.starred !== starred) {
                changed = true;
                return { ...a, starred };
            }
            return a;
        });
        if (changed) this.requestUpdate();
    };

    private onArticleRead = (e: Event) => {
        const id = (e as CustomEvent<string>).detail;
        let changed = false;
        this.items = this.items.map((a) => {
            if (a.id === id && a.read === 0) {
                changed = true;
                return { ...a, read: 1 };
            }
            return a;
        });
        if (changed) this.requestUpdate();
    };

    override willUpdate(changed: Map<string, unknown>) {
        if (changed.has('view')) {
            this.dwell.flushViewChange();
            // Unsaved views must not inherit auto-marking: without a saved
            // setting the toggle is off, so opening a folder never starts
            // silently marking another folder's articles as read.
            this.markOnScroll = readViewSettings()[viewKeyOf(this.view)]?.markOnScroll ?? false;
            this.loadViewSettings();
        }
        if (this.virtualizer) {
            this.virtualizer.setOptions(virtualizerOptionsFor(this as never));
            this.virtualizer._willUpdate();
        }
    }

    override updated(_changed: Map<string, unknown>) {
        this.handleUpdate(this.currentViewKey());
        if (this.view.kind === 'interesting' && isIdle(this.loadState)) {
            saveInterestingCount(this.view.id, this.items.length);
        }
    }

    private currentViewKey(): string {
        const strict = this.view.kind === 'interesting' ? `|strict:${this.interestingStrictness}` : '';
        return `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}${strict}`;
    }

    private handleUpdate(viewKey: string): void {
        if (viewKey !== this.lastViewKey) {
            this.hideRead = false;
            this.loadViewSettings();
            // Settings can change sort/listView/pageSize, which are part of
            // the key. Record the key after loading them, or the next update
            // sees a "new" view and runs a second, duplicate reset.
            this.lastViewKey = this.currentViewKey();
            // Feed-set views need the library (feed list) before loading;
            // updated() re-fires when the library query resolves.
            void applyStep(
                this as never,
                viewChanged(this.loadState, needsLibrary(this as never), this.library.data !== undefined),
            );
            return;
        }
        if (this.loadState.phase === 'awaiting-library' && this.library.data) {
            void applyStep(this as never, libraryArrived(this.loadState));
            return;
        }
        refreshFeedSetKey(this as never);
    }

    override render() {
        const host = this as never;
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
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    }

    onScroll = () => {
        if (this.markOnScroll) void markAboveViewport(this as never);
        if (!isIdle(this.loadState) || !canLoadMore(this as never)) return;
        const el = this.scrollElRef.value;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
            void loadNextPageAction(this as never);
        }
    };

    private onFeedsRefreshed = () => {
        void resetList(this as never);
    };

    folderFeeds(): Feed[] {
        return folderFeedsOf(this.view, this.library.data);
    }

    private loadViewSettings() {
        loadViewSettingsFor(this as never);
        if (this.view.kind === 'interesting') {
            this.interestingStrictness = loadInterestingStrictness(this.view.id);
        }
    }

    private saveViewSettings() {
        saveViewSettingsFor(this as never);
    }

    /** Thin delegator so actions and menus keep one reset entry point. */
    async reset() {
        await resetList(this as never);
    }

    onRetryArticles() {
        void resetList(this as never);
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
        return scopeLabelOf(this.view, this.library.data);
    }

    freshnessLabel(): string {
        return describeFreshness(freshestFetchAt(this.view, this.library.data), Date.now());
    }

    async onMarkBefore(e: Event) {
        const cutoff = (e as CustomEvent<number | null>).detail;
        this.advancedOpen = false;
        // One mark at a time: a bulk mark over a large library takes tens of
        // seconds, and overlapping calls pile transactions onto the database
        // until one dies. Late clicks wait their turn by doing nothing.
        if (this.marking) return;
        this.marking = true;
        toastInfo('Marking articles as read — this takes a while on large libraries.');
        try {
            await markBeforeAction(this as never, cutoff);
        } catch (err) {
            console.error('mark-before failed', err);
            toastApiError(err, 'Could not mark articles as read. Check your connection and try again.');
        } finally {
            this.marking = false;
        }
    }

    async onRefresh() {
        await refreshViewAction(this as never, viewRefreshKeyOf(this.view));
    }

    async onStar(e: Event, article: Article) {
        e.stopPropagation();
        await toggleStarAction(this as never, article);
    }

    onInterestingStrictness(e: Event) {
        if (this.view.kind !== 'interesting') return;
        const next = clampInterestingStrictness(Number((e.target as HTMLInputElement).value));
        this.interestingStrictness = next;
        saveInterestingStrictness(this.view.id, next);
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
