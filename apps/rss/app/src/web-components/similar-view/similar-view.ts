import { getAllArticles, getFeeds } from '../../db/db';
import { loadWordMap } from '../../services/interesting-settings';
import { similarArticles, type SimilarResult } from '../../services/similar';
import type { Article } from '../../types';
import styles from './similar-view.css?inline';

export class SimilarView extends HTMLElement {
    private article: Article | null = null;
    private corpus: Article[] = [];
    private results: SimilarResult[] = [];
    private loading = false;
    private generation = 0;
    private loadedArticleId: string | null = null;
    private root: HTMLDivElement | null = null;

    connectedCallback(): void {
        if (!this.root) {
            const shadow = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = styles;
            this.root = document.createElement('div');
            this.root.className = 'similar-panel';
            this.root.setAttribute('role', 'dialog');
            this.root.setAttribute('aria-modal', 'true');
            this.root.setAttribute('aria-label', 'More like this');
            this.root.tabIndex = -1;
            shadow.append(style, this.root);
        }
        if (this.loadedArticleId === this.article?.id) this.paint();
        else void this.load();
        this.root.focus();
    }

    disconnectedCallback(): void {
        this.generation++;
    }

    setSeed(article: Article, corpus: Article[]): void {
        if (this.article?.id !== article.id) this.loadedArticleId = null;
        this.article = article;
        this.corpus = corpus;
    }

    private async load(): Promise<void> {
        const article = this.article;
        if (!article) return;
        const gen = ++this.generation;
        this.loading = true;
        this.paint();
        try {
            const [stored, feeds] = await Promise.all([getAllArticles(), getFeeds()]);
            if (gen !== this.generation || !this.isConnected) return;
            const corpus = [...new Map([...stored, ...this.corpus].map((item) => [item.id, item])).values()];
            this.results = similarArticles(article, corpus, feeds, loadWordMap());
            this.loadedArticleId = article.id;
        } catch {
            if (gen === this.generation && this.isConnected) this.results = [];
        } finally {
            if (gen === this.generation && this.isConnected) {
                this.loading = false;
                this.paint();
            }
        }
    }

    private paint(): void {
        if (!this.root) return;
        this.root.replaceChildren();
        const head = document.createElement('div');
        head.className = 'head';
        const title = document.createElement('h2');
        title.textContent = 'More like this';
        const close = document.createElement('button');
        close.className = 'btn';
        close.textContent = 'Close';
        close.setAttribute('aria-label', 'Close related stories');
        close.addEventListener('click', () => this.dispatchEvent(new CustomEvent('close')));
        head.append(title, close);
        this.root.appendChild(head);
        const body = document.createElement('div');
        body.className = 'body';
        if (this.loading) {
            body.appendChild(text('p', 'empty', 'Finding related stories…'));
        } else if (!this.results.length) {
            body.appendChild(text('p', 'empty', 'No related stories in your local corpus yet.'));
        } else {
            const list = document.createElement('ul');
            list.className = 'results';
            for (const result of this.results) {
                const item = document.createElement('li');
                const open = document.createElement('button');
                open.className = 'result';
                open.appendChild(text('span', 'result-title', result.article.title));
                open.appendChild(text('span', 'result-reason', result.reasons.join(' · ')));
                open.addEventListener('click', () => this.open(result));
                item.appendChild(open);
                list.appendChild(item);
            }
            body.appendChild(list);
        }
        this.root.appendChild(body);
    }

    private open(result: SimilarResult): void {
        const items = this.results.map((entry) => entry.article);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: {
                    article: result.article,
                    index: items.findIndex((article) => article.id === result.article.id),
                    items,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

function text(tag: 'p' | 'span', className: string, value: string): HTMLElement {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = value;
    return node;
}

customElements.define('similar-view', SimilarView);

declare global {
    interface HTMLElementTagNameMap {
        'similar-view': SimilarView;
    }
}
