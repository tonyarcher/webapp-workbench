import { html } from 'lit';
import { ref, type Ref } from 'lit/directives/ref.js';
import type { Virtualizer } from '@tanstack/virtual-core';
import { articleImage, safeHttpUrl } from '../../services/parser';
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
    sort: ArticleSort;
    listView: ListViewType;
    maxCardCols: number;
    pageSize: number;
    interestingOnly: boolean;
    advancedOpen: boolean;
    advancedAnchor: MenuAnchor | null;
    scrollElRef: Ref<HTMLDivElement>;
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
    library: { error: Error | undefined };
    viewTitle(): string;
    scopeLabel(): string;
    feedTitle(feedId: string): string | undefined;
    shadowEnabled(): boolean;
    interestingActive(): boolean;
    updateCols(): void;
    saveViewSettings(): void;
    openArticle(article: Article): Promise<void>;
    onStar(e: Event, article: Article): Promise<void>;
    onRowKey(e: KeyboardEvent, article: Article): void;
    onMarkShownRead(): Promise<void>;
    onToggleAdvanced(e: Event): void;
    onRefresh(): Promise<void>;
    onAdvancedUnread(e: Event): void;
    onMarkBefore(e: Event): Promise<void>;
    onRetryLibrary(): void;
    onScroll(): void;
}

type VirtualItems = ReturnType<Virtualizer<HTMLDivElement, HTMLDivElement>['getVirtualItems']>;

export function detailRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
) {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    const image = articleImage(article);
    return html`
      <div class="detail-body">
        ${image ? html`<img class="detail-img" src=${image} alt="" loading="lazy" />` : ''}
        <div class="detail-text">
          ${detailTitleRow(article, popular, link, onStar)}
          ${detailMeta(article, showFeed, feedTitle)}
          ${article.summary ? html`<div class="summary">${article.summary}</div>` : ''}
        </div>
      </div>
    `;
}

