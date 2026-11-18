import type { Virtualizer } from '@tanstack/virtual-core';
import { safeHttpUrl } from '../../services/parser';
import { articleImage, cardPlaceholderStyle } from '../../services/image';
import { articleVideo, watchUrlFor } from '../../services/video';
import { readMinutes } from '../../util';
import { topWords } from '../../services/interesting-words';
import { isDeranked } from '../../services/interesting-settings';
import { interestingWordMapOf } from './article-list-interesting';
import { domainOf, formatDate } from '../../util';
import type { Article, ArticleSort, ListViewType, View } from '../../types';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import { append, el, svgIcon } from './article-list-dom';
import {
    highlightArgs,
    highlightToggle,
    renderRowHighlights,
    rowFragment,
    type HighlightHost,
    type RowHighlightRenderState,
} from './article-list-render-highlights';

/**
 * State and handlers the vanilla renderers read. The component passes itself
 * (`this as never`, matching article-list-actions.ts).
 */
export interface ArticleListRenderHost extends HighlightHost {
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
    mutedHidden: number;
    canUndoMute(): boolean;
    onUndoMute(): void;
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
    scrollElRef: { value: HTMLDivElement | null };
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
    library: { error: Error | undefined };
    viewTitle(): string;
    scopeLabel(): string;
    feedTitle(feedId: string): string | undefined;
    feedIcon(feedId: string): string | undefined;
    updateCols(): void;
    saveViewSettings(): void;
    openArticle(article: Article): Promise<void>;
    onStar(e: Event, article: Article): Promise<void>;
    onMarkShownRead(): Promise<void>;
    onCatchMeUp(): Promise<void>;
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

const DERANK_ACTIVE = 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z';
const DERANK_SLASH = 'M4 4l16 16';

function derankButton(article: Article): HTMLButtonElement {
    const active = isDeranked(article.id);
    const button = el('button', 'derank');
    button.setAttribute('aria-label', active ? 'Marked not interesting' : 'Not interesting');
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Marked not interesting' : 'Not interesting';
    if (active) {
        button.appendChild(
            svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
                ['path', { fill: 'currentColor', d: DERANK_ACTIVE }],
                [
                    'path',
                    {
                        d: DERANK_SLASH,
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2.2',
                        'stroke-linecap': 'round',
                    },
                ],
            ]),
        );
    } else {
        button.appendChild(
            svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    focusable: 'false',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    ['path', { d: DERANK_ACTIVE }],
                    ['path', { d: DERANK_SLASH }],
                ],
            ),
        );
    }
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        button.dispatchEvent(
            new CustomEvent('toggle-derank', {
                bubbles: true,
                composed: true,
                detail: { id: article.id, title: article.title },
            }),
        );
    });
    return button;
}

/** Star toggle with its glyph hidden from the name computation. */
function starButton(article: Article, onStar: (e: Event, article: Article) => void): HTMLButtonElement {
    const button = el('button', 'star');
    button.setAttribute('aria-label', article.starred ? 'Unstar' : 'Star');
    const glyph = el('span', undefined, article.starred ? '★' : '☆');
    glyph.setAttribute('aria-hidden', 'true');
    button.appendChild(glyph);
    button.addEventListener('click', (e) => onStar(e, article));
    return button;
}

function externalIcon(): SVGElement {
    return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
        [
            'path',
            {
                d: 'M14 4h6v6M20 4l-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
            },
        ],
    ]);
}

function origLink(link: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.className = 'orig-link';
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.title = 'Open original';
    anchor.setAttribute('aria-label', 'Open original');
    anchor.appendChild(externalIcon());
    return anchor;
}

function dot(): HTMLSpanElement {
    return el('span', 'unread-dot');
}

function popSpan(): HTMLSpanElement {
    const pop = el('span', 'pop', '🔥');
    pop.title = 'Trending in your feeds';
    return pop;
}

function feedLabel(feedTitle: string | undefined): HTMLSpanElement | null {
    return feedTitle ? el('span', 'feed-label', feedTitle) : null;
}

