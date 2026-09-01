import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {createRef, ref, type Ref} from 'lit/directives/ref.js';
import {Virtualizer} from '@tanstack/virtual-core';
import {libraryKey, queryClient, QueryController} from '../../query';
import {getLibrary} from '../../services/api';
import {markBeforeAction, markShownReadAction, openArticleAction, toggleStarAction} from './article-list-actions';
import {refreshFeed, refreshFolder, syncAllFeeds} from '../../mutations';
import type {Article, ArticleSort, Feed, Folder, ListViewType, View} from '../../types';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import '../advanced-menu/advanced-menu';
import '../lazy-img/lazy-img';
import styles from './article-list.css?inline';
import {cardRowTemplate, detailRowTemplate, headlineRowTemplate} from './article-list-render';
import {fetchFolderPage, fetchSinglePage, fetchFeedSetWindow, getActiveFeeds, nextWindow} from './article-list-paging';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

import {
    CARD_MIN_WIDTH,
    clampPageSize,
    DEFAULT_PAGE_SIZE,
    feedTitleOf,
    folderFeedsOf,
    readViewSettings,
    scopeLabelOf,
    viewKeyOf,
    viewRefreshKeyOf,
    viewTitleOf,
    VIEW_SETTINGS_KEY,
    virtualizerOptionsFor,
} from './article-list-helpers';

