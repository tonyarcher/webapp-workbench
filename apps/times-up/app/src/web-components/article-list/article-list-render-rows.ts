import { anchorFromEvent } from '../menu-popover';
import { safeHttpUrl } from '../../services/parser';
import { articleImage, cardPlaceholderStyle } from '../../services/image';
import { articleVideo, watchUrlFor } from '../../services/video';
import { readMinutes, domainOf, formatDate } from '../../util';
import { isDeranked } from '../../services/interesting-settings';
import { contentQuality } from '../../services/content-quality';
import type { Article } from '../../types';
import { append, el, svgIcon } from './article-list-dom';
import {
    highlightArgs,
    highlightToggle,
    renderRowHighlights,
    rowFragment,
    type RowHighlightRenderState,
} from './article-list-render-highlights';
import { renderRowExcerpt } from './article-list-render-excerpts';
import type { ArticleListRenderHost } from './article-list-render';

const DERANK_ACTIVE = 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z';
const DERANK_SLASH = 'M4 4l16 16';
const BOOKMARK = 'M6 4h12v17l-6-4-6 4z';

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

function saveButton(article: Article, saved: boolean, onSave: (e: Event, article: Article) => void): HTMLButtonElement {
    const button = el('button', 'card-action');
    button.type = 'button';
    button.setAttribute('aria-label', 'Save for later');
    button.setAttribute('aria-pressed', String(saved));
    button.title = saved ? 'Saved for later' : 'Save for later';
    button.appendChild(
        svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, [
            [
                'path',
                {
                    fill: saved ? 'currentColor' : 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linejoin': 'round',
                    d: BOOKMARK,
                },
            ],
        ]),
    );
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        onSave(e, article);
    });
    return button;
}

/** White overlay controls that appear over the cover on hover or focus. */
function cardActions(
    article: Article,
    saved: boolean,
    onStar: (e: Event, article: Article) => void,
    onSave?: (e: Event, article: Article) => void,
): HTMLElement {
    const layer = el('div', 'card-actions');
    const star = starButton(article, onStar);
    star.className = 'card-action star';
    const derank = derankButton(article);
    derank.className = 'card-action';
    const more = el('button', 'card-action', '⋯');
    let cancelTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelPress = () => {
        if (cancelTimer !== null) clearTimeout(cancelTimer);
        cancelTimer = null;
        more.dispatchEvent(
            new CustomEvent('card-menu-pointercancel', {
                detail: { articleId: article.id },
                bubbles: true,
                composed: true,
            }),
        );
    };
    more.addEventListener('pointerdown', () => {
        if (cancelTimer !== null) clearTimeout(cancelTimer);
        cancelTimer = null;
        more.dispatchEvent(
            new CustomEvent('card-menu-pointerdown', {
                detail: { articleId: article.id },
                bubbles: true,
                composed: true,
            }),
        );
    });
    more.addEventListener('pointercancel', cancelPress);
    more.addEventListener('contextmenu', cancelPress);
    more.addEventListener('pointerleave', (e) => {
        if (e.buttons !== 0) cancelPress();
    });
    more.addEventListener('pointerup', () => {
        cancelTimer = setTimeout(cancelPress, 0);
    });
    more.setAttribute('aria-label', 'Manage feed folders');
    more.title = 'Manage feed folders';
    more.addEventListener('click', (e) => {
        if (cancelTimer !== null) clearTimeout(cancelTimer);
        cancelTimer = null;
        e.stopPropagation();
        more.dispatchEvent(
            new CustomEvent('open-feed-folders', {
                bubbles: true,
                composed: true,
                detail: { feedId: article.feedId, anchor: anchorFromEvent(e), articleId: article.id },
            }),
        );
    });
    layer.appendChild(derank);
    layer.appendChild(star);
    if (onSave) layer.appendChild(saveButton(article, saved, onSave));
    layer.appendChild(more);
    return layer;
}

