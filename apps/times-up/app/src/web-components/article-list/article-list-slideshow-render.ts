import { noteOriginal, noteShare } from '../../mutations';
import { sanitizeHtml, safeHttpUrl } from '../../services/parser';
import { articleVideo } from '../../services/video';
import { domainOf, formatDate, readMinutes } from '../../util';
import { copyMarkdownCitation, copyQuoteCard, copyTitleLink } from '../article-view/article-view-helpers';
import { canNativeShare, mailtoShareUrl, shareUrl } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import type { Article } from '../../types';
import { append, appendSanitized, el, svgIcon } from './article-list-dom';
import '../video-header/video-header';
import {
    clearSlideshowAuto,
    currentSlideshowArticle,
    openSlideshowOriginal,
    scheduleSlideshowAuto,
    slideshowNext,
    slideshowPrev,
    toggleSlideshowRead,
    toggleSlideshowSave,
    toggleSlideshowStar,
} from './article-list-slideshow';

export interface SlideshowRenderHost {
    items: Article[];
    slideshowIndex: number;
    slideshowAutoAdvance: boolean;
    slideshowSavedIds: Set<string>;
    loading: boolean;
}

export interface SlideshowRenderActions {
    next(): void;
    prev(): void;
    toggleAutoAdvance(): void;
    toggleStar(): void;
    toggleRead(): void;
    toggleSave(): void;
    openOriginal(): void;
    exit(): void;
}

/** Inline glyphs, built in the SVG namespace from the same literals the other views use. */
function icon(
    name: 'facebook' | 'x' | 'mastodon' | 'instagram' | 'more' | 'copy' | 'markdown' | 'quote' | 'mail',
): SVGElement {
    switch (name) {
        case 'facebook':
            return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
                [
                    'path',
                    {
                        fill: 'currentColor',
                        d: 'M13.5 21.5v-7.2h2.5l.4-2.8h-2.9V9.7c0-.8.3-1.4 1.5-1.4h1.5V5.8c-.3 0-1.2-.1-2.2-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2v2.8h2.5v7.2h2.8z',
                    },
                ],
            ]);
        case 'x':
            return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
                [
                    'path',
                    {
                        fill: 'currentColor',
                        d: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z',
                    },
                ],
            ]);
        case 'mastodon':
            return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
                [
                    'path',
                    {
                        fill: 'currentColor',
                        d: 'M12 2.5c-3.9 0-6.8 2.4-6.8 5.8v4.3c0 2.9 1.9 5.2 4.6 5.2.5 0 1-.1 1.4-.2l.8 2.4.8-2.4c.4.1.9.2 1.4.2 2.7 0 4.6-2.3 4.6-5.2V8.3c0-3.4-2.9-5.8-6.8-5.8zM9.3 15.6c-.4-.9-.6-1.9-.6-2.9h1.5c0 .8.2 1.6.5 2.3l-1.4.6zm5.4 0l-1.4-.6c.3-.7.5-1.5.5-2.3h1.5c0 1-.2 2-.6 2.9z',
                    },
                ],
            ]);
        case 'instagram':
            return svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                },
                [
                    ['rect', { x: '3.5', y: '3.5', width: '17', height: '17', rx: '5' }],
                    ['circle', { cx: '12', cy: '12', r: '3.8' }],
                    ['circle', { cx: '17', cy: '7', r: '1.2', fill: 'currentColor', stroke: 'none' }],
                ],
            );
        case 'more':
            return svgIcon({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
                ['circle', { cx: '6', cy: '12', r: '1.8', fill: 'currentColor' }],
                ['circle', { cx: '12', cy: '12', r: '1.8', fill: 'currentColor' }],
                ['circle', { cx: '18', cy: '12', r: '1.8', fill: 'currentColor' }],
            ]);
        case 'copy':
            return svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    ['rect', { x: '9', y: '9', width: '10', height: '11', rx: '2' }],
                    ['path', { d: 'M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1' }],
                ],
            );
        case 'markdown':
            return svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    ['rect', { x: '3.5', y: '5', width: '17', height: '14', rx: '2' }],
                    ['path', { d: 'M7 15V9l2.5 3L12 9v6' }],
                    ['path', { d: 'M16 9v6m0 0l-2-2m2 2l2-2' }],
                ],
            );
        case 'quote':
            return svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    ['rect', { x: '3.5', y: '4.5', width: '17', height: '15', rx: '2' }],
                    ['path', { d: 'M7.5 14h3l-1 2M13.5 14h3l-1 2' }],
                ],
            );
        case 'mail':
            return svgIcon(
                {
                    viewBox: '0 0 24 24',
                    'aria-hidden': 'true',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [
                    ['rect', { x: '3.5', y: '5.5', width: '17', height: '13', rx: '2' }],
                    ['path', { d: 'M4 7l8 6 8-6' }],
                ],
            );
    }
}

