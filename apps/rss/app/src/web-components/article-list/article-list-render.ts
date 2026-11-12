import { html } from 'lit';
import { ref, type Ref } from 'lit/directives/ref.js';
import type { Virtualizer } from '@tanstack/virtual-core';
import { safeHttpUrl } from '../../services/parser';
import { articleImage, cardPlaceholderStyle } from '../../services/image';
import { articleVideo, watchUrlFor } from '../../services/video';
import { readMinutes } from '../../util';
import { topWords } from '../../services/interesting-words';
import { interestingWordMapOf } from './article-list-interesting';
import { domainOf, formatDate } from '../../util';
import type { Article, ArticleSort, ListViewType, View } from '../../types';
import type { MenuAnchor } from '../feed-menu/feed-menu';

/**
 * State and handlers the article-list templates read. The component passes
 * itself (`this as never`, matching article-list-actions.ts) so the html
 * strings stay identical to the ones the class used to render.
 */
export interface ArticleListRenderHost {
    view: View;
    items: Article[];
    cursor: number;
    cols: number;
    loading: boolean;
    refreshing: boolean;
    unreadOnly: boolean;
    hideRead: boolean;
    markOnScroll: boolean;
    sort: ArticleSort;
    listView: ListViewType;
    maxCardCols: number;
    pageSize: number;
    interestingStrictness: number;
    interestingActive(): boolean;
    loadError: string | null;
    selectedIds: string[];
    onRowClick(e: MouseEvent, index: number): void;
    clearSelection(): void;
    onBulkMarkRead(): void;
    onBulkStar(): void;
    onBulkDerank(): void;
    showShortcuts(): void;
    onRetryArticles(): void;
    freshnessLabel(): string;
    advancedOpen: boolean;
    marking: boolean;
    advancedAnchor: MenuAnchor | null;
    scrollElRef: Ref<HTMLDivElement>;
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
    library: { error: Error | undefined };
    viewTitle(): string;
    scopeLabel(): string;
    feedTitle(feedId: string): string | undefined;
    feedIcon(feedId: string): string | undefined;
    interestingActive(): boolean;
    updateCols(): void;
    saveViewSettings(): void;
    openArticle(article: Article): Promise<void>;
    onStar(e: Event, article: Article): Promise<void>;
    onMarkShownRead(): Promise<void>;
    onToggleAdvanced(e: Event): void;
    onRefresh(): Promise<void>;
    onAdvancedUnread(e: Event): void;
    onAdvancedMarkScroll(e: Event): void;
    onMarkBefore(e: Event): Promise<void>;
    onRetryLibrary(): void;
    onScroll(): void;
    onInterestingStrictness(e: Event): void;
}

type VirtualItems = ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>;

export function detailRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
) {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    const image = articleImage(article);
    return html`
      <div class="detail-body">
        ${image ? html`<img class="detail-img" src=${image} alt="" loading="lazy" />` : ''}
        <div class="detail-text">
          ${detailTitleRow(article, popular, onStar, onOpen)}
          ${detailMeta(article, showFeed, feedTitle, link)}
          ${article.summary ? html`<div class="summary">${article.summary}</div>` : ''}
        </div>
      </div>
    `;
}

function detailTitleRow(
    article: Article,
    popular: boolean,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
) {
    return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        <button class="title title-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            onOpen(e, article);
        }}>${article.title}</button>
        ${starButton(article, onStar)}
      </div>
    `;
}

/** Star toggle with its glyph hidden from the name computation: the visible
 *  star is not the word "Star", so a bare glyph fails label-in-name. */
function starButton(article: Article, onStar: (e: Event, article: Article) => void) {
    return html`<button class="star" aria-label=${article.starred ? 'Unstar' : 'Star'} @click=${(e: Event) => onStar(e, article)}><span aria-hidden="true">${article.starred ? '★' : '☆'}</span></button>`;
}

function detailMeta(article: Article, showFeed: boolean, feedTitle: string | undefined, link: string | undefined) {
    const minutes = readMinutes(article.content, article.summary);
    return html`
      <div class="meta">
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <span>${domainOf(article.link)}</span>
        <span>${formatDate(article.published)}</span>
        ${minutes > 0 ? html`<span>${minutes} min read</span>` : ''}
        ${article.author ? html`<span>by ${article.author}</span>` : ''}
        ${link ? html`<a class="orig-link" href=${link} target="_blank" rel="noopener noreferrer">original ↗</a>` : ''}
      </div>
    `;
}

export function headlineRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
) {
    const popular = article.popularity >= 4;
    const minutes = readMinutes(article.content, article.summary);
    return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <button class="title title-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            onOpen(e, article);
        }}>${article.title}</button>
        <span class="headline-date">${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}</span>
        ${starButton(article, onStar)}
      </div>
    `;
}

