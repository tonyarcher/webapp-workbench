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
    @state() private loading = false;
    @state() private unreadOnly = false;
    @state() private hideRead = false;
    @state() private sort: ArticleSort = 'hot';
    @state() private cursor = -1;
    @state() private listView: ListViewType = 'detailed';
    @state() private maxCardCols = 4;
    @state() private cols = 3;
    @state() private pageSize = DEFAULT_PAGE_SIZE;
    @state() private advancedOpen = false;
    @state() private advancedAnchor: MenuAnchor | null = null;
    @state() private refreshing = false;
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
    private lastFolderKey = '';
    private resumeApplied = false;
    private pendingReset = false;
    private resizeObserver: ResizeObserver | undefined;
    private feedWindowOffset = 0;
    private refreshJob: Promise<void> | null = null;
    private refreshJobKey: string | null = null;
    private refreshGenRef: { value: number } = { value: 0 };

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
        const viewKey = `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}|${this.interestingOnly}`;
        this.handleUpdate(viewKey);
    }

    private handleUpdate(viewKey: string): void {
        if (viewKey !== this.lastViewKey) {
            this.hideRead = false;
            this.loadViewSettings();
            this.lastViewKey = viewKey;
            if (this.needsLibrary() && !this.library.data) {
                // Feed-set views need the library (feed list) before loading;
                // updated() re-fires when the library query resolves.
                this.pendingReset = true;
                return;
            }
            this.pendingReset = false;
            void this.reset();
            return;
        }
        if (this.pendingReset && this.library.data) {
            this.pendingReset = false;
            void this.reset();
            return;
        }
        if (this.view.kind !== 'folder') return;
        const folderKey = this.folderFeeds()
            .map((f) => f.id)
            .join(',');
        if (folderKey === this.lastFolderKey) return;
        this.lastFolderKey = folderKey;
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

    private shadowEnabled(): boolean {
        return shadowEnabledFor(this.view);
    }

    private interestingActive(): boolean {
        return interestingActiveFor(this.view, this.interestingOnly);
    }

    private onRetryLibrary() {
        void queryClient.invalidateQueries({ queryKey: libraryKey });
    }

    private onRowKey(e: KeyboardEvent, article: Article) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Let child links/buttons handle their own keys.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        void this.openArticle(article);
    }

    private onScroll = () => {
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
        this.lastFolderKey = this.folderFeeds()
            .map((f) => f.id)
            .join(',');
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
            if (this.interestingActive()) {
                await loadInterestingBatchAction(this as never, gen);
            } else if (this.view.kind === 'folder') {
                await loadFolderPageAction(this as never, gen);
            } else {
                await loadSinglePageAction(this as never, gen);
            }
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

    private viewTitle(): string {
        return viewTitleOf(this.view, this.library.data);
    }

    private feedTitle(feedId: string): string | undefined {
        return feedTitleOf(feedId, this.library.data);
    }

    private async openArticle(article: Article) {
        await openArticleAction(this as never, article);
    }

    private onKeyDown = (e: KeyboardEvent) => {
        handleCursorKey(this as never, e);
    };

    private onToggleAdvanced(e: Event) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.advancedAnchor = { x: rect.right, y: rect.bottom + 6 };
        this.advancedOpen = !this.advancedOpen;
    }

    private onAdvancedUnread(e: Event) {
        this.unreadOnly = (e as CustomEvent<boolean>).detail;
        this.saveViewSettings();
    }

    private scopeLabel(): string {
        return scopeLabelOf(this.view, this.library.data);
    }

    private async onMarkBefore(e: Event) {
        const cutoff = (e as CustomEvent<number | null>).detail;
        this.advancedOpen = false;
        try {
            await markBeforeAction(this as never, cutoff);
        } catch (err) {
            console.error('mark-before failed', err);
        }
    }

    private async onRefresh() {
        await refreshViewAction(this as never, viewRefreshKeyOf(this.view));
    }

    private async onStar(e: Event, article: Article) {
        e.stopPropagation();
        await toggleStarAction(this as never, article);
    }

    private async onMarkShownRead() {
        await markShownReadAction(this as never);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
