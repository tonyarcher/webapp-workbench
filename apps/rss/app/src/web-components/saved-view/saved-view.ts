import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { fetchSavedArticlesList, savedArticlesKey, QueryController } from '../../query';
import { unsaveForLater } from '../../mutations';
import { domainOf, formatDate } from '../../util';
import type { Article, SavedArticleSnapshot } from '../../types';
import styles from './saved-view.css?inline';

function toArticle(s: SavedArticleSnapshot): Article {
    return {
        id: s.articleId ?? s.id,
        feedId: s.feedId ?? 'saved',
        guid: s.articleId ?? s.id,
        title: s.title,
        link: s.link,
        author: s.author,
        summary: s.summary,
        content: s.content,
        published: s.published ?? s.savedAt,
        fetchedAt: s.savedAt,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
    };
}

@customElement('saved-view')
export class SavedView extends LitElement {
    static override styles = unsafeCSS(styles);

    private saved = new QueryController<SavedArticleSnapshot[]>(this, () => ({
        queryKey: savedArticlesKey,
        queryFn: () => fetchSavedArticlesList(),
        refetchInterval: 60_000,
    }));

    override render() {
        const items = this.saved.data ?? [];
        return html`
            <div class="view">
                <div class="toolbar"><h2>Saved for later</h2><span class="meta">${items.length} item${items.length === 1 ? '' : 's'}</span></div>
                <div class="body" tabindex="0">
                    ${this.saved.error ? html`<div class="empty error">Could not load saved articles.</div>` : ''}
                    ${!items.length && !this.saved.error ? html`<div class="empty">No saved articles yet. Use “Save for later” while reading an article.</div>` : ''}
                    ${items.length ? html`<ul class="list">${items.map((s) => this.renderItem(s))}</ul>` : ''}
                </div>
            </div>
        `;
    }

    private renderItem(s: SavedArticleSnapshot) {
        const article = toArticle(s);
        return html`
            <li class="row">
                <button class="open" @click=${() => this.open(s)}>
                    <span class="title">${s.title}</span>
                    <span class="meta-line">
                        ${s.feedTitle ? html`<span>${s.feedTitle}</span>` : html`<span>Saved article</span>`}
                        ${s.link ? html`<span>${domainOf(s.link)}</span>` : ''}
                        <span>${formatDate(article.published)}</span>
                    </span>
                    ${s.summary ? html`<span class="summary">${s.summary}</span>` : ''}
                </button>
                <button class="btn danger" @click=${() => this.removeSaved(s)}>Remove</button>
            </li>
        `;
    }

    private open(s: SavedArticleSnapshot) {
        const article = toArticle(s);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index: 0, items: [article] },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private removeSaved(s: SavedArticleSnapshot) {
        if (!s.articleId) return;
        // unsaveForLater resolves (it toasts on failure), so the handler stays
        // synchronous and no floating promise escapes the click event.
        void unsaveForLater(s.articleId);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'saved-view': SavedView;
    }
}