function detailMedia(
    video: ReturnType<typeof articleVideo>,
    image: string | undefined,
    article: Article,
    link: string | undefined,
): HTMLElement | null {
    if (video?.posters.length) {
        const header = document.createElement('video-header');
        header.className = 'detail-img detail-video';
        (header as unknown as { video: typeof video }).video = video;
        (header as unknown as { videoTitle: string }).videoTitle = article.title;
        (header as unknown as { videoLink: string | undefined }).videoLink = watchUrlFor(video, link);
        return header;
    }
    if (image) {
        const lazy = document.createElement('lazy-img');
        lazy.className = 'detail-img';
        (lazy as unknown as { src: string }).src = image;
        return lazy;
    }
    if (video) {
        const header = document.createElement('video-header');
        header.className = 'detail-img detail-video';
        (header as unknown as { video: typeof video }).video = video;
        (header as unknown as { videoTitle: string }).videoTitle = article.title;
        (header as unknown as { videoLink: string | undefined }).videoLink = watchUrlFor(video, link);
        return header;
    }
    return null;
}

function openButton(article: Article, className: string, onOpen: (e: MouseEvent, article: Article) => void) {
    const button = el('button', className, article.title);
    button.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        onOpen(e, article);
    });
    return button;
}

function detailTitleRow(
    article: Article,
    popular: boolean,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
): HTMLElement {
    const row = el('div', 'row-top');
    append(
        row,
        article.read === 0 ? dot() : null,
        popular ? popSpan() : null,
        openButton(article, 'title title-open', onOpen),
        derankButton(article),
        starButton(article, onStar),
    );
    return row;
}

function detailMeta(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    link: string | undefined,
    highlight?: RowHighlightRenderState,
): HTMLElement {
    const meta = el('div', 'meta');
    const minutes = readMinutes(article.content, article.summary);
    const children: Array<Node | null> = [
        showFeed ? feedLabel(feedTitle) : null,
        el('span', 'meta-domain', domainOf(article.link)),
        el('span', 'meta-date', formatDate(article.published)),
        minutes > 0 ? el('span', 'meta-time', `${minutes} min read`) : null,
        article.author ? el('span', 'meta-author', `by ${article.author}`) : null,
        highlightToggle(minutes, highlight),
        link ? origLink(link) : null,
    ];
    append(meta, ...children);
    return meta;
}

export function detailRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    feedIcon: string | undefined,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
    highlight?: RowHighlightRenderState,
): HTMLElement {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const image = articleImage(article, feedIcon);
    const body = el('div', 'detail-body');
    const media = detailMedia(video, image, article, link);
    if (media) body.appendChild(media);
    const text = el('div', 'detail-text');
    append(text, detailTitleRow(article, popular, onStar, onOpen));
    append(text, detailMeta(article, showFeed, feedTitle, link, highlight));
    if (article.summary) text.appendChild(el('div', 'summary', article.summary));
    if (highlight?.open) text.appendChild(renderRowHighlights(highlight));
    body.appendChild(text);
    return body;
}

