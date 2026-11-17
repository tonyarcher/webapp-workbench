import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { fetchArticlesPage } from '../../services/api';
import { loadRowHighlights } from '../../services/highlights';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './backgrounder-view.css?inline';

@customElement('backgrounder-view')
export class BackgrounderView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private articles: Article[] = [];
    @state() private loading = true;
    @state() private highlights: Record<string, { excerpts: string[] }> = {};

    override connectedCallback() {
        super.connectedCallback();
        void this.load();
    }

    private async load() {
        this.loading = true;
        try {
            const page = await fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'hot', limit: 5 });
            this.articles = page.items;
            const hl: Record<string, { excerpts: string[] }> = {};
            await Promise.all(
                page.items.map(async (a) => {
                    try {
                        const r = await loadRowHighlights(a.id);
                        if (r && r.available && r.excerpts.length)
                            hl[a.id] = { excerpts: r.excerpts.map((e) => e.text) };
                    } catch {
                        // ignore
                    }
                }),
            );
            this.highlights = hl;
        } catch {
            this.articles = [];
        }
        this.loading = false;
    }

    override render() {
        return html`
            <div class="view">
                <div class="toolbar"><h2>Catch me up</h2><span class="meta">${this.articles.length} essential reads</span></div>
                <div class="body" tabindex="0">
                    ${this.loading ? html`<div class="empty">Loading…</div>` : ''}
                    ${!this.loading && !this.articles.length ? html`<div class="empty">Nothing to catch up on.</div>` : ''}
                    <ul class="list">
                        ${this.articles.map(
                            (a) => html`
                            <li class="row">
                                <h3>${a.title}</h3>
                                <span class="meta">${readMinutes(a.content, a.summary)} min read</span>
                                ${this.highlights[a.id]?.excerpts.map((x) => html`<blockquote>${x}</blockquote>`) ?? ''}
                            </li>
                        `,
                        )}
                    </ul>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'backgrounder-view': BackgrounderView;
    }
}
