import { fetchArticlesPage } from '../../services/api';
import { loadRowHighlights } from '../../services/highlights';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './backgrounder-view.css?inline';

export class BackgrounderView extends HTMLElement {
    private articles: Article[] = [];
    private loading = true;
    private highlights: Record<string, string[]> = {};
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        void this.load();
    }

    private async load() {
        this.loading = true;
        this.paint();
        try {
            const page = await fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'hot', limit: 5 });
            this.articles = page.items;
            const hl: Record<string, string[]> = {};
            await Promise.all(
                page.items.map(async (a) => {
                    try {
                        const r = await loadRowHighlights(a.id);
                        if (r && r.available && r.excerpts.length) hl[a.id] = r.excerpts.map((e) => e.text);
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
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Catch me up';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.articles.length} essential reads`;
        toolbar.appendChild(h);
        toolbar.appendChild(meta);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (this.loading) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Loading…';
            body.appendChild(empty);
        } else if (!this.articles.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Nothing to catch up on.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const a of this.articles) {
                const li = document.createElement('li');
                li.className = 'row';
                const title = document.createElement('h3');
                title.textContent = a.title;
                li.appendChild(title);
                const meta = document.createElement('span');
                meta.className = 'meta';
                meta.textContent = `${readMinutes(a.content, a.summary)} min read`;
                li.appendChild(meta);
                const excerpts = this.highlights[a.id];
                if (excerpts) {
                    for (const x of excerpts) {
                        const bq = document.createElement('blockquote');
                        bq.textContent = x;
                        li.appendChild(bq);
                    }
                }
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('backgrounder-view', BackgrounderView);
