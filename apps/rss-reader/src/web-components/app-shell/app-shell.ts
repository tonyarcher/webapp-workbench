import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {history, parsePath} from '../../router';
import {markArticleRead} from '../../mutations';
import type {Article, View} from '../../types';
import styles from './app-shell.css?inline';

@customElement('app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private route: View = {kind: 'all'};
    @state() private article: Article | null = null;
    @state() private settingsOpen = false;
    @state() private resume: { view: string; id: string } | null = null;

    private readContext: { items: Article[]; index: number } | null = null;
    private unsubscribe?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this.route = parsePath(history.location.pathname);
        this.unsubscribe = history.subscribe(({location}) => {
            this.route = parsePath(location.pathname);
            this.closeArticle();
            this.resume = null;
        });
        window.addEventListener('keydown', this.onKeyDown);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        this.unsubscribe?.();
    }

    override render() {
        return html`
            <header>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="6" cy="18" r="2" fill="currentColor"/>
                    <path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none"
                          stroke-linecap="round"/>
                    <path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none"
                          stroke-linecap="round"/>
                </svg>
                <h1>RSS Reader</h1>
                <span class="sub">your feeds, in one place</span>
                <div class="spacer"></div>
                <button class="gear" title="Settings" @click=${() => (this.settingsOpen = true)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor"
                              stroke-width="1.7"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                              fill="none" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                </button>
            </header>
            <div class="layout">
                <source-list .view=${this.route}></source-list>
                <main>
                    ${this.route.kind === 'brief'
                        ? html`
                            <brief-view
                                @open-article=${this.onOpenArticle}
                            ></brief-view>`
                        : html`
                            <article-list
                                .view=${this.route}
                                .active=${!this.article}
                                .resumeArticleId=${this.resume && JSON.stringify(this.route) === this.resume.view ? this.resume.id : null}
                                @open-article=${this.onOpenArticle}
                            ></article-list>`}
                </main>
                ${this.article
                    ? html`
                        <div class="article-overlay">
                            <div class="article-backdrop" @click=${this.closeArticle}></div>
                            <article-view
                                .article=${this.article}
                                @close=${this.closeArticle}
                            ></article-view>
                        </div>`
                    : ''}
            </div>
            <settings-dialog
                    .open=${this.settingsOpen}
                    @close=${() => (this.settingsOpen = false)}
            ></settings-dialog>
        `;
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.readContext) return;
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (document.querySelector('dialog[open]')) return;

        const {items, index} = this.readContext;
        if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (index < items.length - 1) this.openAt(index + 1);
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (index > 0) this.openAt(index - 1);
        } else if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'Backspace') {
            e.preventDefault();
            this.closeArticle();
        }
    };

    private openAt(index: number) {
        if (!this.readContext) return;
        const article = this.readContext.items[index];
        if (!article) return;
        this.readContext = {...this.readContext, index};
        this.article = article;
        this.resume = {view: JSON.stringify(this.route), id: article.id};
        void markArticleRead(article.id);
        window.dispatchEvent(new CustomEvent('article-read', {detail: article.id}));
    }

    private onOpenArticle(e: Event) {
        const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
        this.readContext = {items: detail.items, index: detail.index};
        this.article = detail.article;
        this.resume = {view: JSON.stringify(this.route), id: detail.article.id};
    }

    private closeArticle() {
        this.article = null;
        this.readContext = null;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'app-shell': AppShell;
    }
}
