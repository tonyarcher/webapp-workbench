import { fetchArticlesPage } from '../../services/api';
import type { Article } from '../../types';
import styles from './search-view.css?inline';

export class SearchView extends HTMLElement {
    private query = '';
    private results: Article[] = [];
    private loading = false;
    private root: HTMLDivElement | null = null;
    view: unknown = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        this.paint();
    }

    private async runSearch() {
        const q = this.query.trim();
        if (!q) {
            this.results = [];
            this.paint();
            return;
        }
        this.loading = true;
        this.paint();
        try {
            const page = await fetchArticlesPage({ scope: 'all', limit: 50 });
            this.results = page.items;
        } catch {
            this.results = [];
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
        h.textContent = 'Search';
        toolbar.appendChild(h);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'search';
        input.placeholder = 'Search articles';
        input.value = this.query;
        input.addEventListener('input', (e) => {
            this.query = (e.target as HTMLInputElement).value;
        });
        input.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.runSearch();
        });
        body.appendChild(input);
        if (this.loading) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Searching…';
            body.appendChild(empty);
        } else if (!this.results.length && this.query.trim()) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No results.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const a of this.results) {
                const li = document.createElement('li');
                li.className = 'row';
                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = a.title;
                li.appendChild(title);
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('search-view', SearchView);
