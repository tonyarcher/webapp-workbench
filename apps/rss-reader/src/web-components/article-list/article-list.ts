import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {createRef, ref, type Ref} from 'lit/directives/ref.js';
import {elementScroll, observeElementOffset, observeElementRect, Virtualizer} from '@tanstack/virtual-core';
import {libraryKey, queryClient, QueryController} from '../../query';
import {
    markAllRead,
    markArticleRead,
    markReadBefore,
    markShownRead,
    refreshFeed,
    refreshFolder,
    syncAllFeeds,
    toggleStar
} from '../../mutations';
import {type ArticleCursor, getFeeds, getFolders, queryArticles} from '../../db/db';
import type {Article, ArticleSort, Feed, Folder, ListViewType, View} from '../../types';
import {domainOf, formatDate} from '../../util';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import '../advanced-menu/advanced-menu';
import styles from './article-list.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const DEFAULT_PAGE_SIZE = 50;
const LIST_VIEW_KEY = 'rss-reader:list-view';
const CARD_COLS_KEY = 'rss-reader:card-columns';
const SORT_KEY = 'rss-reader:article-sort';
const PAGE_SIZE_KEY = 'rss-reader:page-size';
const UNREAD_KEY = 'rss-reader:unread-only';
const CARD_MIN_WIDTH = 240;
const CARD_HEIGHT = 264;
const CARD_ROW_GAP = 12;
const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

function loadListView(): ListViewType {
    try {
        const v = localStorage.getItem(LIST_VIEW_KEY);
        if (v === 'headline' || v === 'cards') return v;
    } catch {
        // ignore
    }
    return 'detailed';
}

function loadCardCols(): number {
    try {
        const v = Number(localStorage.getItem(CARD_COLS_KEY));
        if (v >= 2 && v <= 6) return v;
    } catch {
        // ignore
    }
    return 4;
}

function loadSort(): ArticleSort {
    try {
        const v = localStorage.getItem(SORT_KEY);
        if (v === 'newest' || v === 'oldest') return v;
    } catch {
        // ignore
    }
    return 'hot';
}

function loadPageSize(): number {
    try {
        const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
        if (v === 20 || v === 50 || v === 100 || v === 500) return v;
    } catch {
        // ignore
    }
    return DEFAULT_PAGE_SIZE;
}

function loadUnreadOnly(): boolean {
    try {
        return localStorage.getItem(UNREAD_KEY) === '1';
    } catch {
        return false;
    }
}