function iconButton(label: string, glyph: SVGElement, onClick: EventListener): HTMLButtonElement {
    const button = el('button', 'btn icon-btn');
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(glyph);
    button.addEventListener('click', onClick);
    return button;
}

function shareButtons(a: Article, link: string): HTMLElement {
    const group = el('div', 'slideshow-share-group');
    const open = (target: 'facebook' | 'x' | 'mastodon') => (e: Event) => {
        e.stopPropagation();
        const href = shareUrl(target, link, a.title, loadMastodonHost());
        if (href) {
            noteShare(a.id, a.title);
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };
    const labels: Record<string, string> = {
        facebook: 'Share on Facebook',
        x: 'Share on X',
        mastodon: 'Share on Mastodon',
        instagram: 'Copy link for Instagram',
    };
    for (const target of loadShareTargets()) {
        const key = target as string;
        const label = labels[key];
        if (label === undefined) continue;
        if (target === 'instagram') {
            group.appendChild(
                iconButton(label, icon('instagram'), () => {
                    void (async () => {
                        try {
                            await navigator.clipboard.writeText(link);
                            noteShare(a.id, a.title);
                        } catch {
                            /* ignore */
                        }
                    })();
                }),
            );
        } else {
            group.appendChild(iconButton(label, icon(target), open(target)));
        }
    }
    if (canNativeShare()) {
        group.appendChild(
            iconButton('Share', icon('more'), () => {
                void (async () => {
                    try {
                        await navigator.share({ title: a.title, url: link });
                        noteShare(a.id, a.title);
                    } catch {
                        /* dismissed */
                    }
                })();
            }),
        );
    }
    group.appendChild(iconButton('Copy link', icon('copy'), () => void copyTitleLink(a, link)));
    group.appendChild(iconButton('Copy markdown citation', icon('markdown'), () => void copyMarkdownCitation(a, link)));
    group.appendChild(iconButton('Copy quote card', icon('quote'), () => void copyQuoteCard(a, link)));
    const mail = document.createElement('a');
    mail.className = 'btn icon-btn';
    mail.href = mailtoShareUrl(link, a.title);
    mail.setAttribute('aria-label', 'Email');
    mail.title = 'Email';
    mail.appendChild(icon('mail'));
    mail.addEventListener('click', () => noteShare(a.id, a.title));
    group.appendChild(mail);
    return group;
}

export function renderSlideshow(host: SlideshowRenderHost, actions: SlideshowRenderActions): HTMLElement {
    const article = host.items[host.slideshowIndex];
    if (!article) {
        const empty = el('div', 'slideshow-empty');
        empty.appendChild(el('p', undefined, host.loading ? 'Loading…' : 'No articles in this view.'));
        return empty;
    }
    const total = host.items.length;
    const pos = host.slideshowIndex + 1;
    const progressPct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const minutes = readMinutes(article.content, article.summary);
    const saved = host.slideshowSavedIds.has(article.id);

    const root = el('div', 'slideshow');
    root.setAttribute('aria-label', 'Slideshow view');
    const head = el('div', 'slideshow-head');

    const progressRow = el('div', 'slideshow-progress-row');
    progressRow.appendChild(el('span', 'slideshow-pos', `${pos} / ${total}`));
    const progress = el('div', 'slideshow-progress');
    progress.setAttribute('aria-hidden', 'true');
    const progressFill = document.createElement('span');
    progressFill.style.width = `${progressPct}%`;
    progress.appendChild(progressFill);
    progressRow.appendChild(progress);
    const autoLabel = el('label', 'slideshow-auto');
    const auto = document.createElement('input');
    auto.type = 'checkbox';
    auto.checked = host.slideshowAutoAdvance;
    auto.addEventListener('change', actions.toggleAutoAdvance);
    autoLabel.appendChild(auto);
    autoLabel.appendChild(document.createTextNode(' Auto-next'));
    progressRow.appendChild(autoLabel);
    progressRow.appendChild(actionButton('btn', 'Exit slideshow', actions.exit));
    head.appendChild(progressRow);

    const actionsBar = el('div', 'slideshow-actions');
    actionsBar.setAttribute('role', 'toolbar');
    actionsBar.setAttribute('aria-label', 'Article actions');
    const prev = actionButton('btn', '← Prev', actions.prev);
    prev.disabled = host.slideshowIndex <= 0;
    const next = actionButton('btn', 'Next →', actions.next);
    next.disabled = host.slideshowIndex >= total - 1 && !host.loading;
    actionsBar.appendChild(prev);
    actionsBar.appendChild(next);
    actionsBar.appendChild(
        actionButton(
            article.starred ? 'btn starred' : 'btn',
            article.starred ? '★ Unstar' : '☆ Star',
            actions.toggleStar,
        ),
    );
    actionsBar.appendChild(actionButton('btn', article.read ? 'Keep unread' : 'Mark read', actions.toggleRead));
    const save = actionButton('btn', saved ? '🔖 Saved' : '🔖 Save for later', actions.toggleSave);
    save.setAttribute('aria-pressed', String(saved));
    actionsBar.appendChild(save);
    if (link) {
        const original = document.createElement('a');
        original.className = 'btn primary';
        original.href = link;
        original.target = '_blank';
        original.rel = 'noopener noreferrer';
        original.textContent = 'Open original ↗';
        original.addEventListener('click', () => noteOriginal(article.id, article.title));
        actionsBar.appendChild(original);
    }
    head.appendChild(actionsBar);
    if (link) {
        const share = el('div', 'slideshow-share');
        share.appendChild(shareButtons(article, link));
        head.appendChild(share);
    }
    root.appendChild(head);

    const body = el('div', 'slideshow-body');
    const articleEl = document.createElement('article');
    articleEl.className = 'slideshow-article';
    const h1 = document.createElement('h1');
    if (link) {
        const titleLink = document.createElement('a');
        titleLink.href = link;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.textContent = article.title;
        titleLink.addEventListener('click', () => noteOriginal(article.id, article.title));
        h1.appendChild(titleLink);
    } else {
        h1.textContent = article.title;
    }
    articleEl.appendChild(h1);
    const meta = el('div', 'slideshow-meta');
    append(
        meta,
        el('span', undefined, domainOf(article.link) || 'unknown source'),
        el('span', undefined, formatDate(article.published)),
        article.author ? el('span', undefined, `by ${article.author}`) : null,
        minutes > 0 ? el('span', undefined, `${minutes} min read`) : null,
    );
    articleEl.appendChild(meta);
    if (video) {
        const header = document.createElement('video-header');
        header.className = 'slideshow-video';
        (header as unknown as { mode: string }).mode = 'embed';
        (header as unknown as { video: typeof video }).video = video;
        (header as unknown as { videoTitle: string }).videoTitle = article.title;
        articleEl.appendChild(header);
    }
    const sanitized = article.content ? sanitizeHtml(article.content) : '';
    if (sanitized) {
        const content = el('div', 'slideshow-content');
        appendSanitized(content, sanitized);
        articleEl.appendChild(content);
    } else if (article.summary) {
        articleEl.appendChild(el('div', 'slideshow-content', article.summary));
    } else {
        articleEl.appendChild(el('p', 'slideshow-content', 'No content available for this article.'));
    }
    body.appendChild(articleEl);
    root.appendChild(body);
    return root;
}

function actionButton(className: string, text: string, onClick: EventListener): HTMLButtonElement {
    const button = el('button', className, text);
    button.addEventListener('click', onClick);
    return button;
}

export function renderSlideshowSection(
    host: SlideshowRenderHost & { cursor: number; setListView(v: string): void },
): HTMLElement {
    return renderSlideshow(host, {
        next: () => slideshowNext(host as never),
        prev: () => slideshowPrev(host as never),
        toggleAutoAdvance: () => {
            host.slideshowAutoAdvance = !host.slideshowAutoAdvance;
            if (host.slideshowAutoAdvance) scheduleSlideshowAuto(host as never);
            else clearSlideshowAuto(host as never);
        },
        toggleStar: () => void toggleSlideshowStar(host as never),
        toggleRead: () => void toggleSlideshowRead(host as never),
        toggleSave: () => void toggleSlideshowSave(host as never),
        openOriginal: () => openSlideshowOriginal(currentSlideshowArticle(host as never)),
        exit: () => {
            host.cursor = host.slideshowIndex;
            host.setListView('detailed');
        },
    });
}