export function cardRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    feedIcon: string | undefined,
    selected: boolean,
    picked: boolean,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
) {
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const image = video ? undefined : articleImage(article, feedIcon);
    return html`
      <article class="grid-card ${article.read ? 'read' : ''} ${selected ? 'selected' : ''} ${picked ? 'picked' : ''}" @click=${(e: MouseEvent) => onOpen(e, article)}>
        <!-- pointer-only: the card body opens the article on pointer; keyboard and screen-reader users open it with the title button below. -->
        ${
            video
                ? html`<video-header class="grid-card-img" .video=${video} .videoTitle=${article.title} .videoLink=${watchUrlFor(video, link)}></video-header>`
                : image
                  ? html`<lazy-img class="grid-card-img" .src=${image}></lazy-img>`
                  : html`<div class="grid-card-img grid-card-img-empty" style=${cardPlaceholderStyle(article)}></div>`
        }
        <div class="grid-card-body">
          ${cardTitleRow(article, onStar, onOpen)}
          ${article.summary ? html`<div class="grid-card-summary">${article.summary}</div>` : ''}
          ${cardMeta(article, showFeed, feedTitle, link)}
        </div>
      </article>
    `;
}

function cardTitleRow(
    article: Article,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
) {
    return html`
      <div class="grid-card-title-row">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        <button class="grid-card-title title-open" @click=${(e: MouseEvent) => {
            e.stopPropagation();
            onOpen(e, article);
        }}>${article.title}</button>
        ${starButton(article, onStar)}
      </div>
    `;
}

function cardMeta(article: Article, showFeed: boolean, feedTitle: string | undefined, link: string | undefined) {
    const minutes = readMinutes(article.content, article.summary);
    return html`
      <div class="meta">
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <span>${domainOf(article.link)}</span>
        <span>${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}</span>
        ${link ? html`<a class="orig-link" href=${link} target="_blank" rel="noopener noreferrer">original ↗</a>` : ''}
      </div>
    `;
}

export function renderToolbar(host: ArticleListRenderHost) {
    return html`
      <div class="toolbar">
        <h2>${host.viewTitle()}</h2>
        <div class="actions">
          ${renderFreshness(host)}${renderSortSelect(host)}${renderViewSelect(host)}${renderCardColsSelect(host)}${renderPageSizeSelect(host)}
          <button class="btn" @click=${host.onMarkShownRead}>Mark shown as read</button>
          <button class="btn" title="Keyboard shortcuts (?)" @click=${host.showShortcuts}>?</button>
          <button class="btn" @click=${host.onToggleAdvanced}>Advanced</button>
          <button class="btn refresh" @click=${host.onRefresh}>${host.refreshing ? html`<span class="spinner" aria-hidden="true"></span>Refreshing…` : 'Refresh'}</button>
        </div>
      </div>
    `;
}

/**
 * How fresh this view's feeds are ("Updated 2m ago"). Empty until a feed
 * reports a fetch, so the toolbar shows nothing rather than a stale claim.
 */
function renderFreshness(host: ArticleListRenderHost) {
    const label = host.freshnessLabel();
    if (!label) return html``;
    return html`<span class="freshness">${label}</span>`;
}

