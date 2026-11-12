import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { history, parsePath } from '../../router';
import { markArticleRead } from '../../mutations';
import { bustCounts, queryClient } from '../../query';
import { clearClientDb } from '../../db/db';
import { currentUsername, hasSession, logout, startLogin } from '../../services/auth';
import { clearToasts, dismissToast, onToast, type ToastNotice } from '../../services/toast';
import { accrueEngagement } from '../../services/interesting-settings';
import { OPEN_READ_CAP, expandedReadWeight } from '../../services/engagement';
import type { Article, View } from '../../types';
import {
    MAX_ARTICLE_PANEL_WIDTH,
    MIN_ARTICLE_PANEL_WIDTH,
    clampArticlePanelWidth,
    loadArticlePanelWidth,
    nextArticlePanelWidth,
    saveArticlePanelWidth,
} from './article-panel-settings';
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
    @state() private toasts: ToastNotice[] = [];

    private toastTimers = new Map<number, ReturnType<typeof setTimeout>>();

    private readContext: { items: Article[]; index: number } | null = null;
    private unsubscribe?: () => void;
    private unsubscribeToasts: (() => void) | null = null;
    private articleResizing = false;
    private articleResizeHandleEl: HTMLElement | null = null;
    private articleResizeStart: { x: number; width: number; pointerId: number } | null = null;
    /**
     * Current article panel width, the source of truth for aria-valuenow.
     * Kept as a plain field like the sidebar width: a drag applies it on
     * every pointermove, and re-rendering the whole shell that often would
     * fight the pointer capture. The template reads it on render and
     * applyArticlePanelWidth writes the attribute directly in between.
     */
    articleWidth = loadArticlePanelWidth();

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
        this.unsubscribeToasts = onToast((notices) => {
            this.toasts = notices;
            this.syncToastTimers();
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.unsubscribeToasts?.();
        this.unsubscribeToasts = null;
        this.endArticleResize();
        for (const timer of this.toastTimers.values()) clearTimeout(timer);
        this.toastTimers.clear();
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
        clearToasts();
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
        clearToasts();
        this.authError = ended
            ? ''
            : 'Signed out on this device, but the identity service did not confirm it. Reload before signing in again.';
    };

    override render() {
        if (!this.authed) return this.renderSignIn();
        // The overlay lives inside main (not as a layout sibling) so every
        // control it adds — including the panel resize grip outside the
        // dialog element — stays contained by a landmark for the region audit.
        // Position is unchanged: the overlay is absolute against .layout.
        return html`${this.renderHeader()}<div class="layout"><source-list .view=${this.route}></source-list><main>${this.renderMain()}${this.renderOverlay()}</main></div>${this.renderSettings()}${this.renderToasts()}`;
    }

    /**
     * Error toasts from failed API actions. Buttons, not divs with handlers,
     * so every notice is keyboard-reachable; the region announces politely.
     */
    private renderToasts() {
        if (this.toasts.length === 0) return html``;
        return html`<div class="toasts" role="status">${this.toasts.map(
            (notice) =>
                html`<button class="toast${notice.kind === 'info' ? ' toast-info' : ''}" @click=${() => dismissToast(notice.id)}>${notice.message}</button>`,
        )}</div>`;
    }

    /** Timers follow the notices: new ones arm, gone ones clear. */
    private syncToastTimers(): void {
        for (const [id, timer] of this.toastTimers) {
            if (!this.toasts.some((notice) => notice.id === id)) {
                clearTimeout(timer);
                this.toastTimers.delete(id);
            }
        }
        for (const notice of this.toasts) {
            if (this.toastTimers.has(notice.id)) continue;
            const id = notice.id;
            this.toastTimers.set(
                id,
                setTimeout(() => {
                    this.toastTimers.delete(id);
                    dismissToast(id);
                }, 6000),
            );
        }
    }

    private renderSignIn() {
        return html`
            <header>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <h1>RSS Reader</h1><span class="sub">your feeds, in one place</span>
            </header>
            <main class="signin">
                <div class="signin-card">
                    <h2>Sign in to read</h2>
                    <p class="muted">Your feeds live in your account. Sign in with the workbench identity service to continue.</p>
                    <button class="primary" @click=${this.onSignIn}>Sign in</button>
                    ${this.authError ? html`<p class="error">${this.authError}</p>` : ''}
                </div>
            </main>`;
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
        return html`<div class="article-overlay"><div class="article-backdrop" @click=${this.closeArticle}></div><div class="article-panel" style="--article-width: ${this.articleWidth}px"><div
            class="article-panel-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize article panel"
            aria-valuenow=${Math.round(this.articleWidth)}
            aria-valuemin=${MIN_ARTICLE_PANEL_WIDTH}
            aria-valuemax=${MAX_ARTICLE_PANEL_WIDTH}
            tabindex="0"
            title="Drag to resize"
            @pointerdown=${this.onArticleResizeStart}
            @pointermove=${this.onArticleResizeMove}
            @pointerup=${this.onArticleResizeEnd}
            @pointercancel=${this.onArticleResizeEnd}
            @keydown=${this.onArticleResizeKey}
        ><span class="article-panel-grip" aria-hidden="true"></span></div><article-view .article=${this.article} @close=${this.closeArticle}></article-view></div></div>`;
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
        this.trackOpen(article);
        this.resume = { view: JSON.stringify(this.route), id: article.id };
        if (await markArticleRead(article.id)) {
            window.dispatchEvent(new CustomEvent('article-read', { detail: article.id }));
        }
    }

    private onOpenArticle(e: Event) {
        const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
        this.readContext = { items: detail.items, index: detail.index };
        this.articleReturnFocus = deepActiveElement();
        this.trackOpen(detail.article);
        this.resume = { view: JSON.stringify(this.route), id: detail.article.id };
    }

    /**
     * Expanded-read timing. Both open paths funnel here; every close path
     * funnels through closeArticle (backdrop, Back button, Escape, keyboard
     * close, route change), so open-to-close seconds are fully covered.
     */
    private openArticleId: string | null = null;
    private openedAt = 0;

    private trackOpen(article: Article) {
        this.flushExpandedRead();
        this.article = article;
        this.openArticleId = article.id;
        this.openedAt = Date.now();
    }

    private flushExpandedRead() {
        const open = this.article;
        if (this.openArticleId === null || this.openedAt <= 0 || !open || open.id !== this.openArticleId) {
            this.openArticleId = null;
            this.openedAt = 0;
            return;
        }
        const seconds = (Date.now() - this.openedAt) / 1000;
        this.openArticleId = null;
        this.openedAt = 0;
        accrueEngagement(open.title, expandedReadWeight(seconds), open.id, OPEN_READ_CAP, 'open');
    }

    private closeArticle() {
        if (!this.article) return;
        this.flushExpandedRead();
        this.article = null;
        this.readContext = null;
        this.endArticleResize();
        const target = this.articleReturnFocus;
        this.articleReturnFocus = null;
        target?.focus();
    }

    /**
     * Release a panel resize torn down mid-drag. Escape and route changes
     * remove the overlay (and the handle holding the pointer capture) while
     * a drag is in flight, so without this the body keeps col-resize and
     * unselectable text until the next successful drag-end or reload.
     */
    private endArticleResize() {
        if (!this.articleResizing) return;
        this.articleResizing = false;
        const handle = this.articleResizeHandleEl;
        const pointerId = this.articleResizeStart?.pointerId;
        this.articleResizeStart = null;
        this.articleResizeHandleEl = null;
        if (handle && pointerId !== undefined) {
            try {
                if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
            } catch {
                // handle already detached; nothing to release
            }
            handle.classList.remove('resizing');
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    /**
     * The handle element, whether or not a drag is in progress. The active
     * handle only exists between pointerdown and pointerup; a keyboard
     * resize never sets it, so the shadow root fallback keeps aria-valuenow
     * honest for exactly the users this control exists for.
     */
    private get articlePanelHandle(): HTMLElement | null {
        return (
            this.articleResizeHandleEl ?? this.renderRoot?.querySelector<HTMLElement>('.article-panel-handle') ?? null
        );
    }

    /**
     * The one place an article panel width is applied, so the pointer and
     * keyboard paths cannot drift apart. Writes the CSS var on the panel
     * (no re-render per pointermove) and the separator value a screen
     * reader announces.
     */
    private applyArticlePanelWidth(raw: number) {
        const width = clampArticlePanelWidth(raw);
        this.articleWidth = width;
        const panel = this.renderRoot?.querySelector<HTMLElement>('.article-panel');
        panel?.style.setProperty('--article-width', `${width}px`);
        this.articlePanelHandle?.setAttribute('aria-valuenow', String(width));
        saveArticlePanelWidth(width);
    }

    private onArticleResizeStart = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        this.articleResizeHandleEl = handle;
        this.articleResizeStart = { x: e.clientX, width: this.articleWidth, pointerId: e.pointerId };
        this.articleResizing = true;
        handle.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    private onArticleResizeMove = (e: PointerEvent) => {
        if (!this.articleResizing || !this.articleResizeStart) return;
        // The panel docks right: dragging left grows it.
        this.applyArticlePanelWidth(this.articleResizeStart.width + (this.articleResizeStart.x - e.clientX));
    };

    private onArticleResizeEnd = (e: PointerEvent) => {
        if (!this.articleResizing) return;
        const handle = this.articleResizeHandleEl;
        this.articleResizing = false;
        this.articleResizeStart = null;
        this.articleResizeHandleEl = null;
        handle?.classList.remove('resizing');
        if (handle) {
            try {
                if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            } catch {
                // handle already detached; nothing to release
            }
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    /**
     * Keyboard equivalent of the drag. Stepping and clamping live in
     * nextArticlePanelWidth so they are testable without a DOM; this only
     * decides whether the key is ours. Handled keys stop propagation: the
     * shell's window keydown also listens for ArrowLeft (close) and would
     * otherwise fire after the target listener and shut the overlay
     * mid-resize.
     */
    private onArticleResizeKey = (e: KeyboardEvent) => {
        const next = nextArticlePanelWidth(this.articleWidth, e.key, e.shiftKey);
        if (next === null) return;
        e.preventDefault();
        e.stopPropagation();
        this.applyArticlePanelWidth(next);
    };
}

declare global {
    interface HTMLElementTagNameMap {
        'app-shell': AppShell;
    }
}