@customElement('article-list')
export class ArticleList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) view: View = {kind: 'all'};
    @property({attribute: false}) resumeArticleId: string | null = null;
    @property({attribute: false}) active = true;

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
    private resizeObserver?: ResizeObserver;
    private feedWindowOffset = 0;
    private refreshJob: Promise<void> | null = null;
    private refreshJobKey: string | null = null;
    private refreshGen = 0;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: () => getLibrary(),
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
        const {id, starred} = (e as CustomEvent<{ id: string; starred: boolean }>).detail;
        let changed = false;
        this.items = this.items.map((a) => {
            if (a.id === id && a.starred !== starred) {
                changed = true;
                return {...a, starred};
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
                return {...a, read: 1};
            }
            return a;
        });
        if (changed) this.requestUpdate();
    };

    override willUpdate(changed: Map<string, unknown>) {
        if (changed.has('view')) {
            this.loadViewSettings();
        }
        if (this.virtualizer) {
            this.virtualizer.setOptions(this.virtualizerOptions());
            this.virtualizer._willUpdate();
        }
    }

    override updated(_changed: Map<string, unknown>) {
        const viewKey = `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}`;
        if (viewKey !== this.lastViewKey) {
            this.hideRead = false;
            this.loadViewSettings();
            this.lastViewKey = `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}`;
            if (this.needsLibrary() && !this.library.data) {
                // Feed-set views need the library (feed list) before loading;
                // updated() re-fires when the library query resolves.
                this.pendingReset = true;
                return;
            }
            this.pendingReset = false;
            this.reset();
            return;
        }
        if (this.pendingReset && this.library.data) {
            this.pendingReset = false;
            this.reset();
            return;
        }
        if (this.view.kind === 'folder') {
            const folderKey = this.folderFeeds().map((f) => f.id).join(',');
            if (folderKey !== this.lastFolderKey) {
                this.lastFolderKey = folderKey;
                this.reset();
            }
        }
    }

    private needsLibrary(): boolean {
        return this.view.kind === 'folder' || (this.view.kind === 'all' && this.sort === 'hot');
    }

    override render() {
        const virtualItems = this.virtualizer?.getVirtualItems() ?? [];
        const showFeed = this.view.kind !== 'feed';
        return html`
      ${this.renderToolbar()}
      ${this.renderAdvancedMenu()}
      ${this.renderScroll(virtualItems, showFeed)}
    `;
    }

    private renderToolbar() {
        return html`
      <div class="toolbar">
        <h2>${this.viewTitle()}</h2>
        <div class="actions">
          ${this.renderSortSelect()}${this.renderViewSelect()}${this.renderCardColsSelect()}${this.renderPageSizeSelect()}
          <button class="btn" @click=${this.onMarkShownRead}>Mark shown as read</button>
          <button class="btn" @click=${this.onToggleAdvanced}>Advanced</button>
          <button class="btn" @click=${this.onRefresh}>${this.refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>
    `;
    }

    private renderSortSelect() {
        return html`<label class="sort"><select .value=${this.sort} @change=${(e: Event) => { this.sort = (e.target as HTMLSelectElement).value as ArticleSort; this.saveViewSettings(); }}><option value="hot">Hot</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>`;
    }

    private renderViewSelect() {
        return html`<label class="view-mode"><select .value=${this.listView} @change=${(e: Event) => { this.listView = (e.target as HTMLSelectElement).value as ListViewType; this.saveViewSettings(); }}><option value="detailed">Detailed List</option><option value="headline">Headline View</option><option value="cards">Cards</option></select></label>`;
    }

    private renderCardColsSelect() {
        if (this.listView !== 'cards') return html``;
        return html`<label class="view-mode"><select .value=${this.maxCardCols} @change=${(e: Event) => { this.maxCardCols = Number((e.target as HTMLSelectElement).value); this.saveViewSettings(); this.updateCols(); }} title="Maximum card columns"><option value="2">2 cols</option><option value="3">3 cols</option><option value="4">4 cols</option><option value="5">5 cols</option><option value="6">6 cols</option></select></label>`;
    }

    private renderPageSizeSelect() {
        return html`<label class="page-size"><select .value=${this.pageSize} @change=${(e: Event) => { this.pageSize = Number((e.target as HTMLSelectElement).value); this.saveViewSettings(); }} title="Articles shown at a time"><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="500">500</option></select></label>`;
    }

    private renderAdvancedMenu() {
        return html`<advanced-menu .open=${this.advancedOpen} .anchor=${this.advancedAnchor} .unreadOnly=${this.unreadOnly} .scopeLabel=${this.scopeLabel()} @unread-change=${this.onAdvancedUnread} @mark-before=${this.onMarkBefore} @close=${() => (this.advancedOpen = false)}></advanced-menu>`;
    }

    private renderScroll(virtualItems: ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>, showFeed: boolean) {
        return html`
      <div class="scroll" style="--cols: ${this.cols}" ${ref(this.scrollElRef)} @scroll=${this.onScroll}>
        <div class="viewport" style="height: ${this.virtualizer?.getTotalSize() ?? 0}px;">${this.renderVirtualRows(virtualItems, showFeed)}</div>
        ${this.renderScrollFooter()}
      </div>
    `;
    }

    private renderVirtualRows(virtualItems: ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>, showFeed: boolean) {
        if (this.listView === 'cards') return virtualItems.map((vi) => this.renderCardVirtualRow(vi, showFeed));
        return virtualItems.map((vi) => this.renderListVirtualRow(vi, showFeed));
    }

    private renderCardVirtualRow(vi: { index: number; start: number }, showFeed: boolean) {
        const start = vi.index * this.cols;
        const rowItems = this.items.slice(start, start + this.cols);
        if (!rowItems.length) return html``;
        return html`<div class="row cards" data-row=${vi.index} style="transform: translateY(${vi.start}px)" ${ref((el) => this.virtualizer?.measureElement(el as HTMLDivElement))}>${rowItems.map((article, c) => this.renderCardRow(article, showFeed, start + c))}</div>`;
    }

    private renderListVirtualRow(vi: { index: number; start: number }, showFeed: boolean) {
        const article = this.items[vi.index];
        if (!article) return html``;
        return html`<div class="row ${this.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${vi.index === this.cursor ? 'selected' : ''}" data-index=${vi.index} style="transform: translateY(${vi.start}px)" role="button" tabindex="0" aria-label="Open ${article.title}" @click=${() => this.openArticle(article)} @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)} ${ref((el) => this.virtualizer?.measureElement(el as HTMLDivElement))}>${this.listView === 'headline' ? this.renderHeadlineRow(article, showFeed) : this.renderRow(article, showFeed)}</div>`;
    }

    private renderScrollFooter() {
        return html`
      ${this.loading ? html`<div class="end">Loading…</div>` : ''}
      ${!this.loading && this.items.length ? html`<div class="mark-end"><button class="mark-end-btn" ?disabled=${!this.items.some((a) => a.read === 0)} @click=${this.onMarkShownRead}>Mark shown as read</button></div>` : ''}
      ${!this.loading && !this.items.length ? html`<div class="empty">${this.unreadOnly || this.hideRead ? 'Nothing unread here — "Unread only" is filtering this view.' : 'No articles yet. Hit Refresh to sync this view.'}</div>` : ''}
      ${this.library.error && this.view.kind !== 'feed' ? html`<div class="empty">Could not load your feeds. <button class="btn" @click=${this.onRetryLibrary}>Retry</button></div>` : ''}
    `;
    }

    private onRetryLibrary() {
        void queryClient.invalidateQueries({queryKey: libraryKey});
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

    private virtualizerOptions() { return virtualizerOptionsFor(this as never); }

    private folderFeeds(): Feed[] { return folderFeedsOf(this.view, this.library.data); }

    private viewKey(): string { return viewKeyOf(this.view); }

    private loadViewSettings() {
        const saved = readViewSettings()[this.viewKey()];
        if (!saved) return;
        this.listView = saved.listView ?? 'detailed';
        this.sort = saved.sort ?? 'hot';
        this.pageSize = clampPageSize(saved.pageSize);
        this.maxCardCols = saved.maxCardCols ?? 4;
        this.unreadOnly = saved.unreadOnly ?? false;
        this.updateCols();
    }

    private saveViewSettings() {
        const map = readViewSettings();
        map[this.viewKey()] = {
            listView: this.listView,
            sort: this.sort,
            pageSize: this.pageSize,
            maxCardCols: this.maxCardCols,
            unreadOnly: this.unreadOnly,
        };
        try {
            localStorage.setItem(VIEW_SETTINGS_KEY, JSON.stringify(map));
        } catch {
            // ignore
        }
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
        this.lastFolderKey = this.folderFeeds().map((f) => f.id).join(',');
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
            if (this.view.kind === 'folder') {
                await this.loadFolderPage(gen);
            } else {
                await this.loadSinglePage(gen);
            }
            this.applyResume();
        } finally {
            this.loadingRef = false;
            this.loading = false;
            if (this.pendingReset) {
                this.pendingReset = false;
                void this.reset();
            }
        }
    }

    private applyResume() {
        if (this.resumeApplied || this.resumeArticleId == null) return;
        this.resumeApplied = true;
        const index = this.items.findIndex((a) => a.id === this.resumeArticleId);
        if (index >= 0) {
            this.cursor = index;
            const target =
                this.listView === 'cards'
                    ? Math.floor(index / Math.max(1, this.cols))
                    : index;
            this.virtualizer?.scrollToIndex(target, {align: 'center'});
        }
    }

    private async loadSinglePage(gen: number) {
        const feedId = this.view.kind === 'feed' ? this.view.id : undefined;
        if (this.view.kind === 'all' && this.sort === 'hot') {
            await this.loadFeedSetPage(this.library.data?.feeds ?? [], gen);
            return;
        }
        const res = await fetchSinglePage(feedId, this.cursors, this.unreadOnly, this.hideRead, this.sort, this.pageSize, this.items);
        if (gen !== this.gen) return;
        this.hasMoreSingle = res.hasMore;
        this.items = res.items;
        if (res.nextCursor) this.cursors.set(feedId ?? 'all', res.nextCursor);
    }

    private async loadFolderPage(gen: number) {
        if (this.view.kind !== 'folder') return;
        const key = `folder:${this.view.id}`;
        const res = await fetchFolderPage(key, this.cursors, this.unreadOnly, this.hideRead, this.sort, this.pageSize, this.items);
        if (gen !== this.gen) return;
        this.hasMoreSingle = res.hasMore;
        this.items = res.items;
        if (res.nextCursor) this.cursors.set(key, res.nextCursor);
    }

    private async loadFeedSetPage(feeds: Feed[], gen: number) {
        while (true) {
            const active = getActiveFeeds(feeds, this.feedHasMore);
            if (!active.length) return;
            const windowFeeds = nextWindow(active, this.feedWindowOffset, this.pageSize);
            this.feedWindowOffset += windowFeeds.length;
            const result = await fetchFeedSetWindow(windowFeeds, this.cursors, this.feedHasMore, this.unreadOnly, this.hideRead, this.sort, this.pageSize, this.items, gen, () => this.gen);
            if (!result || gen !== this.gen) return;
            for (const [id, hasMore] of result.hasMoreEntries) this.feedHasMore.set(id, hasMore);
            if (result.kept.length) {
                this.items = result.items;
                return;
            }
        }
    }

    private viewTitle(): string { return viewTitleOf(this.view, this.library.data); }

    private feedTitle(feedId: string): string | undefined { return feedTitleOf(feedId, this.library.data); }

    private async openArticle(article: Article) { await openArticleAction(this as never, article); }

    private isKeyHandlingIgnored(e: KeyboardEvent): boolean {
        if (!this.active) return true;
        if (e.key !== 'j' && e.key !== 'k') return true;
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (document.querySelector('dialog[open]')) return true;
        if (!this.items.length) return true;
        return false;
    }

    private nextCursorIndex(key: string): number {
        return Math.max(0, Math.min(this.cursor + (key === 'j' ? 1 : -1), this.items.length - 1));
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (this.isKeyHandlingIgnored(e)) return;
        e.preventDefault();
        const next = this.nextCursorIndex(e.key);
        this.cursor = next;
        void this.openArticle(this.items[next]);
    };

    private async onMarkShownRead() { await markShownReadAction(this as never); }

    private onToggleAdvanced(e: Event) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.advancedAnchor = {x: rect.right, y: rect.bottom + 6};
        this.advancedOpen = !this.advancedOpen;
    }

    private onAdvancedUnread(e: Event) {
        this.unreadOnly = (e as CustomEvent<boolean>).detail;
        this.saveViewSettings();
    }

    private scopeLabel(): string { return scopeLabelOf(this.view, this.library.data); }

    private async onMarkBefore(e: Event) {
        const cutoff = (e as CustomEvent<number | null>).detail;
        await markBeforeAction(this as never, cutoff);
    }

    private viewRefreshKey(): string { return viewRefreshKeyOf(this.view); }

    private async onRefresh() {
        // Elevator button for the current view only. A different folder/feed
        // starts its own job instead of waiting on an unrelated sync.
        const key = this.viewRefreshKey();
        if (this.refreshJob && this.refreshJobKey === key) {
            await this.refreshJob;
            return;
        }
        const job = this.runRefresh();
        this.refreshJob = job;
        this.refreshJobKey = key;
        try {
            await job;
        } finally {
            if (this.refreshJob === job) {
                this.refreshJob = null;
                this.refreshJobKey = null;
            }
        }
    }

    private async runRefresh() {
        const mine = ++this.refreshGen;
        this.refreshing = true;
        try {
            if (this.view.kind === 'feed') {
                await refreshFeed(this.view.id);
            } else if (this.view.kind === 'folder') {
                await refreshFolder(this.view.id);
            } else {
                await syncAllFeeds();
            }
        } catch {
            // feed sync errors are surfaced on the feed rows in the sidebar
        } finally {
            try {
                await this.reset();
            } finally {
                if (mine === this.refreshGen) this.refreshing = false;
            }
        }
    }

    private async onStar(e: Event, article: Article) {
        e.stopPropagation();
        await toggleStarAction(this as never, article);
    }

    private renderRow(article: Article, showFeed: boolean) {
        return detailRowTemplate(article, showFeed, this.feedTitle(article.feedId), (e, a) => this.onStar(e, a));
    }

    private renderHeadlineRow(article: Article, showFeed: boolean) {
        return headlineRowTemplate(article, showFeed, this.feedTitle(article.feedId), (e, a) => this.onStar(e, a));
    }

    private renderCardRow(article: Article, showFeed: boolean, index: number) {
        return cardRowTemplate(article, showFeed, this.feedTitle(article.feedId), index === this.cursor, (e, a) => this.onStar(e, a), (a) => this.openArticle(a), (e, a) => this.onRowKey(e, a));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
