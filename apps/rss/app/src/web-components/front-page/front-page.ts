import { fetchFrontPage } from '../../services/api';
import { domainOf, formatDate, readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './front-page.css?inline';

export class FrontPage extends HTMLElement {
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
            const res = await fetchFrontPage({ limit: 30 });
            this.articles = res.articles;
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
        h.textContent = 'Front Page';
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
            empty.textContent = 'No articles yet.';
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

customElements.define('front-page', FrontPage);
