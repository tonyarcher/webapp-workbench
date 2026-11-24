import { fetchSavedArticlesList } from '../../query';
import { removeSavedSnapshot, unsaveForLater } from '../../mutations-saved';
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

export class SavedView extends HTMLElement {
    private items: SavedArticleSnapshot[] = [];
    private storageEstimate: { usage: number; quota: number } | null = null;
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
        void this.refreshStorage();
    }

    private async load() {
        try {
            this.items = await fetchSavedArticlesList();
        } catch {
            this.items = [];
        }
        this.paint();
    }

    private async refreshStorage() {
        if (!navigator.storage?.estimate) return;
        const est = await navigator.storage.estimate();
        this.storageEstimate = { usage: est.usage ?? 0, quota: est.quota ?? 0 };
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Saved for later';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.items.length} item${this.items.length === 1 ? '' : 's'}`;
        toolbar.appendChild(h);
        toolbar.appendChild(meta);
        if (this.storageEstimate) {
            const storage = document.createElement('span');
            storage.className = 'storage';
            storage.textContent = `${(this.storageEstimate.usage / 1024 / 1024).toFixed(1)} MB used`;
            toolbar.appendChild(storage);
        }
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn';
        exportBtn.textContent = 'Export to markdown';
        exportBtn.addEventListener('click', () => this.exportNotes());
        toolbar.appendChild(exportBtn);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (!this.items.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No saved articles yet. Use “Save for later” while reading an article.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const s of this.items) {
                const article = toArticle(s);
                const li = document.createElement('li');
                li.className = 'row';
                const open = document.createElement('button');
                open.className = 'open';
                open.addEventListener('click', () => this.open(s));
                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = s.title;
                open.appendChild(title);
                const metaLine = document.createElement('span');
                metaLine.className = 'meta-line';
                if (s.feedTitle) {
                    const ft = document.createElement('span');
                    ft.textContent = s.feedTitle;
                    metaLine.appendChild(ft);
                } else {
                    const sa = document.createElement('span');
                    sa.textContent = 'Saved article';
                    metaLine.appendChild(sa);
                }
                if (s.link) {
                    const dom = document.createElement('span');
                    dom.textContent = domainOf(s.link);
                    metaLine.appendChild(dom);
                }
                const date = document.createElement('span');
                date.textContent = formatDate(article.published);
                metaLine.appendChild(date);
                open.appendChild(metaLine);
                if (s.summary) {
                    const summary = document.createElement('span');
                    summary.className = 'summary';
                    summary.textContent = s.summary;
                    open.appendChild(summary);
                }
                li.appendChild(open);
                const remove = document.createElement('button');
                remove.className = 'btn danger';
                remove.textContent = 'Remove';
                remove.addEventListener('click', () => this.removeSaved(s));
                li.appendChild(remove);
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
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
        const done = s.articleId ? unsaveForLater(s.articleId) : removeSavedSnapshot(s.id);
        void done.then((ok) => {
            if (ok) void this.load();
        });
    }

    private exportNotes() {
        const items = this.items;
        const articles = items.map(toArticle);
        // dynamic import to avoid circular dep
        import('../../services/notes-export').then((m) => m.downloadNotesExport(articles, 'obsidian'));
    }
}

customElements.define('saved-view', SavedView);