/** Star toggle with its glyph hidden from the name computation. */
function starButton(article: Article, onStar: (e: Event, article: Article) => void): HTMLButtonElement {
    const button = el('button', 'star');
    button.setAttribute('aria-label', article.starred ? 'Unstar' : 'Star');
    button.setAttribute('aria-pressed', String(article.starred));
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

function qualityBadge(article: Article): HTMLElement | null {
    const quality = contentQuality(article);
    if (!quality) return null;
    const badge = el('span', `quality-badge quality-${quality.kind}`, quality.label);
    badge.title = `${quality.label}: this row may not be finishable.`;
    return badge;
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
        qualityBadge(article),
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
    excerpt?: string | null,
): HTMLElement {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const image = articleImage(article, feedIcon);
    const body = el('div', 'detail-body');
    body.dataset['articleId'] = article.id;
    const media = detailMedia(video, image, article, link);
    if (media) body.appendChild(media);
    const text = el('div', 'detail-text');
    append(text, detailTitleRow(article, popular, onStar, onOpen));
    append(text, detailMeta(article, showFeed, feedTitle, link, highlight));
    if (article.summary) text.appendChild(el('div', 'summary', article.summary));
    append(text, renderRowExcerpt(excerpt));
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
    row.dataset['articleId'] = article.id;
    append(
        row,
        article.read === 0 ? dot() : null,
        popular ? popSpan() : null,
        showFeed ? feedLabel(feedTitle) : null,
        openButton(article, 'title title-open', onOpen),
        highlightToggle(minutes, highlight),
        el('span', 'headline-date', `${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}`),
        qualityBadge(article),
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
    excerpt?: string | null,
    saved = false,
    onSave?: (e: Event, article: Article) => void,
): HTMLElement {
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const image = video ? undefined : articleImage(article, feedIcon);
    const card = el(
        'article',
        `grid-card ${article.read ? 'read' : ''} ${selected ? 'selected' : ''} ${picked ? 'picked' : ''}`,
    );
    card.dataset['articleId'] = article.id;
    card.addEventListener('click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        onOpen(e, article);
    });
    const media = el('div', 'grid-card-media');
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
    media.appendChild(cardActions(article, saved, onStar, onSave));
    card.appendChild(media);
    const body = el('div', 'grid-card-body');
    const titleRow = el('div', 'grid-card-title-row');
    append(titleRow, article.read === 0 ? dot() : null);
    titleRow.appendChild(openButton(article, 'grid-card-title title-open', onOpen));
    body.appendChild(titleRow);
    if (article.summary) body.appendChild(el('div', 'grid-card-summary', article.summary));
    append(body, renderRowExcerpt(excerpt));
    const minutes = readMinutes(article.content, article.summary);
    const meta = el('div', 'meta');
    append(
        meta,
        showFeed ? feedLabel(feedTitle) : null,
        el('span', 'meta-domain', domainOf(article.link)),
        el('span', 'meta-date', `${formatDate(article.published)}${minutes > 0 ? ` · ${minutes} min` : ''}`),
        qualityBadge(article),
        link ? origLink(link) : null,
    );
    body.appendChild(meta);
    card.appendChild(body);
    return card;
}

export function renderRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return detailRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        host.feedIcon(article.feedId),
        (e, a) => void host.onStar(e, a),
        (e) => host.onRowClick(e, index),
        highlightArgs(host, article.id),
        host.rowExcerpt(article.id),
    );
}

export function renderHeadlineRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
    return headlineRowTemplate(
        article,
        showFeed,
        host.feedTitle(article.feedId),
        (e, a) => void host.onStar(e, a),
        (e) => host.onRowClick(e, index),
        highlightArgs(host, article.id),
    );
}

export function renderCardRow(host: ArticleListRenderHost, article: Article, showFeed: boolean, index: number) {
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
        host.rowExcerpt(article.id),
        host.savedArticleIds.has(article.id),
        (_e, a) => {
            void host.onSaveArticle(a);
        },
    );
}