export function headlineRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
    onOpen: (e: MouseEvent, article: Article) => void,
    highlight?: RowHighlightRenderState,
): DocumentFragment {
    const popular = article.popularity >= 4;
    const minutes = readMinutes(article.content, article.summary);
    const row = el('div', 'row-top');
    append(
        row,
        article.read === 0 ? dot() : null,
        popular ? popSpan() : null,
        showFeed ? feedLabel(feedTitle) : null,
        openButton(article, 'title title-open', onOpen),
        highlightToggle(minutes, highlight),
        el('span', 'headline-date', `${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}`),
        derankButton(article),
        starButton(article, onStar),
    );
    return rowFragment(row, highlight?.open ? renderRowHighlights(highlight) : null);
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
): HTMLElement {
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const image = video ? undefined : articleImage(article, feedIcon);
    const card = el(
        'article',
        `grid-card ${article.read ? 'read' : ''} ${selected ? 'selected' : ''} ${picked ? 'picked' : ''}`,
    );
    // pointer-only: the cover opens the article; shift+click on the card extends the selection;
    // keyboard and screen-reader users use the title button below.
    card.addEventListener('click', (e: MouseEvent) => {
        if (e.shiftKey) onOpen(e, article);
    });
    const media = el('div', 'grid-card-media');
    media.addEventListener('click', (e: MouseEvent) => {
        if (!e.shiftKey) onOpen(e, article);
    });
    if (video) {
        const header = document.createElement('video-header');
        header.className = 'grid-card-img';
        (header as unknown as { video: typeof video }).video = video;
        (header as unknown as { videoTitle: string }).videoTitle = article.title;
        (header as unknown as { videoLink: string | undefined }).videoLink = watchUrlFor(video, link);
        media.appendChild(header);
    } else if (image) {
        const lazy = document.createElement('lazy-img');
        lazy.className = 'grid-card-img';
        (lazy as unknown as { src: string }).src = image;
        media.appendChild(lazy);
    } else {
        const empty = el('div', 'grid-card-img grid-card-img-empty');
        empty.setAttribute('style', cardPlaceholderStyle(article));
        media.appendChild(empty);
    }
    card.appendChild(media);
    const body = el('div', 'grid-card-body');
    const titleRow = el('div', 'grid-card-title-row');
    append(titleRow, article.read === 0 ? dot() : null);
    titleRow.appendChild(openButton(article, 'grid-card-title title-open', onOpen));
    titleRow.appendChild(derankButton(article));
    titleRow.appendChild(starButton(article, onStar));
    body.appendChild(titleRow);
    if (article.summary) body.appendChild(el('div', 'grid-card-summary', article.summary));
    const minutes = readMinutes(article.content, article.summary);
    const meta = el('div', 'meta');
    append(
        meta,
        showFeed ? feedLabel(feedTitle) : null,
        el('span', 'meta-domain', domainOf(article.link)),
        el('span', 'meta-date', `${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}`),
        link ? origLink(link) : null,
    );
    body.appendChild(meta);
    card.appendChild(body);
    return card;
}

export function renderToolbar(host: ArticleListRenderHost): HTMLElement {
    const toolbar = el('div', 'toolbar');
    toolbar.appendChild(el('h2', undefined, host.viewTitle()));
    const actions = el('div', 'actions');
    const freshness = renderFreshness(host);
    if (freshness) actions.appendChild(freshness);
    actions.appendChild(
        labeledSelect(
            'sort',
            'Sort articles',
            host.sort,
            [
                ['hot', 'Hot'],
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],
            ] as Array<[string, string]>,
            (e) => {
                host.sort = (e.target as HTMLSelectElement).value as ArticleSort;
                host.saveViewSettings();
            },
        ),
    );
    actions.appendChild(
        labeledSelect(
            'view-mode',
            'List view',
            host.listView,
            [
                ['detailed', 'Detailed List'],
                ['headline', 'Headline View'],
                ['cards', 'Cards'],
                ['slideshow', 'Slideshow'],
            ] as Array<[string, string]>,
            (e) => {
                host.listView = (e.target as HTMLSelectElement).value as ListViewType;
                host.saveViewSettings();
            },
        ),
    );
    if (host.listView === 'cards') {
        const select = labeledSelect(
            'view-mode',
            null,
            host.maxCardCols,
            [
                ['2', '2 cols'],
                ['3', '3 cols'],
                ['4', '4 cols'],
                ['5', '5 cols'],
                ['6', '6 cols'],
            ] as Array<[string, string]>,
            (e) => {
                host.maxCardCols = Number((e.target as HTMLSelectElement).value);
                host.saveViewSettings();
                host.updateCols();
            },
        );
        select.title = 'Maximum card columns';
        actions.appendChild(select);
    }
    const pageSize = labeledSelect(
        'page-size',
        null,
        host.pageSize,
        [
            ['5', '5'],
            ['10', '10'],
            ['20', '20'],
            ['50', '50'],
            ['100', '100'],
            ['500', '500'],
        ] as Array<[string, string]>,
        (e) => {
            host.pageSize = Number((e.target as HTMLSelectElement).value);
            host.saveViewSettings();
        },
    );
    pageSize.title = 'Articles shown at a time';
    actions.appendChild(pageSize);
    actions.appendChild(actionButton('btn', 'Mark shown as read', host.onMarkShownRead.bind(host)));
    actions.appendChild(actionButton('btn', 'Catch me up (5 min)', host.onCatchMeUp.bind(host)));
    actions.appendChild(actionButton('btn', 'Advanced', host.onToggleAdvanced.bind(host)));
    const refresh = el('button', 'btn refresh');
    if (host.refreshing) {
        const spinner = el('span', 'spinner');
        spinner.setAttribute('aria-hidden', 'true');
        refresh.appendChild(spinner);
        refresh.appendChild(document.createTextNode('Refreshing…'));
    } else {
        refresh.textContent = 'Refresh';
    }
    refresh.addEventListener('click', host.onRefresh.bind(host));
    actions.appendChild(refresh);
    toolbar.appendChild(actions);
    return toolbar;
}

