import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref, createRef, type Ref } from 'lit/directives/ref.js';
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset } from '@tanstack/virtual-core';
import { libraryKey, QueryController, queryClient } from '../../query';
import { markAllRead, markArticleRead, markReadBefore, markShownRead, refreshFeed, toggleStar } from '../../mutations';
import { getFeeds, getFolders, queryArticles, type ArticleCursor } from '../../db/db';
import type { Article, ArticleSort, Feed, Folder, ListViewType, View } from '../../types';
import { formatDate, domainOf } from '../../util';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import '../advanced-menu/advanced-menu';
import styles from './article-list.css?inline';

interface Library {
  folders: Folder[];
  feeds: Feed[];
}

const DEFAULT_PAGE_SIZE = 50;

@customElement('article-list')
export class ArticleList extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ attribute: false }) view: View = { kind: 'all' };
  @property({ attribute: false }) resumeArticleId: string | null = null;

  @state() private items: Article[] = [];
  @state() private hasMore = false;
  @state() private loading = false;
  @state() private unreadOnly = false;
  @state() private sort: ArticleSort = 'hot';
  @state() private cursor = -1;
  @state() private listView: ListViewType = 'detailed';
  @state() private pageSize = DEFAULT_PAGE_SIZE;
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

  private library = new QueryController<Library>(this, () => ({
    queryKey: libraryKey,
    queryFn: async () => {
      const [folders, feeds] = await Promise.all([getFolders(), getFeeds()]);
      return { folders, feeds };
    },
  }));

  override firstUpdated() {
    this.virtualizer = new Virtualizer(this.virtualizerOptions());
    this.virtualizer._willUpdate();
    this.virtualizerCleanup = this.virtualizer._didMount();
  }

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
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

  private virtualizerOptions() {
    return {
      count: this.items.length,
      getScrollElement: () => this.scrollElRef.value ?? null,
      estimateSize: () => (this.listView === 'headline' ? 46 : 82),
      getItemKey: (index: number) => this.items[index]?.id ?? index,
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
      this.virtualizer?.scrollToIndex(index, { align: 'center' });
    }
  }

  private cursorOf(article: Article): ArticleCursor {
    return this.sort === 'hot' ? { key: article.hot, id: article.id } : { key: article.published, id: article.id };
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
      this.items = this.items.map((a) => (a.id === article.id ? { ...a, read: 1 } : a));
      await markArticleRead(article.id);
      queryClient.invalidateQueries({ queryKey: libraryKey });
    }
    const index = this.items.findIndex((a) => a.id === article.id);
    this.cursor = index;
    this.dispatchEvent(
      new CustomEvent('open-article', {
        detail: { article, index, items: this.items },
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
    this.items = this.items.map((a) => (a.read === 0 ? { ...a, read: 1 } : a));
    await markShownRead(ids);
  }

  private onToggleAdvanced(e: Event) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.advancedAnchor = { x: rect.right, y: rect.bottom + 6 };
    this.advancedOpen = !this.advancedOpen;
  }

  private onAdvancedUnread(e: Event) {
    this.unreadOnly = (e as CustomEvent<boolean>).detail;
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
    if (this.view.kind === 'feed') {
      await refreshFeed(this.view.id);
    } else if (this.view.kind === 'folder') {
      for (const feed of this.folderFeeds()) await refreshFeed(feed.id);
    }
    await this.reset();
  }

  private async onStar(e: Event, article: Article) {
    e.stopPropagation();
    const starred = !article.starred;
    this.items = this.items.map((a) => (a.id === article.id ? { ...a, starred } : a));
    await toggleStar(article.id);
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
                @change=${(e: Event) => (this.sort = (e.target as HTMLSelectElement).value as ArticleSort)}
              >
                <option value="hot">Hot</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
            <label class="view-mode">
              <select
                .value=${this.listView}
                @change=${(e: Event) => (this.listView = (e.target as HTMLSelectElement).value as ListViewType)}
              >
                <option value="detailed">Detailed List</option>
                <option value="headline">Headline View</option>
              </select>
            </label>
            <label class="page-size">
              <select
                .value=${this.pageSize}
                @change=${(e: Event) => (this.pageSize = Number((e.target as HTMLSelectElement).value))}
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

      <div class="scroll" ${ref(this.scrollElRef)} @scroll=${() => this.loadMore()}>
        <div class="viewport" style="height: ${this.virtualizer?.getTotalSize() ?? 0}px;">
          ${virtualItems.map((vi) => {
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

  private renderRow(article: Article, showFeed: boolean) {
    const feedTitle = this.feedTitle(article.feedId);
    const popular = article.popularity >= 4;
    return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        <span class="title">${article.title}</span>
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
