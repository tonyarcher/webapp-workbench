import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { noteOriginal, noteShare } from '../../mutations';
import { sanitizeHtml, safeHttpUrl } from '../../services/parser';
import { articleVideo } from '../../services/video';
import { domainOf, formatDate, readMinutes } from '../../util';
import { copyTitleLink, shareIcon } from '../article-view/article-view-helpers';
import { canNativeShare, mailtoShareUrl, shareUrl } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import type { Article } from '../../types';
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

function shareButtons(a: Article, link: string) {
    const open = (target: 'facebook' | 'x' | 'mastodon') => (e: Event) => {
        e.stopPropagation();
        const href = shareUrl(target, link, a.title, loadMastodonHost());
        if (href) {
            noteShare(a.id, a.title);
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };
    const buttons: Record<string, unknown> = {
        facebook: html`<button class="btn share-btn" @click=${open('facebook')}>${shareIcon('facebook')}Facebook</button>`,
        x: html`<button class="btn share-btn" @click=${open('x')}>${shareIcon('x')}X</button>`,
        mastodon: html`<button class="btn share-btn" @click=${open('mastodon')}>${shareIcon('mastodon')}Mastodon</button>`,
        instagram: html`<button class="btn share-btn" @click=${async () => {
            try {
                await navigator.clipboard.writeText(link);
                noteShare(a.id, a.title);
            } catch {
                /* ignore */
            }
        }}>${shareIcon('instagram')}Copy link</button>`,
    };
    return html`${loadShareTargets().map((t) => buttons[t])}${
        canNativeShare()
            ? html`<button class="btn share-btn" @click=${async () => {
                  try {
                      await navigator.share({ title: a.title, url: link });
                      noteShare(a.id, a.title);
                  } catch {
                      /* dismissed */
                  }
              }}>More…</button>`
            : ''
    }<button class="btn share-btn" @click=${() => void copyTitleLink(a, link)}>Copy</button><a class="btn share-btn" href=${mailtoShareUrl(link, a.title)} @click=${() => noteShare(a.id, a.title)}>Email</a>`;
}

export function renderSlideshow(host: SlideshowRenderHost, actions: SlideshowRenderActions) {
    const article = host.items[host.slideshowIndex];
    if (!article) {
        return html`<div class="slideshow-empty"><p>${host.loading ? 'Loading…' : 'No articles in this view.'}</p></div>`;
    }
    const total = host.items.length;
    const pos = host.slideshowIndex + 1;
    const progressPct = total > 0 ? Math.round((pos / total) * 100) : 0;
    const link = safeHttpUrl(article.link);
    const video = articleVideo(article);
    const body = article.content ? sanitizeHtml(article.content) : '';
    const minutes = readMinutes(article.content, article.summary);
    const saved = host.slideshowSavedIds.has(article.id);
    return html`
      <div class="slideshow" aria-label="Slideshow view">
        <div class="slideshow-head">
          <div class="slideshow-progress-row">
            <span class="slideshow-pos">${pos} / ${total}</span>
            <div class="slideshow-progress" aria-hidden="true"><span style="width:${progressPct}%"></span></div>
            <label class="slideshow-auto"><input type="checkbox" .checked=${host.slideshowAutoAdvance} @change=${actions.toggleAutoAdvance} /> Auto-next</label>
            <button class="btn" @click=${actions.exit}>Exit slideshow</button>
          </div>
          <div class="slideshow-actions" role="toolbar" aria-label="Article actions">
            <button class="btn" ?disabled=${host.slideshowIndex <= 0} @click=${actions.prev}>← Prev</button>
            <button class="btn" ?disabled=${host.slideshowIndex >= total - 1 && !host.loading} @click=${actions.next}>Next →</button>
            <button class="btn" @click=${actions.toggleStar}>${article.starred ? '★ Unstar' : '☆ Star'}</button>
            <button class="btn" @click=${actions.toggleRead}>${article.read ? 'Keep unread' : 'Mark read'}</button>
            <button class="btn" aria-pressed=${saved} @click=${actions.toggleSave}>${saved ? '🔖 Saved' : '🔖 Save for later'}</button>
            ${link ? html`<a class="btn primary" href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(article.id, article.title)}>Open original ↗</a>` : ''}
          </div>
          ${link ? html`<div class="slideshow-share">${shareButtons(article, link)}</div>` : ''}
        </div>
        <div class="slideshow-body">
          <article class="slideshow-article">
            <h1>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(article.id, article.title)}>${article.title}</a>` : article.title}</h1>
            <div class="slideshow-meta">
              <span>${domainOf(article.link) || 'unknown source'}</span>
              <span>${formatDate(article.published)}</span>
              ${article.author ? html`<span>by ${article.author}</span>` : ''}
              ${minutes > 0 ? html`<span>${minutes} min read</span>` : ''}
            </div>
            ${video ? html`<video-header class="slideshow-video" .mode=${'embed'} .video=${video} .videoTitle=${article.title}></video-header>` : ''}
            ${body ? html`<div class="slideshow-content">${unsafeHTML(body)}</div>` : article.summary ? html`<div class="slideshow-content">${article.summary}</div>` : html`<p class="slideshow-content">No content available for this article.</p>`}
          </article>
        </div>
      </div>
    `;
}

export function renderSlideshowSection(host: SlideshowRenderHost & { cursor: number; setListView(v: string): void }) {
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
