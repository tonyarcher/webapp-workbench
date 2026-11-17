import { html } from 'lit';
import { domainOf, formatDate } from '../../util';
import type { Article, SavedArticleSnapshot } from '../../types';

export interface SavedViewRenderHost {
    items: SavedArticleSnapshot[];
    error: boolean;
    storageEstimate: { usage: number; quota: number } | null;
    open(item: SavedArticleSnapshot): void;
    remove(item: SavedArticleSnapshot): void;
    exportNotes(): void;
    toArticle(item: SavedArticleSnapshot): Article;
}

export function renderSavedView(host: SavedViewRenderHost) {
    const items = host.items;
    return html`
        <div class="view">
            <div class="toolbar">
                <h2>Saved for later</h2>
                <span class="meta">${items.length} item${items.length === 1 ? '' : 's'}</span>
                ${host.storageEstimate ? html`<span class="storage">${(host.storageEstimate.usage / 1024 / 1024).toFixed(1)} MB used</span>` : ''}
                <button class="btn" @click=${() => host.exportNotes()}>Export to markdown</button>
            </div>
            <div class="body" tabindex="0">
                ${host.error ? html`<div class="empty error">Could not load saved articles.</div>` : ''}
                ${!items.length && !host.error ? html`<div class="empty">No saved articles yet. Use “Save for later” while reading an article.</div>` : ''}
                ${items.length ? html`<ul class="list">${items.map((s) => renderItem(host, s))}</ul>` : ''}
            </div>
        </div>
    `;
}

function renderItem(host: SavedViewRenderHost, s: SavedArticleSnapshot) {
    const article = host.toArticle(s);
    return html`
        <li class="row">
            <button class="open" @click=${() => host.open(s)}>
                <span class="title">${s.title}</span>
                <span class="meta-line">
                    ${s.feedTitle ? html`<span>${s.feedTitle}</span>` : html`<span>Saved article</span>`}
                    ${s.link ? html`<span>${domainOf(s.link)}</span>` : ''}
                    <span>${formatDate(article.published)}</span>
                </span>
                ${s.summary ? html`<span class="summary">${s.summary}</span>` : ''}
            </button>
            <button class="btn danger" @click=${() => host.remove(s)}>Remove</button>
        </li>
    `;
}