function actionButton(className: string, text: string, onClick: EventListener): HTMLButtonElement {
    const button = el('button', className, text);
    button.addEventListener('click', onClick);
    return button;
}

function labeledSelect(
    className: string,
    ariaLabel: string | null,
    value: string | number,
    options: Array<[string, string]>,
    onChange: (e: Event) => void,
): HTMLElement {
    const label = el('label', className);
    const select = document.createElement('select');
    if (ariaLabel !== null) select.setAttribute('aria-label', ariaLabel);
    for (const [val, text] of options) {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = text;
        select.appendChild(option);
    }
    select.value = String(value);
    select.addEventListener('change', onChange);
    label.appendChild(select);
    return label;
}

/** "Updated 2m ago" — empty until a feed reports a fetch. */
function renderFreshness(host: ArticleListRenderHost): HTMLElement | null {
    const label = host.freshnessLabel();
    if (!label) return null;
    return el('span', 'freshness', label);
}

export function renderInterestingHint(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.interestingActive()) return null;
    const strictness = host.interestingStrictness ?? 50;
    const words = topWords(interestingWordMapOf(host.items), 3);
    const hint = !words.length
        ? 'Star articles to teach this filter.'
        : `✨ ${words.map((w) => `${w.word} · ${w.score}`).join(', ')} · showing ${host.items.length}`;
    const bar = el('div', 'interesting-bar');
    const label = el('label', 'interesting-selectivity');
    label.appendChild(el('span', undefined, 'Selectivity'));
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.step = '5';
    range.value = String(strictness);
    range.setAttribute('aria-label', 'Interesting selectivity');
    range.title = 'Higher hides more; lower shows more';
    range.addEventListener('change', host.onInterestingStrictness.bind(host));
    label.appendChild(range);
    bar.appendChild(label);
    const text = el('div', 'interesting-hint', hint);
    text.title = 'Top learned words';
    bar.appendChild(text);
    return bar;
}

export function renderAdvancedMenu(host: ArticleListRenderHost): HTMLElement {
    const menu = document.createElement('advanced-menu');
    (menu as unknown as { open: boolean }).open = host.advancedOpen;
    (menu as unknown as { anchor: MenuAnchor | null }).anchor = host.advancedAnchor;
    (menu as unknown as { unreadOnly: boolean }).unreadOnly = host.unreadOnly;
    (menu as unknown as { markOnScroll: boolean }).markOnScroll = host.markOnScroll;
    (menu as unknown as { marking: boolean }).marking = host.marking;
    (menu as unknown as { scopeLabel: string }).scopeLabel = host.scopeLabel();
    menu.addEventListener('unread-change', host.onAdvancedUnread.bind(host));
    menu.addEventListener('mark-scroll-change', host.onAdvancedMarkScroll.bind(host));
    menu.addEventListener('mark-before', host.onMarkBefore.bind(host));
    menu.addEventListener('close', () => {
        host.advancedOpen = false;
    });
    return menu;
}

