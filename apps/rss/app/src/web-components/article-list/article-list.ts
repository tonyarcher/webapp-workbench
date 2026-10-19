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
import { interestingActiveFor, loadInterestingBatchAction, shadowEnabledFor } from './article-list-interesting';
import {
    CARD_MIN_WIDTH,
    DEFAULT_PAGE_SIZE,
    feedTitleOf,
    folderFeedsOf,
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
    @state() loading = false;
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
    @state() refreshing = false;
    @state() private interestingOnly = false;

    private scrollElRef: Ref<HTMLDivElement> = createRef();
    private virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>;
    private virtualizerCleanup?: () => void;
    private cursors = new Map<string, string | undefined>();
    private feedHasMore = new Map<string, boolean>();
    private hasMoreSingle = true;
    private gen = 0;
    private loadingRef = false;
    private lastViewKey = '';
    resumeApplied = false;
    private pendingReset = false;
    // A view that needs the library arrived before the library painted. Kept
    // separate from pendingReset: pendingReset means "a load is in flight,
    // reload when it settles", and consuming that here re-enters reset() on
    // every update while the first fetch is still pending (the folder load
    // hang). This flag is only consumed once, when the library arrives.
    private pendingFirstLoad = false;
    /** Feed membership last loaded: folder feeds, or every feed for All/Hot. */
    private lastFeedSetKey = '';
    private resizeObserver: ResizeObserver | undefined;
    feedWindowOffset = 0;
    refreshJob: Promise<void> | null = null;
    refreshJobKey: string | null = null;
    refreshGenRef: { value: number } = { value: 0 };

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
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        window.removeEventListener('article-read', this.onArticleRead);
        window.removeEventListener('article-starred', this.onArticleStarred);
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.virtualizerCleanup?.();
    }

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
            this.loadViewSettings();
            // Ephemeral per-view filter: every folder starts at All.
            this.interestingOnly = false;
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
        return `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}|${this.interestingOnly}`;
    }

    private handleUpdate(viewKey: string): void {
        if (viewKey !== this.lastViewKey) {
            this.hideRead = false;
            this.loadViewSettings();
            // Settings can change sort/listView/pageSize, which are part of
            // the key. Record the key after loading them, or the next update
            // sees a "new" view and runs a second, duplicate reset.
            this.lastViewKey = this.currentViewKey();
            if (this.needsLibrary() && !this.library.data) {
                // Feed-set views need the library (feed list) before loading;
                // updated() re-fires when the library query resolves.
                this.pendingFirstLoad = true;
                return;
            }
            this.pendingFirstLoad = false;
            void this.reset();
            return;
        }
        if (this.pendingFirstLoad && this.library.data) {
            this.pendingFirstLoad = false;
            void this.reset();
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
        if (this.view.kind === 'folder') {
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
        if (this.view.kind !== 'folder' && !(this.view.kind === 'all' && this.sort === 'hot')) return;
        const feedSetKey = this.feedSetKey();
        if (feedSetKey === this.lastFeedSetKey) return;
        this.lastFeedSetKey = feedSetKey;
        void this.reset();
    }

    private needsLibrary(): boolean {
        return this.view.kind === 'folder' || (this.view.kind === 'all' && this.sort === 'hot');
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

    shadowEnabled(): boolean {
        return shadowEnabledFor(this.view);
    }

    private interestingActive(): boolean {
        return interestingActiveFor(this.view, this.interestingOnly);
    }

    onRetryLibrary() {
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    }

    onRowKey(e: KeyboardEvent, article: Article) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Let child links/buttons handle their own keys.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        void this.openArticle(article);
    }

    onScroll = () => {
        if (this.loadingRef || !this.canLoadMore()) return;
        const el = this.scrollElRef.value;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
            void this.loadPage();
        }
    };

    private canLoadMore(): boolean {
        if (this.items.length >= this.pageSize) return false;
        if (
            this.view.kind === 'feed' ||
            this.view.kind === 'folder' ||
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

    private async reset() {
        this.gen++;
        this.items = [];
        this.cursors.clear();
        this.feedHasMore.clear();
        this.hasMoreSingle = true;
        this.cursor = -1;
        this.feedWindowOffset = 0;
        this.lastFeedSetKey = this.feedSetKey();
        const el = this.scrollElRef.value;
        if (el) el.scrollTop = 0;
        this.reinitVirtualizer();
        await this.loadPage();
    }

    /**
     * Fetch the next page for the current view. Pages accumulate (infinite
     * scroll); `reset()` bumps the generation so in-flight results for a
     * previous view are discarded instead of shown.
     */
    private async loadPage() {
        if (this.loadingRef) {
            this.pendingReset = true;
            return;
        }
        const gen = this.gen;
        this.loadingRef = true;
        this.loading = true;
        try {
            await this.loadPageSource(gen);
            applyResumeAction(this as never);
        } finally {
            this.loadingRef = false;
            this.loading = false;
            if (this.pendingReset) {
                this.pendingReset = false;
                void this.reset();
            }
        }
    }

    private loadPageSource(gen: number): Promise<void> {
        if (this.interestingActive()) {
            return loadInterestingBatchAction(this as never, gen);
        }
        if (this.view.kind === 'folder') {
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

    private async openArticle(article: Article) {
        await openArticleAction(this as never, article);
    }

    private onKeyDown = (e: KeyboardEvent) => {
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
