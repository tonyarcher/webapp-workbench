import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {history, parsePath} from '../../router';
import {markArticleRead} from '../../mutations';
import {queryClient} from '../../query';
import {clearClientDb} from '../../db/db';
import {currentUsername, hasSession, logout, startLogin} from '../../services/auth';
import type {Article, View} from '../../types';
import styles from './app-shell.css?inline';

@customElement('app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private route: View = {kind: 'all'};
    @state() private article: Article | null = null;
    @state() private settingsOpen = false;
    @state() private resume: { view: string; id: string } | null = null;
    @state() private authed = hasSession();
    @state() private username: string | null = currentUsername();

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
        window.addEventListener('rss-auth-required', this.onAuthRequired);
        window.addEventListener('rss-auth-changed', this.onAuthChanged);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('rss-auth-required', this.onAuthRequired);
        window.removeEventListener('rss-auth-changed', this.onAuthChanged);
        this.unsubscribe?.();
    }

    private onAuthChanged = () => {
        this.authed = hasSession();
        this.username = currentUsername();
    };

    private onAuthRequired = () => {
        this.resetAccount();
    };

    private onSignIn = () => {
        void startLogin();
    };

    private onSignOut = () => {
        this.resetAccount();
    };

    /** Drop the session and every trace of the account on this browser. */
    private resetAccount = () => {
        logout();
        queryClient.clear();
        void clearClientDb().finally(() => {
            this.authed = false;
            this.username = null;
        });
    };

    override render() {
        if (!this.authed) return this.renderSignIn();
        return html`${this.renderHeader()}<div class="layout"><source-list .view=${this.route}></source-list><main>${this.renderMain()}</main>${this.renderOverlay()}</div>${this.renderSettings()}`;
    }

    private renderSignIn() {
        return html`
            <header>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <h1>RSS Reader</h1><span class="sub">your feeds, in one place</span>
            </header>
            <div class="signin">
                <div class="signin-card">
                    <h2>Sign in to read</h2>
                    <p class="muted">Your feeds live in your account. Sign in with the workbench identity service to continue.</p>
                    <button class="primary" @click=${this.onSignIn}>Sign in</button>
                </div>
            </div>`;
    }

    private renderHeader() {
        return html`
            <header>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <h1>RSS Reader</h1><span class="sub">your feeds, in one place</span><div class="spacer"></div>
                ${this.username ? html`<span class="who">${this.username}</span><button class="signout" @click=${this.onSignOut}>Sign out</button>` : ''}
                <button class="gear" title="Settings" @click=${() => (this.settingsOpen = true)}>${this.renderGearIcon()}</button>
            </header>`;
    }

    private renderGearIcon() {
        return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
    }

    private renderMain() {
        if (this.route.kind === 'brief') return html`<brief-view @open-article=${this.onOpenArticle}></brief-view>`;
        if (this.route.kind === 'today') return html`<today-view @open-article=${this.onOpenArticle}></today-view>`;
        return html`<article-list .view=${this.route} .active=${!this.article} .resumeArticleId=${this.resumeArticleId} @open-article=${this.onOpenArticle}></article-list>`;
    }

    private get resumeArticleId(): string | null {
        if (!this.resume) return null;
        return JSON.stringify(this.route) === this.resume.view ? this.resume.id : null;
    }

    private renderOverlay() {
        if (!this.article) return '';
        return html`<div class="article-overlay"><div class="article-backdrop" @click=${this.closeArticle}></div><article-view .article=${this.article} @close=${this.closeArticle}></article-view></div>`;
    }

    private renderSettings() {
        return html`<settings-dialog .open=${this.settingsOpen} @close=${() => (this.settingsOpen = false)}></settings-dialog>`;
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.readContext) return;
        if (this.shouldIgnoreKey(e)) return;
        this.handleNavKey(e);
    };

    private shouldIgnoreKey(e: KeyboardEvent): boolean {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (document.querySelector('dialog[open]')) return true;
        return false;
    }

    private handleNavKey(e: KeyboardEvent) {
        if (!this.readContext) return;
        const {items, index} = this.readContext;
        if (this.isNextKey(e.key)) this.handleNext(e, items, index);
        else if (this.isPrevKey(e.key)) this.handlePrev(e, index);
        else if (this.isCloseKey(e.key)) this.handleClose(e);
    }

    private isNextKey(key: string): boolean {
        return key === 'j' || key === 'ArrowDown';
    }

    private isPrevKey(key: string): boolean {
        return key === 'k' || key === 'ArrowUp';
    }

    private isCloseKey(key: string): boolean {
        return key === 'Escape' || key === 'ArrowLeft' || key === 'Backspace';
    }

    private handleNext(e: KeyboardEvent, items: Article[], index: number) {
        e.preventDefault();
        if (index < items.length - 1) this.openAt(index + 1);
    }

    private handlePrev(e: KeyboardEvent, index: number) {
        e.preventDefault();
        if (index > 0) this.openAt(index - 1);
    }

    private handleClose(e: KeyboardEvent) {
        e.preventDefault();
        this.closeArticle();
    }

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