/** Last page-load failure, rendered as a banner rather than an empty list. */
export function renderLoadError(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.loadError) return null;
    const banner = el('div', 'load-error');
    banner.setAttribute('role', 'alert');
    banner.appendChild(document.createTextNode(host.loadError));
    banner.appendChild(document.createTextNode(' '));
    banner.appendChild(actionButton('btn', 'Retry', host.onRetryArticles.bind(host)));
    return banner;
}

/** Fill the stable scroll container. The element itself is created once by the component. */
export function renderScroll(
    host: ArticleListRenderHost,
    virtualItems: VirtualItems,
    showFeed: boolean,
    scrollEl: HTMLDivElement,
): void {
    scrollEl.style.setProperty('--cols', String(host.cols));
    const viewport = el('div', 'viewport');
    viewport.style.height = `${host.virtualizer?.getTotalSize() ?? 0}px`;
    append(viewport, ...renderVirtualRows(host, virtualItems, showFeed));
    append(scrollEl, viewport, ...renderScrollFooter(host));
}

function renderVirtualRows(
    host: ArticleListRenderHost,
    virtualItems: VirtualItems,
    showFeed: boolean,
): Array<Node | null> {
    if (host.listView === 'cards') return virtualItems.map((vi) => renderCardVirtualRow(host, vi, showFeed));
    return virtualItems.map((vi) => renderListVirtualRow(host, vi, showFeed));
}

function renderCardVirtualRow(
    host: ArticleListRenderHost,
    vi: { index: number; start: number },
    showFeed: boolean,
): HTMLElement | null {
    const start = vi.index * host.cols;
    const rowItems = host.items.slice(start, start + host.cols);
    if (!rowItems.length) return null;
    const row = el('div', 'row cards');
    row.setAttribute('data-row', String(vi.index));
    row.style.transform = `translateY(${vi.start}px)`;
    for (let c = 0; c < rowItems.length; c += 1) {
        const article = rowItems[c];
        if (article) row.appendChild(renderCardRow(host, article, showFeed, start + c));
    }
    return row;
}

export function renderSelectionBar(host: ArticleListRenderHost): HTMLElement | null {
    if (!host.selectedIds.length) return null;
    const bar = el('div', 'selection-bar');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Bulk actions');
    bar.appendChild(el('span', 'selection-count', `${host.selectedIds.length} selected`));
    bar.appendChild(actionButton('btn', 'Mark read', host.onBulkMarkRead.bind(host)));
    bar.appendChild(actionButton('btn', 'Star', host.onBulkStar.bind(host)));
    bar.appendChild(actionButton('btn', 'Not interesting', host.onBulkDerank.bind(host)));
    bar.appendChild(actionButton('btn', 'Clear', host.clearSelection.bind(host)));
    return bar;
}

function renderListVirtualRow(
    host: ArticleListRenderHost,
    vi: { index: number; start: number },
    showFeed: boolean,
): HTMLElement | null {
    const article = host.items[vi.index];
    if (!article) return null;
    const picked = host.selectedIds.includes(article.id);
    // pointer-only: the row body opens the article on pointer; keyboard users open it
    // with the title button. Shift+click selects a range.
    const row = el(
        'div',
        `row ${host.listView === 'headline' ? 'headline' : ''} ${article.read ? 'read' : ''} ${
            vi.index === host.cursor ? 'selected' : ''
        } ${picked ? 'picked' : ''}`,
    );
    row.setAttribute('data-index', String(vi.index));
    row.style.transform = `translateY(${vi.start}px)`;
    row.addEventListener('click', (e: MouseEvent) => host.onRowClick(e, vi.index));
    const content =
        host.listView === 'headline'
            ? renderHeadlineRow(host, article, showFeed, vi.index)
            : renderRow(host, article, showFeed, vi.index);
    append(row, content);
    return row;
}