@customElement('article-list')
export class ArticleList extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) view: View = {kind: 'all'};
    @property({attribute: false}) resumeArticleId: string | null = null;

    @state() private items: Article[] = [];
    @state() private hasMore = false;
    @state() private loading = false;
    @state() private unreadOnly = loadUnreadOnly();
    @state() private sort: ArticleSort = loadSort();
    @state() private cursor = -1;
    @state() private listView: ListViewType = loadListView();
    @state() private maxCardCols = loadCardCols();
    @state() private cols = 3;
    @state() private pageSize = loadPageSize();
    @state() private advancedOpen = false;
    @state() private advancedAnchor: MenuAnchor | null = null;

    private scrollElRef: Ref<HTMLDivElement> = createRef();
    private virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>;
    private virtualizerCleanup?: () => void;
    private cursors = new Map<string, ArticleCursor | undefined>();
    private feedHasMore = new Map<string, boolean>();
    private loadingRef = false;
    private lastViewKey = '';
    private lastFolderKey = '';
    private resumeApplied = false;
    private resizeObserver?: ResizeObserver;

    private library = new QueryController<Library>(this, () => ({
        queryKey: libraryKey,
        queryFn: async () => {
            const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
            return {folders, feeds};
        },
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
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('feeds-refreshed', this.onFeedsRefreshed);
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.virtualizerCleanup?.();
    }

    override willUpdate(_changed: Map<string, unknown>) {
        if (this.virtualizer) {
            this.virtualizer.setOptions(this.virtualizerOptions());
            this.virtualizer._willUpdate();
        }
    }

    override updated(_changed: Map<string, unknown>) {
        const viewKey = `${JSON.stringify(this.view)}|${this.unreadOnly}|${this.sort}|${this.listView}|${this.pageSize}`;
        if (viewKey !== this.lastViewKey) {
            this.lastViewKey = viewKey;
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
        if (this.items.length && this.hasMore && !this.loadingRef) {
            const el = this.scrollElRef.value;
            if (el && el.scrollHeight <= el.clientHeight) {
                this.loadMore();
            }
        }
    }

    override render() {
        const virtualItems = this.virtualizer?.getVirtualItems() ?? [];
        const showFeed = this.view.kind !== 'feed';

        return html`
      <div class="toolbar">
        <h2>${this.viewTitle()}</h2>
        <div class="actions">
            <label class="sort">
              <select
                .value=${this.sort}
                @change=${(e: Event) => {
                    this.sort = (e.target as HTMLSelectElement).value as ArticleSort;
                    try {
                        localStorage.setItem(SORT_KEY, this.sort);
                    } catch {
                        // ignore
                    }
                }}
              >
                <option value="hot">Hot</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
            <label class="view-mode">
              <select
                .value=${this.listView}
                @change=${(e: Event) => {
                    this.listView = (e.target as HTMLSelectElement).value as ListViewType;
                    try {
                        localStorage.setItem(LIST_VIEW_KEY, this.listView);
                    } catch {
                        // ignore
                    }
                }}
              >
                <option value="detailed">Detailed List</option>
                <option value="headline">Headline View</option>
                <option value="cards">Cards</option>
              </select>
            </label>
            ${this.listView === 'cards'
            ? html`
                  <label class="view-mode">
                    <select
                      .value=${this.maxCardCols}
                      @change=${(e: Event) => {
                          this.maxCardCols = Number((e.target as HTMLSelectElement).value);
                          try {
                              localStorage.setItem(CARD_COLS_KEY, String(this.maxCardCols));
                          } catch {
                              // ignore
                          }
                          this.updateCols();
                      }}
                      title="Maximum card columns"
                    >
                      <option value="2">2 cols</option>
                      <option value="3">3 cols</option>
                      <option value="4">4 cols</option>
                      <option value="5">5 cols</option>
                      <option value="6">6 cols</option>
                    </select>
                  </label>
                `
            : ''}
            <label class="page-size">
              <select
                .value=${this.pageSize}
                @change=${(e: Event) => {
                    this.pageSize = Number((e.target as HTMLSelectElement).value);
                    try {
                        localStorage.setItem(PAGE_SIZE_KEY, String(this.pageSize));
                    } catch {
                        // ignore
                    }
                }}
                title="Articles shown at a time"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="500">500</option>
              </select>
            </label>
            <button class="btn" @click=${this.onMarkShownRead}>Mark shown as read</button>
            <button class="btn" @click=${this.onToggleAdvanced}>Advanced</button>
            <button class="btn" @click=${this.onRefresh}>Refresh</button>
        </div>
      </div>

      <advanced-menu
        .open=${this.advancedOpen}
        .anchor=${this.advancedAnchor}
        .unreadOnly=${this.unreadOnly}
        .scopeLabel=${this.scopeLabel()}
        @unread-change=${this.onAdvancedUnread}
        @mark-before=${this.onMarkBefore}
        @close=${() => (this.advancedOpen = false)}
      ></advanced-menu>

      <div class="scroll" style="--cols: ${this.cols}" ${ref(this.scrollElRef)} @scroll=${() => this.loadMore()}>
        <div class="viewport" style="height: ${this.virtualizer?.getTotalSize() ?? 0}px;">
          ${this.listView === 'cards'
          ? virtualItems.map((vi) => {
                const start = vi.index * this.cols;
                const rowItems = this.items.slice(start, start + this.cols);
                if (!rowItems.length) return html``;
                return html`
                  <div
                    class="row cards"
                    data-row=${vi.index}
                    style="transform: translateY(${vi.start}px)"
                    ${ref((el) => this.virtualizer?.measureElement(el as HTMLDivElement))}
                  >
                    ${rowItems.map((article, c) => this.renderCardRow(article, showFeed, start + c))}
                  </div>
                `;
            })
          : virtualItems.map((vi) => {
                const article = this.items[vi.index];
                if (!article) return html``;
                return html`
                  <div
                    class="row ${this.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${vi.index === this.cursor ? 'selected' : ''}"
                    data-index=${vi.index}
                    style="transform: translateY(${vi.start}px)"
                    @click=${() => this.openArticle(article)}
                    ${ref((el) => this.virtualizer?.measureElement(el as HTMLDivElement))}
                  >
                    ${this.listView === 'headline'
                    ? this.renderHeadlineRow(article, showFeed)
                    : this.renderRow(article, showFeed)}
                  </div>
                `;
            })}
        </div>
        ${this.loading ? html`<div class="end">Loading…</div>` : ''}
        ${!this.loading && !this.items.length
            ? html`<div class="empty">No articles yet. Hit Refresh to sync this view.</div>`
            : ''}
      </div>
    `;
    }

    private onFeedsRefreshed = () => {
        void this.reset();
    };

    private virtualizerOptions() {
        const cards = this.listView === 'cards';
        return {
            count: cards
                ? Math.max(1, Math.ceil(this.items.length / Math.max(1, this.cols)))
                : this.items.length,
            getScrollElement: () => this.scrollElRef.value ?? null,
            estimateSize: () =>
                cards ? CARD_ROW_HEIGHT : this.listView === 'headline' ? 46 : 82,
            getItemKey: (index: number) =>
                cards ? `row:${index}` : (this.items[index]?.id ?? index),
            overscan: 8,
            scrollEndThreshold: 300,
            scrollToFn: elementScroll,
            observeElementRect,
            observeElementOffset,
            measureElement: (
                element: HTMLDivElement,
                entry: ResizeObserverEntry | undefined,
                instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
            ) => {
                const box = entry?.borderBoxSize?.[0];
                if (box && box.blockSize > 0) return Math.round(box.blockSize);
                const height = element.offsetHeight;
                if (height > 0) return height;
                return instance.options.estimateSize(instance.indexFromElement(element));
            },
            onChange: () => this.requestUpdate(),
        };
    }

    private folderFeeds(): Feed[] {
        if (this.view.kind === 'folder') {
            const id = this.view.id;
            return this.library.data?.feeds.filter((f) => f.folderIds.includes(id)) ?? [];
        }
        return [];
    }

    private reinitVirtualizer() {
        this.virtualizerCleanup?.();
        this.virtualizer = new Virtualizer(this.virtualizerOptions());
        this.virtualizer._willUpdate();
        this.virtualizerCleanup = this.virtualizer._didMount();
    }

    private async reset() {
        this.items = [];
        this.hasMore = false;
        this.cursors.clear();
        this.feedHasMore.clear();
        this.cursor = -1;
        const el = this.scrollElRef.value;
        if (el) el.scrollTop = 0;
        this.reinitVirtualizer();
        await this.loadPage();
    }

    private async loadPage() {
        if (this.loadingRef) return;
        this.loadingRef = true;
        this.loading = true;
        try {
            if (this.view.kind === 'folder') {
                await this.loadFolderPage();
            } else {
                await this.loadSinglePage();
            }
            this.applyResume();
        } finally {
            this.loadingRef = false;
            this.loading = false;
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

    private cursorOf(article: Article): ArticleCursor {
        return this.sort === 'hot' ? {key: article.hot, id: article.id} : {key: article.published, id: article.id};
    }

    private async loadSinglePage() {
        const feedId = this.view.kind === 'feed' ? this.view.id : undefined;
        const cursor = this.cursors.get(feedId ?? 'all');
        const res = await queryArticles({
            feedId,
            unreadOnly: this.unreadOnly,
            sort: this.sort,
            limit: this.pageSize,
            cursor,
        });
        this.items = mergeSorted(this.items, res.items, this.sort);
        this.hasMore = res.hasMore;
        const last = res.items[res.items.length - 1];
        if (last) {
            this.cursors.set(feedId ?? 'all', this.cursorOf(last));
        }
    }

    private async loadFolderPage() {
        const feeds = this.folderFeeds();
        if (!feeds.length) {
            this.hasMore = false;
            return;
        }

        const activeFeeds = feeds.filter((f) => this.feedHasMore.get(f.id) !== false);
        if (!activeFeeds.length) {
            this.hasMore = false;
            return;
        }

        const results = await Promise.all(
            activeFeeds.map(async (feed) => {
                const cursor = this.cursors.get(feed.id);
                const res = await queryArticles({
                    feedId: feed.id,
                    unreadOnly: this.unreadOnly,
                    sort: this.sort,
                    limit: this.pageSize,
                    cursor,
                });
                this.feedHasMore.set(feed.id, res.hasMore);
                const last = res.items[res.items.length - 1];
                if (last) {
                    this.cursors.set(feed.id, this.cursorOf(last));
                }
                return res.items;
            })
        );

        const merged = results.flat();
        this.items = mergeSorted(this.items, merged, this.sort);
        this.hasMore = Array.from(this.feedHasMore.values()).some(Boolean);
    }

    private async loadMore() {
        if (!this.hasMore || this.loadingRef) return;
        await this.loadPage();
    }

    private viewTitle(): string {
        const lib = this.library.data;
        if (!lib) return 'Articles';
        if (this.view.kind === 'feed') {
            const id = this.view.id;
            return lib.feeds.find((f) => f.id === id)?.title ?? 'Feed';
        }
        if (this.view.kind === 'folder') {
            const id = this.view.id;
            return lib.folders.find((f) => f.id === id)?.title ?? 'Folder';
        }
        return 'All';
    }

    private feedTitle(feedId: string): string | undefined {
        return this.library.data?.feeds.find((f) => f.id === feedId)?.title;
    }

    private async openArticle(article: Article) {
        if (article.read === 0) {
            this.items = this.items.map((a) => (a.id === article.id ? {...a, read: 1} : a));
            await markArticleRead(article.id);
            queryClient.invalidateQueries({queryKey: libraryKey});
        }
        const index = this.items.findIndex((a) => a.id === article.id);
        this.cursor = index;
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: {article, index, items: this.items},
                bubbles: true,
                composed: true,
            }),
        );
    }

    private onKeyDown = (e: KeyboardEvent) => {
        const key = e.key;
        if (key !== 'j' && key !== 'k') return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (document.querySelector('dialog[open]')) return;
        if (!this.items.length) return;
        e.preventDefault();
        const next = Math.max(0, Math.min(this.cursor + (key === 'j' ? 1 : -1), this.items.length - 1));
        this.cursor = next;
        if (next >= this.items.length - 5 && this.hasMore) {
            void this.loadMore();
        }
        void this.openArticle(this.items[next]);
    };

    private async onMarkShownRead() {
        const ids = this.items.filter((a) => a.read === 0).map((a) => a.id);
        if (!ids.length) return;
        this.items = this.items.map((a) => (a.read === 0 ? {...a, read: 1} : a));
        await markShownRead(ids);
    }

    private onToggleAdvanced(e: Event) {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        this.advancedAnchor = {x: rect.right, y: rect.bottom + 6};
        this.advancedOpen = !this.advancedOpen;
    }

    private onAdvancedUnread(e: Event) {
        this.unreadOnly = (e as CustomEvent<boolean>).detail;
        try {
            localStorage.setItem(UNREAD_KEY, this.unreadOnly ? '1' : '0');
        } catch {
            // ignore
        }
    }

    private scopeLabel(): string {
        const lib = this.library.data;
        const view = this.view;
        if (!lib) return '';
        if (view.kind === 'feed') {
            return lib.feeds.find((f) => f.id === view.id)?.title ?? 'Feed';
        }
        if (view.kind === 'folder') {
            return lib.folders.find((f) => f.id === view.id)?.title ?? 'Folder';
        }
        return 'All feeds';
    }

    private async onMarkBefore(e: Event) {
        const cutoff = (e as CustomEvent<number | null>).detail;
        if (cutoff === null) {
            if (this.view.kind === 'feed') {
                await markAllRead(this.view.id);
            } else if (this.view.kind === 'folder') {
                for (const feed of this.folderFeeds()) await markAllRead(feed.id);
            } else {
                await markAllRead();
            }
        } else {
            const feedIds =
                this.view.kind === 'feed'
                    ? [this.view.id]
                    : this.view.kind === 'folder'
                        ? this.folderFeeds().map((f) => f.id)
                        : undefined;
            await markReadBefore(feedIds, cutoff);
        }
        await this.reset();
    }

    private async onRefresh() {
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
            await this.reset();
        }
    }

    private async onStar(e: Event, article: Article) {
        e.stopPropagation();
        const starred = !article.starred;
        this.items = this.items.map((a) => (a.id === article.id ? {...a, starred} : a));
        await toggleStar(article.id);
    }

    private renderRow(article: Article, showFeed: boolean) {
        const feedTitle = this.feedTitle(article.feedId);
        const popular = article.popularity >= 4;
        return html`
      <div class="detail-body">
        ${article.image
        ? html`<img class="detail-img" src=${article.image} alt="" loading="lazy" />`
        : ''}
        <div class="detail-text">
          <div class="row-top">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
            ${article.link
            ? html`<a
                    class="title title-link"
                    href=${article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    @click=${(e: Event) => e.stopPropagation()}
                  >${article.title}</a>`
            : html`<span class="title">${article.title}</span>`}
            <button class="star" title="Star" @click=${(e: Event) => this.onStar(e, article)}>
              ${article.starred ? '★' : '☆'}
            </button>
          </div>
          <div class="meta">
            ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
            <span>${domainOf(article.link)}</span>
            <span>${formatDate(article.published)}</span>
            ${article.author ? html`<span>by ${article.author}</span>` : ''}
          </div>
          ${article.summary ? html`<div class="summary">${article.summary}</div>` : ''}
        </div>
      </div>
    `;
    }

    private renderHeadlineRow(article: Article, showFeed: boolean) {
        const feedTitle = this.feedTitle(article.feedId);
        const popular = article.popularity >= 4;
        return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <span class="title">${article.title}</span>
        <span class="headline-date">${formatDate(article.published)}</span>
        <button class="star" title="Star" @click=${(e: Event) => this.onStar(e, article)}>
          ${article.starred ? '★' : '☆'}
        </button>
      </div>
    `;
    }

    private renderCardRow(article: Article, showFeed: boolean, index: number) {
        const feedTitle = this.feedTitle(article.feedId);
        return html`
      <div
        class="grid-card ${article.read ? 'read' : ''} ${index === this.cursor ? 'selected' : ''}"
        @click=${() => this.openArticle(article)}
      >
        ${article.image
        ? html`<img class="grid-card-img" src=${article.image} alt="" loading="lazy" />`
        : html`<div class="grid-card-img grid-card-img-empty"></div>`}
        <div class="grid-card-body">
          <div class="grid-card-title-row">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${article.link
            ? html`<a
                    class="grid-card-title"
                    href=${article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    @click=${(e: Event) => e.stopPropagation()}
                  >${article.title}</a>`
            : html`<span class="grid-card-title">${article.title}</span>`}
            <button class="star" title="Star" @click=${(e: Event) => this.onStar(e, article)}>
              ${article.starred ? '★' : '☆'}
            </button>
          </div>
          ${article.summary ? html`<div class="grid-card-summary">${article.summary}</div>` : ''}
          <div class="meta">
            ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
            <span>${domainOf(article.link)}</span>
            <span>${formatDate(article.published)}</span>
          </div>
        </div>
      </div>
    `;
    }
}

function mergeSorted(current: Article[], incoming: Article[], sort: ArticleSort): Article[] {
    const seen = new Map(current.map((a) => [a.id, a]));
    for (const article of incoming) seen.set(article.id, article);
    const cmp =
        sort === 'hot'
            ? (a: Article, b: Article) => b.hot - a.hot || a.id.localeCompare(b.id)
            : sort === 'oldest'
                ? (a: Article, b: Article) => a.published - b.published || a.id.localeCompare(b.id)
                : (a: Article, b: Article) => b.published - a.published || a.id.localeCompare(b.id);
    return Array.from(seen.values()).sort(cmp);
}

declare global {
    interface HTMLElementTagNameMap {
        'article-list': ArticleList;
    }
}
