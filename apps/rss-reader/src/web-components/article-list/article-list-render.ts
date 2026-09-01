import {html} from 'lit';
import {safeHttpUrl} from '../../services/parser';
import {domainOf, formatDate} from '../../util';
import type {Article} from '../../types';

export function detailRowTemplate(
    article: Article,
    showFeed: boolean,
    feedTitle: string | undefined,
    onStar: (e: Event, article: Article) => void,
) {
    const popular = article.popularity >= 4;
    const link = safeHttpUrl(article.link);
    const image = safeHttpUrl(article.image);
    return html`
      <div class="detail-body">
        ${image ? html`<img class="detail-img" src=${image} alt="" loading="lazy" />` : ''}
        <div class="detail-text">
          <div class="row-top">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${popular ? html`<span class="pop" title="Trending in your feeds">🔥</span>` : ''}
            ${link ? html`<a class="title title-link" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>` : html`<span class="title">${article.title}</span>`}
            <button class="star" title="Star" @click=${(e: Event) => onStar(e, article)}>${article.starred ? '★' : '☆'}</button>
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
    return html`
      <div class="grid-card ${article.read ? 'read' : ''} ${selected ? 'selected' : ''}" role="button" tabindex="0" aria-label="Open ${article.title}" @click=${() => onOpen(article)} @keydown=${(e: KeyboardEvent) => onKey(e, article)}>
        ${article.image ? html`<lazy-img class="grid-card-img" .src=${article.image}></lazy-img>` : html`<div class="grid-card-img grid-card-img-empty"></div>`}
        <div class="grid-card-body">
          <div class="grid-card-title-row">
            ${article.read === 0 ? html`<span class="unread-dot"></span>` : ''}
            ${link ? html`<a class="grid-card-title" href=${link} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${article.title}</a>` : html`<span class="grid-card-title">${article.title}</span>`}
            <button class="star" title="Star" @click=${(e: Event) => onStar(e, article)}>${article.starred ? '★' : '☆'}</button>
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