function renderScrollFooter(host: ArticleListRenderHost): Array<Node | null> {
    const undo = host.mutedHidden > 0 && host.canUndoMute();
    const mutedNote =
        !host.loading && host.mutedHidden > 0
            ? el(
                  'p',
                  'empty-note',
                  `${host.mutedHidden} article${host.mutedHidden === 1 ? '' : 's'} hidden by mute filters.`,
              )
            : null;
    const undoBtn =
        !host.loading && undo
            ? (() => {
                  const p = el('p', 'empty-note');
                  p.appendChild(actionButton('btn', 'Undo mute change', () => host.onUndoMute()));
                  return p;
              })()
            : null;
    const nodes: Array<Node | null> = [];
    if (host.loading) nodes.push(el('div', 'end', 'Loading…'));
    if (!host.loading && host.items.length) {
        const markEnd = el('div', 'mark-end');
        const markBtn = el('button', 'mark-end-btn', 'Mark shown as read');
        markBtn.disabled = !host.items.some((a) => a.read === 0);
        markBtn.addEventListener('click', host.onMarkShownRead.bind(host));
        markEnd.appendChild(markBtn);
        nodes.push(markEnd);
    }
    if (!host.loading && !host.items.length) {
        const empty = el('div', 'empty');
        empty.appendChild(el('p', undefined, emptyText(host)));
        append(empty, mutedNote, undoBtn);
        nodes.push(empty);
    }
    if (host.library.error && host.view.kind !== 'feed') {
        const empty = el('div', 'empty');
        empty.appendChild(document.createTextNode('Could not load your feeds. '));
        empty.appendChild(actionButton('btn', 'Retry', host.onRetryLibrary.bind(host)));
        nodes.push(empty);
    }
    return nodes;
}

function emptyText(host: ArticleListRenderHost): string {
    if (!host.interestingActive())
        return emptyTextFor(host.unreadOnly, host.hideRead, false, false, host.mutedHidden, host.canUndoMute());
    if (host.unreadOnly || host.hideRead)
        return emptyTextFor(host.unreadOnly, host.hideRead, true, false, host.mutedHidden, host.canUndoMute());
    const learned = Object.keys(interestingWordMapOf(host.items)).length > 0;
    return emptyTextFor(false, false, true, learned, host.mutedHidden, host.canUndoMute());
}

/**
 * Pure empty-state copy so the two unread filters cannot be confused: the
 * "just marked as read" case names itself instead of blaming "Unread only".
 */
export function emptyTextFor(
    unreadOnly: boolean,
    hideRead: boolean,
    interesting: boolean,
    hasSignal = false,
    mutedHidden = 0,
    canUndoMute = false,
): string {
    if (mutedHidden > 0 && canUndoMute) {
        return interesting
            ? 'All matching articles are hidden by your latest mute filter.'
            : 'All articles in this view are hidden by your latest mute filter.';
    }
    if (hideRead && !unreadOnly) return 'Nothing unread here — the shown articles were just marked as read.';
    if (unreadOnly || hideRead) return 'Nothing unread here — "Unread only" is filtering this view.';
    if (interesting && hasSignal) return 'Nothing meets this selectivity — lower it to see more.';
    if (interesting) return 'Nothing here yet. Star articles to teach this view what you like.';
    if (mutedHidden > 0) return 'No articles to show here.';
    return 'No articles yet. Hit Refresh to sync this view.';
}

function renderRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return detailRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        host.feedIcon(article.feedId),
        (e, a) => void host.onStar(e, a),
        (e) => host.onRowClick(e, index),
        highlightArgs(host, article.id),
    );
}

function renderHeadlineRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return headlineRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        (e, a) => void host.onStar(e, a),
        (e) => host.onRowClick(e, index),
        highlightArgs(host, article.id),
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