function detailTitleRow(
    article: Article,
    popular: boolean,
    link: string | undefined,
    onStar: (e: Event, article: Article) => void,
) {
    return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        ${link ? html`<a class="title title-link" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>` : html`<span class="title">${article.title}</span>`}
        <button class="star" title="Star" @click=${(e: Event) => onStar(e, article)}>${article.starred ? '★' : '☆'}</button>
      </div>
    `;
}

function detailMeta(article: Article, showFeed: boolean, feedTitle: string | undefined) {
    return html`
      <div class="meta">
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <span>${domainOf(article.link)}</span>
        <span>${formatDate(article.published)}</span>
        ${article.author ? html`<span>by ${article.author}</span>` : ''}
      </div>
    `;
}

export function headlineRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
) {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    return html`
      <div class="row-top">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        ${link ? html`<a class="title title-link" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>` : html`<span class="title">${article.title}</span>`}
        <span class="headline-date">${formatDate(article.published)}</span>
        <button class="star" title="Star" @click=${(e: Event) => onStar(e, article)}>${article.starred ? '★' : '☆'}</button>
      </div>
    `;
}

export function cardRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    selected: boolean,
    onStar: (e: Event, article: Article) => void,
    onOpen: (article: Article) => void,
    onKey: (e: KeyboardEvent, article: Article) => void,
) {
    const link = safeHttpUrl(article.link);
    const image = articleImage(article);
    return html`
      <div class="grid-card ${article.read ? 'read' : ''} ${selected ? 'selected' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}" @click=${() => onOpen(article)} @keydown=${(e: KeyboardEvent) => onKey(e, article)}>
        ${image ? html`<lazy-img class="grid-card-img" .src=${image}></lazy-img>` : html`<div class="grid-card-img grid-card-img-empty"></div>`}
        <div class="grid-card-body">
          ${cardTitleRow(article, link, onStar)}
          ${article.summary ? html`<div class="grid-card-summary">${article.summary}</div>` : ''}
          ${cardMeta(article, showFeed, feedTitle)}
        </div>
      </div>
    `;
}

function cardTitleRow(article: Article, link: string | undefined, onStar: (e: Event, article: Article) => void) {
    return html`
      <div class="grid-card-title-row">
        ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
        ${link ? html`<a class="grid-card-title" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>` : html`<span class="grid-card-title">${article.title}</span>`}
        <button class="star" title="Star" @click=${(e: Event) => onStar(e, article)}>${article.starred ? '★' : '☆'}</button>
      </div>
    `;
}

function cardMeta(article: Article, showFeed: boolean, feedTitle: string | undefined) {
    return html`
      <div class="meta">
        ${showFeed && feedTitle ? html`<span class="feed-label">${feedTitle}</span>` : ''}
        <span>${domainOf(article.link)}</span>
        <span>${formatDate(article.published)}</span>
      </div>
    `;
}

export function renderToolbar(host: ArticleListRenderHost) {
    return html`
      <div class="toolbar">
        <h2>${host.viewTitle()}</h2>
        <div class="actions">
          ${renderInterestingFilter(host)}${renderSortSelect(host)}${renderViewSelect(host)}${renderCardColsSelect(host)}${renderPageSizeSelect(host)}
          <button class="btn" @click=${host.onMarkShownRead}>Mark shown as read</button>
          <button class="btn" @click=${host.onToggleAdvanced}>Advanced</button>
          <button class="btn" @click=${host.onRefresh}>${host.refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>
    `;
}

function renderInterestingFilter(host: ArticleListRenderHost) {
    if (!host.shadowEnabled()) return html``;
    return html`<div class="segmented" role="group" aria-label="Article filter"><button class="seg ${!host.interestingOnly ? 'on' : ''}" aria-pressed=${!host.interestingOnly} @click=${() => {
        host.interestingOnly = false;
    }}>All</button><button class="seg ${host.interestingOnly ? 'on' : ''}" aria-pressed=${host.interestingOnly} @click=${() => {
        host.interestingOnly = true;
    }}>✨ Interesting</button></div>`;
}

export function renderInterestingHint(host: ArticleListRenderHost) {
    if (!host.shadowEnabled()) return html``;
    const words = topWords(interestingWordMapOf(host.items), 3);
    if (!words.length) return html`<div class="interesting-hint">Star articles to teach this filter.</div>`;
    return html`<div class="interesting-hint" title="Top learned words">✨ ${words.map((w) => `${w.word} · ${w.score}`).join(', ')}</div>`;
}

function renderSortSelect(host: ArticleListRenderHost) {
    if (host.interestingActive()) return html``;
    return html`<label class="sort"><select .value=${host.sort} @change=${(e: Event) => {
        host.sort = (e.target as HTMLSelectElement).value as ArticleSort;
        host.saveViewSettings();
    }}><option value="hot">Hot</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></label>`;
}

function renderViewSelect(host: ArticleListRenderHost) {
    return html`<label class="view-mode"><select .value=${host.listView} @change=${(e: Event) => {
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
    return html`<advanced-menu .open=${host.advancedOpen} .anchor=${host.advancedAnchor} .unreadOnly=${host.unreadOnly} .scopeLabel=${host.scopeLabel()} @unread-change=${host.onAdvancedUnread} @mark-before=${host.onMarkBefore} @close=${() => (host.advancedOpen = false)}></advanced-menu>`;
}

export function renderScroll(host: ArticleListRenderHost, virtualItems: VirtualItems, showFeed: boolean) {
    return html`
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

function renderListVirtualRow(host: ArticleListRenderHost, vi: { index: number; start: number }, showFeed: boolean) {
    const article = host.items[vi.index];
    if (!article) return html``;
    return html`<div class="row ${host.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${vi.index === host.cursor ? 'selected' : ''}" data-index=${vi.index} style="transform: translateY(${vi.start}px)" role="button" tabindex="0" aria-label="Open ${article.title}" @click=${() => host.openArticle(article)} @keydown=${(e: KeyboardEvent) => host.onRowKey(e, article)} ${ref((el) => host.virtualizer?.measureElement(el as HTMLDivElement))}>${host.listView === 'headline' ? renderHeadlineRow(host, article, showFeed) : renderRow(host, article, showFeed)}</div>`;
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
    if (host.unreadOnly || host.hideRead) return 'Nothing unread here — "Unread only" is filtering this view.';
    if (host.interestingActive()) return 'Nothing here yet. Star articles to teach this filter what you like.';
    return 'No articles yet. Hit Refresh to sync this view.';
}

function renderRow(host: ArticleListRenderHost, article: Article, showFeed: boolean) {
    return detailRowTemplate(article, showFeed, host.feedTitle(article.feedId), (e, a) => {
        void host.onStar(e, a);
    });
}

function renderHeadlineRow(host: ArticleListRenderHost, article: Article, showFeed: boolean) {
    return headlineRowTemplate(article, showFeed, host.feedTitle(article.feedId), (e, a) => {
        void host.onStar(e, a);
    });
}

function renderCardRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return cardRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        index === host.cursor,
        (e, a) => {
            void host.onStar(e, a);
        },
        (a) => {
            void host.openArticle(a);
        },
        (e, a) => host.onRowKey(e, a),
    );
}
