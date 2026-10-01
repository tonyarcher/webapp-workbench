import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { history, parsePath } from '../../router';
import { markArticleRead } from '../../mutations';
import { bustCounts, queryClient } from '../../query';
import { clearClientDb } from '../../db/db';
import { currentUsername, hasSession, logout, startLogin } from '../../services/auth';
import type { Article, View } from '../../types';
import styles from './app-shell.css?inline';

/**
 * The element that really has focus. `document.activeElement` stops at a
 * shadow host, and the article list that opens this dialog lives inside a
 * child component's shadow root, so without the descent focus would be
 * restored to the host rather than to the article that was read.
 *
 * The same six lines exist in the baseball and basketball apps. Each app is
 * its own workspace and there is no shared UI package to put one copy in, so
 * they are kept identical here to keep a future extraction a mechanical grep.
 */
function deepActiveElement(): HTMLElement | null {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) {
        element = element.shadowRoot.activeElement;
    }
    return element instanceof HTMLElement ? element : null;
}

@customElement('app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private route: View = { kind: 'all' };
    @state() private article: Article | null = null;
    private articleReturnFocus: HTMLElement | null = null;
    @state() private settingsOpen = false;
    @state() private resume: { view: string; id: string } | null = null;
    @state() private authed = hasSession();
    @state() private username: string | null = currentUsername();
    @state() private authError = '';

    private readContext: { items: Article[]; index: number } | null = null;
    private unsubscribe?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this.route = parsePath(history.location.pathname);
        this.unsubscribe = history.subscribe(({ location }) => {
            this.route = parsePath(location.pathname);
            this.closeArticle();
            this.resume = null;
        });
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('rss-auth-required', this.onAuthRequired);
        window.addEventListener('rss-auth-changed', this.onAuthChanged);
        window.addEventListener('rss-auth-error', this.onAuthError);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('rss-auth-required', this.onAuthRequired);
        window.removeEventListener('rss-auth-changed', this.onAuthChanged);
        window.removeEventListener('rss-auth-error', this.onAuthError);
        this.unsubscribe?.();
    }

    private onAuthError = (e: Event) => {
        const detail = (e as CustomEvent<unknown>).detail;
        this.authError = typeof detail === 'string' && detail ? detail : 'Sign-in failed';
    };

    private onAuthChanged = () => {
        this.authed = hasSession();
        this.username = currentUsername();
    };

    private onAuthRequired = () => {
        this.signOut();
    };

    private onSignIn = () => {
        this.authError = '';
        startLogin().catch((err: unknown) => {
            this.authError = err instanceof Error ? err.message : 'Sign-in failed';
        });
    };

    private onSignOut = () => {
        this.signOut();
    };

    /**
     * Sign out and report honestly, whether that was asked for or forced.
     *
     * endSession never rejects, but clearClientDb talks to IndexedDB and can.
     * Without a catch that surfaces as an unhandled rejection and leaves the
     * user signed in with no explanation.
     */
    private signOut = (): void => {
        void this.resetAccount().catch(() => {
            this.authError = 'Signed out on this device, but some local data could not be cleared.';
            this.authed = false;
            this.username = null;
        });
    };

    /**
     * Drop the session and every trace of the account on this browser.
     *
     * The identity call comes first and decides what the user is told. Local
     * state is cleared either way -- leaving articles on the device after a sign
     * out is the worse outcome -- but a server session that survived is reported
     * rather than hidden, because the browser is still signed in until it ends.
     */
    private resetAccount = async (): Promise<void> => {
        const ended = await logout();
        bustCounts();
        queryClient.clear();
        try {
            localStorage.removeItem('rss-reader:word-map');
            localStorage.removeItem('rss-reader:word-map-ids');
        } catch {
            // storage unavailable; nothing to clear
        }
        await clearClientDb();
        this.authed = false;
        this.username = null;
        this.authError = ended
            ? ''
            : 'Signed out on this device, but the identity service did not confirm it. Reload before signing in again.';
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
                    ${this.authError ? html`<p class="error">${this.authError}</p>` : ''}
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
        if (this.route.kind === 'frontpage') return html`<front-page @open-article=${this.onOpenArticle}></front-page>`;
        return html`<article-list .view=${this.route} .active=${!this.article} .resumeArticleId=${this.resumeArticleId} @open-article=${this.onOpenArticle}></article-list>`;
    }

    private get resumeArticleId(): string | null {
        if (!this.resume) return null;
        return JSON.stringify(this.route) === this.resume.view ? this.resume.id : null;
    }

    private renderOverlay() {
        if (!this.article) return '';
        // pointer-only: the backdrop is a click-outside affordance, not the way
        // out. article-view has a visible Back button and Escape closes it, so
        // a keyboard user is not trapped here.
        return html`<div class="article-overlay"><div class="article-backdrop" @click=${this.closeArticle}></div><article-view .article=${this.article} @close=${this.closeArticle}></article-view></div>`;
    }

    private renderSettings() {
        return html`<settings-dialog .open=${this.settingsOpen} @close=${() => (this.settingsOpen = false)}></settings-dialog>`;
    }

    private onKeyDown = (e: KeyboardEvent) => {
        // Before the nav keys, and before shouldIgnoreKey, so Escape closes the
        // article even with focus in a field or another dialog open.
        if (this.article && e.key === 'Escape') {
            this.closeArticle();
            return;
        }
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
        const { items, index } = this.readContext;
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
        if (index < items.length - 1) void this.openAt(index + 1);
    }

    private handlePrev(e: KeyboardEvent, index: number) {
        e.preventDefault();
        if (index > 0) void this.openAt(index - 1);
    }

    private handleClose(e: KeyboardEvent) {
        e.preventDefault();
        this.closeArticle();
    }

    private async openAt(index: number) {
        if (!this.readContext) return;
        const article = this.readContext.items[index];
        if (!article) return;
        this.readContext = { ...this.readContext, index };
        this.article = article;
        this.resume = { view: JSON.stringify(this.route), id: article.id };
        if (await markArticleRead(article.id)) {
            window.dispatchEvent(new CustomEvent('article-read', { detail: article.id }));
        }
    }

    private onOpenArticle(e: Event) {
        const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
        this.readContext = { items: detail.items, index: detail.index };
        this.articleReturnFocus = deepActiveElement();
        this.article = detail.article;
        this.resume = { view: JSON.stringify(this.route), id: detail.article.id };
    }

    private closeArticle() {
        if (!this.article) return;
        this.article = null;
        this.readContext = null;
        const target = this.articleReturnFocus;
        this.articleReturnFocus = null;
        target?.focus();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'app-shell': AppShell;
    }
}