export function renderInterestingHint(host: ArticleListRenderHost) {
    if (!host.interestingActive()) return html``;
    const strictness = host.interestingStrictness ?? 50;
    const words = topWords(interestingWordMapOf(host.items), 3);
    const hint = !words.length
        ? 'Star articles to teach this filter.'
        : `✨ ${words.map((w) => `${w.word} · ${w.score}`).join(', ')} · showing ${host.items.length}`;
    return html`<div class="interesting-bar">
      <label class="interesting-selectivity"><span>Selectivity</span><input
        type="range"
        min="0"
        max="100"
        step="5"
        .value=${String(strictness)}
        aria-label="Interesting selectivity"
        title="Higher hides more; lower shows more"
        @change=${host.onInterestingStrictness}
      /></label>
      <div class="interesting-hint" title="Top learned words">${hint}</div>
    </div>`;
}

function renderSortSelect(host: ArticleListRenderHost) {
    if (host.interestingActive()) return html``;
    return html`<label class="sort"><select aria-label="Sort articles" .value=${host.sort} @change=${(e: Event) => {
        host.sort = (e.target as HTMLSelectElement).value as ArticleSort;
        host.saveViewSettings();
    }}><option value="hot">Hot</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>`;
}

function renderViewSelect(host: ArticleListRenderHost) {
    return html`<label class="view-mode"><select aria-label="List view" .value=${host.listView} @change=${(
        e: Event,
    ) => {
        host.listView = (e.target as HTMLSelectElement).value as ListViewType;
        host.saveViewSettings();
    }}><option value="detailed">Detailed List</option><option value="headline">Headline View</option><option value="cards">Cards</option></select></label>`;
}

function renderCardColsSelect(host: ArticleListRenderHost) {
    if (host.listView !== 'cards') return html``;
    return html`<label class="view-mode"><select .value=${host.maxCardCols} @change=${(e: Event) => {
        host.maxCardCols = Number((e.target as HTMLSelectElement).value);
        host.saveViewSettings();
        host.updateCols();
    }} title="Maximum card columns"><option value="2">2 cols</option><option value="3">3 cols</option><option value="4">4 cols</option><option value="5">5 cols</option><option value="6">6 cols</option></select></label>`;
}

function renderPageSizeSelect(host: ArticleListRenderHost) {
    return html`<label class="page-size"><select .value=${host.pageSize} @change=${(e: Event) => {
        host.pageSize = Number((e.target as HTMLSelectElement).value);
        host.saveViewSettings();
    }} title="Articles shown at a time"><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="500">500</option></select></label>`;
}

export function renderAdvancedMenu(host: ArticleListRenderHost) {
    return html`<advanced-menu .open=${host.advancedOpen} .anchor=${host.advancedAnchor} .unreadOnly=${host.unreadOnly} .markOnScroll=${host.markOnScroll} .marking=${host.marking} .scopeLabel=${host.scopeLabel()} @unread-change=${host.onAdvancedUnread} @mark-scroll-change=${host.onAdvancedMarkScroll} @mark-before=${host.onMarkBefore} @close=${() => (host.advancedOpen = false)}></advanced-menu>`;
}

export function renderScroll(host: ArticleListRenderHost, virtualItems: VirtualItems, showFeed: boolean) {
    return html`
      ${host.loadError ? html`<div class="load-error" role="alert">${host.loadError} <button class="btn" @click=${host.onRetryArticles}>Retry</button></div>` : ''}
      <div class="scroll" style="--cols: ${host.cols}" ${ref(host.scrollElRef)} @scroll=${host.onScroll}>
        <div class="viewport" style="height: ${host.virtualizer?.getTotalSize() ?? 0}px;">${renderVirtualRows(host, virtualItems, showFeed)}</div>
        ${renderScrollFooter(host)}
      </div>
    `;
}

function renderVirtualRows(host: ArticleListRenderHost, virtualItems: VirtualItems, showFeed: boolean) {
    if (host.listView === 'cards') return virtualItems.map((vi) => renderCardVirtualRow(host, vi, showFeed));
    return virtualItems.map((vi) => renderListVirtualRow(host, vi, showFeed));
}

function renderCardVirtualRow(host: ArticleListRenderHost, vi: { index: number; start: number }, showFeed: boolean) {
    const start = vi.index * host.cols;
    const rowItems = host.items.slice(start, start + host.cols);
    if (!rowItems.length) return html``;
    return html`<div class="row cards" data-row=${vi.index} style="transform: translateY(${vi.start}px)" ${ref((el) => host.virtualizer?.measureElement(el as HTMLDivElement))}>${rowItems.map((article, c) => renderCardRow(host, article, showFeed, start + c))}</div>`;
}

