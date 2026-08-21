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
import {getLibrary, fetchArticlesPage} from '../../services/api';
import {safeHttpUrl} from '../../services/parser';
import {capItems, feedWindow, perFeedLimit} from '../../services/pagination';
import type {Article, ArticleSort, Feed, Folder, ListViewType, View} from '../../types';
import {domainOf, formatDate, interleaveArticles} from '../../util';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import '../advanced-menu/advanced-menu';
import '../lazy-img/lazy-img';
import styles from './article-list.css?inline';

interface Library {
    folders: Folder[];
    feeds: Feed[];
}

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZES = [20, 50, 100, 500] as const;

function clampPageSize(n: unknown): number {
    return typeof n === 'number' && (PAGE_SIZES as readonly number[]).includes(n)
        ? n
        : DEFAULT_PAGE_SIZE;
}
const VIEW_SETTINGS_KEY = 'rss-reader:view-settings';
const CARD_MIN_WIDTH = 240;
// 16:9 media (168px at the 300px column cap) + text block. Must match
// .grid-card / .grid-card-img / .row.cards gap in article-list.css.
const CARD_HEIGHT = 320;
const CARD_ROW_GAP = 16;
const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

interface ViewSettings {
    listView: ListViewType;
    sort: ArticleSort;
    pageSize: number;
    maxCardCols: number;
    unreadOnly: boolean;
}

