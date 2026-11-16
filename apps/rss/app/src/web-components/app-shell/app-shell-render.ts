import { html } from 'lit';
import { navigate } from '../../router';
import { dismissToast, type ToastNotice } from '../../services/toast';
import { MAX_ARTICLE_PANEL_WIDTH, MIN_ARTICLE_PANEL_WIDTH } from './article-panel-settings';
import type { Article, View } from '../../types';

export interface AppShellRenderHost {
    authed: boolean;
    route: View;
    article: Article | null;
    settingsOpen: boolean;
    shortcutsOpen: boolean;
    paletteOpen: boolean;
    paletteCommands: unknown[];
    resume: { view: string; id: string } | null;
    username: string | null;
    authError: string;
    toasts: ToastNotice[];
    articleWidth: number;
    onOpenArticle: (e: Event) => void;
    closeArticle: (dismissed?: boolean) => void;
    onArticleResizeStart: (e: PointerEvent) => void;
    onArticleResizeMove: (e: PointerEvent) => void;
    onArticleResizeEnd: (e: PointerEvent) => void;
    onArticleResizeKey: (e: KeyboardEvent) => void;
    onSignIn: () => void;
    onSignOut: () => void;
    onShowShortcuts: () => void;
    openPalette: () => void;
    onRunCommand: (e: Event) => void;
}

export function renderShell(host: AppShellRenderHost) {
    if (!host.authed) return renderSignIn(host);
    // The overlay lives inside main (not as a layout sibling) so every
    // control it adds — including the panel resize grip outside the
    // dialog element — stays contained by a landmark for the region audit.
    // Position is unchanged: the overlay is absolute against .layout.
    return html`${renderHeader(host)}<div class="layout"><source-list .view=${host.route}></source-list><main>${renderMain(host)}${renderOverlay(host)}</main></div>${renderSettings(host)}${renderToasts(host)}`;
}

function renderToasts(host: AppShellRenderHost) {
    if (host.toasts.length === 0) return html``;
    return html`<div class="toasts" role="status">${host.toasts.map(
        (notice) =>
            html`<button class="toast${notice.kind === 'info' ? ' toast-info' : ''}" @click=${() => dismissToast(notice.id)}>${notice.message}</button>`,
    )}</div>`;
}

function renderSignIn(host: AppShellRenderHost) {
    return html`
        <header>
            <button class="brand-link" @click=${() => navigate({ kind: 'all' })}>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <h1>RSS Reader</h1><span class="sub">your feeds, in one place</span>
            </button>
        </header>
        <main class="signin">
            <div class="signin-card">
                <h2>Sign in to read</h2>
                <p class="muted">Your feeds live in your account. Sign in with the workbench identity service to continue.</p>
                <button class="primary" @click=${host.onSignIn}>Sign in</button>
                ${host.authError ? html`<p class="error">${host.authError}</p>` : ''}
            </div>
        </main>`;
}

function renderHeader(host: AppShellRenderHost) {
    return html`
        <header>
            <button class="brand-link" @click=${() => navigate({ kind: 'all' })}>
                <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2" fill="currentColor"/><path d="M4 4a16 16 0 0 1 16 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 11a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
                <h1>RSS Reader</h1><span class="sub">your feeds, in one place</span>
            </button>
            <div class="spacer"></div>
            ${host.username ? html`<span class="who">${host.username}</span><button class="signout" @click=${host.onSignOut}>Sign out</button>` : ''}
            <button class="gear help" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts (?)" @click=${host.onShowShortcuts}>?</button>
            <button
                type="button"
                class="palette-search-trigger"
                aria-label="Search commands Ctrl+K"
                title="Command palette (Ctrl+K)"
                @click=${host.openPalette}
            >
                <span class="palette-search-text">Search commands</span>
                <kbd class="palette-search-hint" aria-hidden="true">Ctrl+K</kbd>
            </button>
            <button class="gear" title="Settings" @click=${() => {
                host.settingsOpen = true;
            }}>${renderGearIcon()}</button>
        </header>`;
}

function renderGearIcon() {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}

function renderMain(host: AppShellRenderHost) {
    const resumeArticleId = host.resume && JSON.stringify(host.route) === host.resume.view ? host.resume.id : null;
    if (host.route.kind === 'brief') return html`<brief-view @open-article=${host.onOpenArticle}></brief-view>`;
    if (host.route.kind === 'today') return html`<today-view @open-article=${host.onOpenArticle}></today-view>`;
    if (host.route.kind === 'frontpage') return html`<front-page @open-article=${host.onOpenArticle}></front-page>`;
    if (host.route.kind === 'focus') return html`<focus-view @open-article=${host.onOpenArticle}></focus-view>`;
    if (host.route.kind === 'organize') return html`<organize-view></organize-view>`;
    if (host.route.kind === 'mute-filters') return html`<mute-filters-view></mute-filters-view>`;
    if (host.route.kind === 'saved') return html`<saved-view @open-article=${host.onOpenArticle}></saved-view>`;
    if (host.route.kind === 'search')
        return html`<search-view .view=${host.route} @open-article=${host.onOpenArticle}></search-view>`;
    return html`<article-list .view=${host.route} .active=${!host.article} .resumeArticleId=${resumeArticleId} @open-article=${host.onOpenArticle}></article-list>`;
}

function renderOverlay(host: AppShellRenderHost) {
    if (!host.article) return '';
    // pointer-only: the backdrop is a click-outside affordance, not the way
    // out. article-view has a visible Back button and Escape closes it, so
    // a keyboard user is not trapped here.
    return html`<div class="article-overlay"><div class="article-backdrop" @click=${host.closeArticle}></div><div class="article-panel" style="--article-width: ${host.articleWidth}px"><div
        class="article-panel-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize article panel"
        aria-valuenow=${Math.round(host.articleWidth)}
        aria-valuemin=${MIN_ARTICLE_PANEL_WIDTH}
        aria-valuemax=${MAX_ARTICLE_PANEL_WIDTH}
        tabindex="0"
        title="Drag to resize"
        @pointerdown=${host.onArticleResizeStart}
        @pointermove=${host.onArticleResizeMove}
        @pointerup=${host.onArticleResizeEnd}
        @pointercancel=${host.onArticleResizeEnd}
        @keydown=${host.onArticleResizeKey}
    ><span class="article-panel-grip" aria-hidden="true"></span></div><article-view .article=${host.article} @close=${host.closeArticle}></article-view></div></div>`;
}

function renderSettings(host: AppShellRenderHost) {
    return html`<settings-dialog .open=${host.settingsOpen} .view=${host.route} @close=${() => {
        host.settingsOpen = false;
    }}></settings-dialog><shortcuts-dialog .open=${host.shortcutsOpen} @close=${() => {
        host.shortcutsOpen = false;
    }}></shortcuts-dialog><command-palette .open=${host.paletteOpen} .commands=${host.paletteCommands} @close=${() => {
        host.paletteOpen = false;
    }} @run=${host.onRunCommand}></command-palette>`;
}
