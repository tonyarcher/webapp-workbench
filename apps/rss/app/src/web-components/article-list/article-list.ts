import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, type Ref } from 'lit/directives/ref.js';
import { Virtualizer } from '@tanstack/virtual-core';
import { libraryKey, queryClient, QueryController, fetchLibrary } from '../../query';
import {
    applyResumeAction,
    handleCursorKey,
    markBeforeAction,
    markShownReadAction,
    openArticleAction,
    refreshViewAction,
    toggleStarAction,
} from './article-list-actions';
import { loadFolderPageAction, loadSinglePageAction } from './article-list-paging';
import {
    beginReset,
    initialLoadState,
    isIdle,
    isLoading,
    libraryArrived,
    loadSettled,
    pageRequested,
    viewChanged,
    type LoadState,
    type LoadStep,
} from './article-list-load-state';
import { interestingActiveFor, loadInterestingBatchAction } from './article-list-interesting';
import { DwellTracker } from './article-list-dwell';
import {
    CARD_MIN_WIDTH,
    DEFAULT_PAGE_SIZE,
    describeFreshness,
    feedTitleOf,
    folderFeedsOf,
    freshestFetchAt,
    loadViewSettingsFor,
    saveViewSettingsFor,
    scopeLabelOf,
    viewRefreshKeyOf,
    viewTitleOf,
    virtualizerOptionsFor,
} from './article-list-helpers';
import { renderAdvancedMenu, renderInterestingHint, renderScroll, renderToolbar } from './article-list-render';
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
    @state() private sort: ArticleSort = 'hot';
    @state() cursor = -1;
    @state() private listView: ListViewType = 'detailed';
    @state() private maxCardCols = 4;
    @state() private cols = 3;
    @state() private pageSize = DEFAULT_PAGE_SIZE;
    @state() private advancedOpen = false;
    @state() private marking = false;
    @state() advancedAnchor: MenuAnchor | null = null;
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
    private cursors = new Map<string, string | undefined>();
    private feedHasMore = new Map<string, boolean>();
    private hasMoreSingle = true;
    private lastViewKey = '';
    resumeApplied = false;
    /** Feed membership last loaded: folder feeds, or every feed for All/Hot. */
    private lastFeedSetKey = '';
    /** Headline dwell with an active mouse, owned by this element's lifetime. */
    private dwell = new DwellTracker();
    private resizeObserver: ResizeObserver | undefined;
    feedWindowOffset = 0;
    /** In-flight refresh jobs by view key. Each folder is its own elevator button. */
    refreshJobs = new Map<string, Promise<void>>();
    @state() private activeRefreshKeys: string[] = [];

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
        this.virtualizer = new Virtualizer(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this.virtualizerCleanup = this.virtualizer._didMount();
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
        this.dwell.start();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
        this.scrollElRef.value?.removeEventListener('pointermove', this.onPointerActivity);
        this.scrollElRef.value?.removeEventListener('wheel', this.onPointerActivity);
        this.dwell.stop();
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.virtualizerCleanup?.();
    }

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
            this.loadViewSettings();
        }
        if (this.virtualizer) {
            this.virtualizer.setOptions(this.virtualizerOptions());
            this.virtualizer._willUpdate();
        }
    }

    override updated(_changed: Map<string, unknown>) {
        this.handleUpdate(this.currentViewKey());
    }

    private currentViewKey(): string {
        return `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}`;
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
            void this.applyStep(viewChanged(this.loadState, this.needsLibrary(), this.library.data !== undefined));
            return;
        }
        if (this.loadState.phase === 'awaiting-library' && this.library.data) {
            void this.applyStep(libraryArrived(this.loadState));
            return;
        }
        this.refreshFeedSetKey();
    }

    /**
     * The loader depends on library feed membership in two views: a folder
     * (its feeds) and All/Hot (every feed). `fetchLibrary()` paints feeds
     * after folders, so the first load can run against an empty set. Reload
     * when the set changes, or the view stays empty until something else
     * resets it.
     */
    private feedSetKey(): string {
        if (this.view.kind === 'folder' || this.view.kind === 'interesting') {
            return this.folderFeeds()
                .map((f) => f.id)
                .join(',');
        }
        if (this.view.kind === 'all' && this.sort === 'hot') {
            return (this.library.data?.feeds ?? []).map((f) => f.id).join(',');
        }
        return '';
    }

    private refreshFeedSetKey(): void {
        if (
            this.view.kind !== 'folder' &&
            this.view.kind !== 'interesting' &&
            !(this.view.kind === 'all' && this.sort === 'hot')
        )
            return;
        const feedSetKey = this.feedSetKey();
        if (feedSetKey === this.lastFeedSetKey) return;
        this.lastFeedSetKey = feedSetKey;
        void this.reset();
    }

    private needsLibrary(): boolean {
        return (
            this.view.kind === 'folder' ||
            this.view.kind === 'interesting' ||
            (this.view.kind === 'all' && this.sort === 'hot')
        );
    }

    override render() {
        const host = this as never;
        const virtualItems = this.virtualizer?.getVirtualItems() ?? [];
        const showFeed = this.view.kind !== 'feed';
        return html`
      ${renderToolbar(host)}
      ${renderInterestingHint(host)}
      ${renderAdvancedMenu(host)}
      ${renderScroll(host, virtualItems, showFeed)}
    `;
    }

    private interestingActive(): boolean {
        return interestingActiveFor(this.view);
    }

    onRetryLibrary() {
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    }

    onScroll = () => {
        if (!isIdle(this.loadState) || !this.canLoadMore()) return;
        const el = this.scrollElRef.value;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
            void this.loadNextPage();
        }
    };

    private canLoadMore(): boolean {
        if (this.items.length >= this.pageSize) return false;
        if (
            this.view.kind === 'feed' ||
            this.view.kind === 'folder' ||
            this.view.kind === 'interesting' ||
            (this.view.kind === 'all' && this.sort !== 'hot')
        ) {
            return this.hasMoreSingle;
        }
        const feeds = this.library.data?.feeds ?? [];
        if (!feeds.length) return false;
        return feeds.some((f) => this.feedHasMore.get(f.id) !== false);
    }

    private onFeedsRefreshed = () => {
        void this.reset();
    };

    private virtualizerOptions() {
        return virtualizerOptionsFor(this as never);
    }

    private folderFeeds(): Feed[] {
        return folderFeedsOf(this.view, this.library.data);
    }

    /** Feeds for an explicit view, so a refresh job can snapshot the view that started it. */
    feedsFor(view: View): Feed[] {
        if (view.kind === 'feed') {
            const feed = this.library.data?.feeds.find((f) => f.id === view.id);
            return feed ? [feed] : [];
        }
        if (view.kind === 'folder' || view.kind === 'interesting') {
            return folderFeedsOf(view, this.library.data);
        }
        return this.library.data?.feeds ?? [];
    }

    private loadViewSettings() {
        loadViewSettingsFor(this as never);
    }

    private saveViewSettings() {
        saveViewSettingsFor(this as never);
    }

    private reinitVirtualizer() {
        this.virtualizerCleanup?.();
        this.virtualizer = new Virtualizer(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this.virtualizerCleanup = this.virtualizer._didMount();
    }

    /**
     * Replace the list for the current view. The load machine decides whether
     * this starts now, queues behind the load in flight, or waits for the
     * library; `clear` is set on every path that replaces the list.
     */
    private async reset() {
        await this.applyStep(beginReset(this.loadState));
    }

    /** Infinite-scroll paging: append the next page, but only from idle. */
    private async loadNextPage() {
        await this.applyStep(pageRequested(this.loadState));
    }

    private async applyStep(step: LoadStep) {
        if (step.clear) this.clearList();
        this.loadState = step.state;
        if (step.start !== null) await this.runLoad(step.start);
    }

    private clearList() {
        this.items = [];
        this.loadError = null;
        this.cursors.clear();
        this.feedHasMore.clear();
        this.hasMoreSingle = true;
        this.cursor = -1;
        this.feedWindowOffset = 0;
        this.lastFeedSetKey = this.feedSetKey();
        const el = this.scrollElRef.value;
        if (el) el.scrollTop = 0;
        this.reinitVirtualizer();
    }

    /**
     * Fetch the page for `gen`. Pages accumulate (infinite scroll); the paging
     * actions drop a result whose generation no longer matches, so a superseded
     * load cannot be written into the list that replaced it. A failure sets a
     * banner instead of an empty list: without it the view reads as "no
     * articles" while the sidebar badge still counts them.
     */
    private async runLoad(gen: number) {
        try {
            await this.loadPageSource(gen);
            applyResumeAction(this as never);
        } catch (err) {
            console.error('article page load failed', err);
            if (gen === this.loadState.gen) {
                this.loadError = 'Could not load articles. Check your connection and try again.';
            }
        } finally {
            const step = loadSettled(this.loadState);
            this.loadState = step.state;
            if (step.start !== null) void this.runLoad(step.start);
        }
    }

    onRetryArticles() {
        void this.reset();
    }

    private loadPageSource(gen: number): Promise<void> {
        if (this.interestingActive()) {
            return loadInterestingBatchAction(this as never, gen);
        }
        if (this.view.kind === 'folder' || this.view.kind === 'interesting') {
            return loadFolderPageAction(this as never, gen);
        }
        return loadSinglePageAction(this as never, gen);
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
        handleCursorKey(this as never, e);
    };

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

    async onMarkShownRead() {
        await markShownReadAction(this as never);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