function readViewSettings(): Record<string, ViewSettings> {
    try {
        const raw = localStorage.getItem(VIEW_SETTINGS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, ViewSettings>;
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
}

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
      <div class="toolbar">
        <h2>${this.viewTitle()}</h2>
        <div class="actions">
            <label class="sort">
              <select
                .value=${this.sort}
                @change=${(e: Event) => {
                    this.sort = (e.target as HTMLSelectElement).value as ArticleSort;
                    this.saveViewSettings();
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
                    this.saveViewSettings();
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
                          this.saveViewSettings();
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
                    this.saveViewSettings();
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
            <button class="btn" @click=${this.onRefresh}>${this.refreshing ? 'Refreshing…' : 'Refresh'}</button>
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

      <div class="scroll" style="--cols: ${this.cols}" ${ref(this.scrollElRef)} @scroll=${this.onScroll}>
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
                    role="button"
                    tabindex="0"
                    aria-label="Open ${article.title}"
                    @click=${() => this.openArticle(article)}
                    @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}
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
        ${!this.loading && this.items.length
            ? html`
                <div class="mark-end">
                  <button
                    class="mark-end-btn"
                    ?disabled=${!this.items.some((a) => a.read === 0)}
                    @click=${this.onMarkShownRead}
                  >Mark shown as read</button>
                </div>`
            : ''}
        ${!this.loading && !this.items.length
            ? html`<div class="empty">${this.unreadOnly || this.hideRead
                ? 'Nothing unread here — "Unread only" is filtering this view.'
                : 'No articles yet. Hit Refresh to sync this view.'}</div>`
            : ''}
        ${this.library.error && this.view.kind !== 'feed'
            ? html`<div class="empty">Could not load your feeds. <button class="btn" @click=${this.onRetryLibrary}>Retry</button></div>`
            : ''}
      </div>
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
        if (this.view.kind === 'feed' || (this.view.kind === 'all' && this.sort !== 'hot')) {
            return this.hasMoreSingle;
        }
        const feeds = this.view.kind === 'folder' ? this.folderFeeds() : this.library.data?.feeds ?? [];
        if (!feeds.length) return false;
        return feeds.some((f) => this.feedHasMore.get(f.id) !== false);
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

    private viewKey(): string {
        if (this.view.kind === 'feed') return `feed:${this.view.id}`;
        if (this.view.kind === 'folder') return `folder:${this.view.id}`;
        return 'all';
    }

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
        const cursor = this.cursors.get(feedId ?? 'all');
        const scope = feedId ? `feed:${feedId}` : undefined;
        const res = await fetchArticlesPage({
            scope,
            unreadOnly: this.unreadOnly || this.hideRead,
            sort: this.sort,
            limit: this.pageSize,
            cursor,
        });
        if (gen !== this.gen) return;
        this.hasMoreSingle = res.nextCursor !== undefined;
        this.items = capItems(mergeSorted(this.items, res.items, this.sort), this.pageSize); // shown-at-a-time cap
        if (res.nextCursor) {
            this.cursors.set(feedId ?? 'all', res.nextCursor);
        }
    }

    private async loadFolderPage(gen: number) {
        await this.loadFeedSetPage(this.folderFeeds(), gen);
    }

    /**
     * Load a page across a set of feeds (folder view, or All view with Hot
     * sort). Each page covers a bounded rotating window of at most `pageSize`
     * feeds (so ~2300 feeds touch a handful of feeds per fetch, not all of
     * them), with bounded concurrency. Each feed contributes a share of the
     * page (`perFeedLimit`) so a folder with few feeds still fills the page;
     * hot sort interleaves the feeds for diversity. When a feed is empty or
     * exhausted, one backfill pass tops the page up from feeds that still have
     * items. Cursors only advance past the items actually kept, so discarded
     * items are never silently skipped forever.
     *
     * Accepted tradeoff: in newest/oldest folder views a later page can insert
     * items above the current viewport (window rotation), which can shift the
     * scroll position.
     */
    private async loadFeedSetPage(feeds: Feed[], gen: number) {
        const activeFeeds = feeds.filter((f) => this.feedHasMore.get(f.id) !== false);
        if (!activeFeeds.length) {
            return;
        }

        const window = feedWindow(activeFeeds, this.feedWindowOffset, this.pageSize);
        this.feedWindowOffset += window.length;

        const pages = new Map<string, Article[]>();
        const lastHasMore = new Map<string, boolean>();

        const fetchFeeds = async (targets: Feed[], perFeed: number) => {
            for (let i = 0; i < targets.length; i += 12) {
                if (gen !== this.gen) return;
                await Promise.all(
                    targets.slice(i, i + 12).map(async (feed) => {
                        const accumulated = pages.get(feed.id) ?? [];
                        const res = await fetchArticlesPage({
                            scope: `feed:${feed.id}`,
                            unreadOnly: this.unreadOnly || this.hideRead,
                            sort: this.sort,
                            limit: perFeed,
                            cursor: this.cursors.get(feed.id),
                        });
                        pages.set(feed.id, [...accumulated, ...res.items]);
                        lastHasMore.set(feed.id, res.nextCursor !== undefined);
                        if (res.nextCursor) {
                            this.cursors.set(feed.id, res.nextCursor);
                        }
                    }),
                );
            }
        };

        const pick = (): Article[] => {
            const kept =
                this.sort === 'hot'
                    ? interleaveArticles(window.map((f) => pages.get(f.id) ?? []), this.pageSize)
                    : mergeSorted([], window.flatMap((f) => pages.get(f.id) ?? []), this.sort).slice(0, this.pageSize);
            return kept.filter((a) => !existingIds.has(a.id));
        };

        const existingIds = new Set(this.items.map((a) => a.id));
        await fetchFeeds(window, perFeedLimit(this.pageSize, window.length));
        if (gen !== this.gen) return;

        let kept = pick();
        if (kept.length < this.pageSize) {
            const more = window.filter((f) => lastHasMore.get(f.id) === true);
            if (more.length) {
                await fetchFeeds(more, perFeedLimit(this.pageSize - kept.length, more.length));
                if (gen !== this.gen) return;
                kept = pick();
            }
        }

        this.items = capItems(mergeSorted(this.items, kept, this.sort), this.pageSize); // shown-at-a-time cap

        for (const feed of window) {
            this.feedHasMore.set(feed.id, lastHasMore.get(feed.id) ?? false);
        }
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
        if (!this.active) return;
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
        void this.openArticle(this.items[next]);
    };

    private async onMarkShownRead() {
        const ids = this.items.filter((a) => a.read === 0).map((a) => a.id);
        if (!ids.length) return;
        await markShownRead(ids);
        this.hideRead = true;
        await this.reset();
    }

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
        this.hideRead = true;
        await this.reset();
    }

    private viewRefreshKey(): string {
        if (this.view.kind === 'feed') return `feed:${this.view.id}`;
        if (this.view.kind === 'folder') return `folder:${this.view.id}`;
        return 'all';
    }

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
        const starred = !article.starred;
        this.items = this.items.map((a) => (a.id === article.id ? {...a, starred} : a));
        await toggleStar(article.id, starred);
    }

    private renderRow(article: Article, showFeed: boolean) {
        const feedTitle = this.feedTitle(article.feedId);
        const popular = article.popularity >= 4;
        const link = safeHttpUrl(article.link);
        const image = safeHttpUrl(article.image);
        return html`
      <div class="detail-body">
        ${image
        ? html`<img class="detail-img" src=${image} alt="" loading="lazy" />`
        : ''}
        <div class="detail-text">
          <div class="row-top">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
            ${link
            ? html`<a
                    class="title title-link"
                    href=${link}
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
        const link = safeHttpUrl(article.link);
        return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        ${link
            ? html`<a
                    class="title title-link"
                    href=${link}
                    target="_blank"
                    rel="noopener noreferrer"
                    @click=${(e: Event) => e.stopPropagation()}
                  >${article.title}</a>`
            : html`<span class="title">${article.title}</span>`}
        <span class="headline-date">${formatDate(article.published)}</span>
        <button class="star" title="Star" @click=${(e: Event) => this.onStar(e, article)}>
          ${article.starred ? '★' : '☆'}
        </button>
      </div>
    `;
    }

    private renderCardRow(article: Article, showFeed: boolean, index: number) {
        const feedTitle = this.feedTitle(article.feedId);
        const link = safeHttpUrl(article.link);
        return html`
      <div
        class="grid-card ${article.read ? 'read' : ''} ${index === this.cursor ? 'selected' : ''}"
        role="button"
        tabindex="0"
        aria-label="Open ${article.title}"
        @click=${() => this.openArticle(article)}
        @keydown=${(e: KeyboardEvent) => this.onRowKey(e, article)}
      >
        ${article.image
        ? html`<lazy-img class="grid-card-img" .src=${article.image}></lazy-img>`
        : html`<div class="grid-card-img grid-card-img-empty"></div>`}
        <div class="grid-card-body">
          <div class="grid-card-title-row">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${link
            ? html`<a
                    class="grid-card-title"
                    href=${link}
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