export function renderSelectionBar(host: ArticleListRenderHost) {
    if (!host.selectedIds.length) return html``;
    const count = host.selectedIds.length;
    return html`
      <div class="selection-bar" role="toolbar" aria-label="Bulk actions">
        <span class="selection-count">${count} selected</span>
        <button class="btn" @click=${host.onBulkMarkRead}>Mark read</button>
        <button class="btn" @click=${host.onBulkStar}>Star</button>
        <button class="btn" @click=${host.onBulkDerank}>Not interesting</button>
        <button class="btn" @click=${host.clearSelection}>Clear</button>
      </div>
    `;
}

function renderListVirtualRow(host: ArticleListRenderHost, vi: { index: number; start: number }, showFeed: boolean) {
    const article = host.items[vi.index];
    if (!article) return html``;
    const picked = host.selectedIds.includes(article.id);
    return html`<!-- pointer-only: the row body opens the article on pointer; keyboard users open it with the title button. Shift+click selects a range. --><div class="row ${host.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${vi.index === host.cursor ? 'selected' : ''} ${picked ? 'picked' : ''}" data-index=${vi.index} style="transform: translateY(${vi.start}px)" @click=${(e: MouseEvent) => host.onRowClick(e, vi.index)} ${ref((el) => host.virtualizer?.measureElement(el as HTMLDivElement))}>${host.listView === 'headline' ? renderHeadlineRow(host, article, showFeed, vi.index) : renderRow(host, article, showFeed, vi.index)}</div>`;
}

function renderScrollFooter(host: ArticleListRenderHost) {
    return html`
      ${host.loading ? html`<div class="end">Loading…</div>` : ''}
      ${!host.loading && host.items.length ? html`<div class="mark-end"><button class="mark-end-btn" ?disabled=${!host.items.some((a) => a.read === 0)} @click=${host.onMarkShownRead}>Mark shown as read</button></div>` : ''}
      ${!host.loading && !host.items.length ? html`<div class="empty">${emptyText(host)}</div>` : ''}
      ${host.library.error && host.view.kind !== 'feed' ? html`<div class="empty">Could not load your feeds. <button class="btn" @click=${host.onRetryLibrary}>Retry</button></div>` : ''}
    `;
}

function emptyText(host: ArticleListRenderHost): string {
    if (!host.interestingActive()) return emptyTextFor(host.unreadOnly, host.hideRead, false);
    if (host.unreadOnly || host.hideRead) return emptyTextFor(host.unreadOnly, host.hideRead, true);
    const learned = Object.keys(interestingWordMapOf(host.items)).length > 0;
    return emptyTextFor(false, false, true, learned);
}

/**
 * Pure empty-state copy so the two unread filters cannot be confused: the
 * "just marked as read" case names itself instead of blaming "Unread only".
 */
export function emptyTextFor(unreadOnly: boolean, hideRead: boolean, interesting: boolean, hasSignal = false): string {
    if (hideRead && !unreadOnly) return 'Nothing unread here — the shown articles were just marked as read.';
    if (unreadOnly || hideRead) return 'Nothing unread here — "Unread only" is filtering this view.';
    if (interesting && hasSignal) return 'Nothing meets this selectivity — lower it to see more.';
    if (interesting) return 'Nothing here yet. Star articles to teach this view what you like.';
    return 'No articles yet. Hit Refresh to sync this view.';
}

function renderRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return detailRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        (e, a) => {
            void host.onStar(e, a);
        },
        (e) => {
            host.onRowClick(e, index);
        },
    );
}

function renderHeadlineRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return headlineRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        (e, a) => {
            void host.onStar(e, a);
        },
        (e) => {
            host.onRowClick(e, index);
        },
    );
}

function renderCardRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return cardRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        host.feedIcon(article.feedId),
        index === host.cursor,
        host.selectedIds.includes(article.id),
        (e, a) => {
            void host.onStar(e, a);
        },
        (e, _a) => host.onRowClick(e, index),
    );
}
