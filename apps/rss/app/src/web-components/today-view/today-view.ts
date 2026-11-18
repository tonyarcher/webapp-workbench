import { fetchArticlesPage } from '../../services/api';
import { domainOf, formatDate, readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './today-view.css?inline';

export class TodayView extends HTMLElement {
    private articles: Article[] = [];
    private loading = true;
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
            const page = await fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'newest', limit: 20 });
            this.articles = page.items;
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
        h.textContent = 'Today';
        toolbar.appendChild(h);
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
            empty.textContent = 'Nothing new today.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const a of this.articles) {
                const li = document.createElement('li');
                li.className = 'row';
                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = a.title;
                li.appendChild(title);
                const meta = document.createElement('span');
                meta.className = 'meta';
                meta.textContent = `${domainOf(a.link)} · ${formatDate(a.published)} · ${readMinutes(a.content, a.summary)} min`;
                li.appendChild(meta);
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('today-view', TodayView);
