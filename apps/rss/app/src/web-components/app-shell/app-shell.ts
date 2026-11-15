import { LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { history, parsePath } from '../../router';
import type { Command, CommandContext } from '../../services/commands';
import { dismissToast, onToast, type ToastNotice } from '../../services/toast';
import { startInterestingCountsRefresh, stopInterestingCountsRefresh } from '../../services/interesting-counts-refresh';
import { startForegroundSync, stopForegroundSync } from '../../services/foreground-sync';
import { currentUsername, hasSession } from '../../services/auth';
import { endOpen, initialOpenTiming, markOpenedRead, trackOpen, type OpenTiming } from './article-open-tracking';
import {
    endArticleResize,
    panelResizeEnd,
    panelResizeKey,
    panelResizeMove,
    panelResizeStart,
} from './article-panel-resize';
import { loadArticlePanelWidth } from './article-panel-settings';
import { onAuthChanged, onAuthError, signIn, signOut, syncToastTimers as syncToastTimersAuth } from './app-shell-auth';
import {
    autoSyncFeedIds as autoSyncFeedIdsFor,
    deepActiveElement,
    handleShellKeyDown,
    openPalette as openPaletteAction,
} from './app-shell-keyboard';
import { renderShell } from './app-shell-render';
import type { Article, View } from '../../types';
import '../mute-filters-view/mute-filters-view';
import '../organize-view/organize-view';
import '../saved-view/saved-view';
import '../focus-view/focus-view';
import '../shortcuts-dialog/shortcuts-dialog';
import '../command-palette/command-palette';
import styles from './app-shell.css?inline';

@customElement('app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() route: View = { kind: 'all' };
    @state() article: Article | null = null;
    articleReturnFocus: HTMLElement | null = null;
    @state() settingsOpen = false;
    @state() shortcutsOpen = false;
    @state() paletteOpen = false;
    @state() paletteCommands: Command[] = [];
    paletteContext: CommandContext | null = null;
    @state() resume: { view: string; id: string } | null = null;
    @state() authed = hasSession();
    @state() username: string | null = currentUsername();
    @state() authError = '';
    @state() toasts: ToastNotice[] = [];

    toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
    readContext: { items: Article[]; index: number } | null = null;
    private unsubscribe?: () => void;
    private unsubscribeToasts: (() => void) | null = null;
    articleResizing = false;
    articleResizeHandleEl: HTMLElement | null = null;
    articleResizeStart: { x: number; width: number; pointerId: number } | null = null;
    articleWidth = loadArticlePanelWidth();
    private openTiming: OpenTiming = initialOpenTiming();

    override connectedCallback() {
        super.connectedCallback();
        this.route = parsePath(history.location.pathname, history.location.search);
        this.unsubscribe = history.subscribe(({ location }) => {
            this.route = parsePath(location.pathname, location.search);
            this.closeArticle(false);
            this.resume = null;
        });
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('rss-auth-required', this.onAuthRequired);
        window.addEventListener('rss-auth-changed', this.onAuthChanged);
        window.addEventListener('rss-auth-error', this.onAuthErrorEv);
        window.addEventListener('show-shortcuts', this.onShowShortcuts);
        window.addEventListener('article-read', this.onArticleReadSync);
        this.unsubscribeToasts = onToast((notices) => {
            this.toasts = notices;
            syncToastTimersAuth(this as never, dismissToast);
        });
        if (this.authed) {
            startInterestingCountsRefresh();
            startForegroundSync(this.autoSyncFeedIds);
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        stopInterestingCountsRefresh();
        stopForegroundSync();
        this.unsubscribeToasts?.();
        this.unsubscribeToasts = null;
        this.endArticleResize();
        for (const timer of this.toastTimers.values()) clearTimeout(timer);
        this.toastTimers.clear();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('rss-auth-required', this.onAuthRequired);
        window.removeEventListener('rss-auth-changed', this.onAuthChanged);
        window.removeEventListener('rss-auth-error', this.onAuthErrorEv);
        window.removeEventListener('show-shortcuts', this.onShowShortcuts);
        window.removeEventListener('article-read', this.onArticleReadSync);
        this.unsubscribe?.();
    }

    private onShowShortcuts = () => {
        this.shortcutsOpen = true;
    };
    openPalette = () => {
        openPaletteAction(this as never);
    };
    onRunCommand = (e: Event) => {
        this.paletteOpen = false;
        (e as CustomEvent<Command>).detail.run();
    };
    autoSyncFeedIds = (): string[] | undefined => autoSyncFeedIdsFor(this.route);

    private onAuthErrorEv = (e: Event) => {
        onAuthError(this as never, e);
    };
    onAuthChanged = () => {
        onAuthChanged(this as never);
    };
    private onAuthRequired = () => {
        signOut(this as never);
    };
    onSignIn = () => {
        signIn(this as never);
    };
    onSignOut = () => {
        signOut(this as never);
    };

    override render() {
        return renderShell(this as never);
    }

    private onKeyDown = (e: KeyboardEvent) => {
        handleShellKeyDown(this as never, e);
    };

    async openAt(index: number) {
        if (!this.readContext) return;
        const article = this.readContext.items[index];
        if (!article) return;
        this.readContext = { ...this.readContext, index };
        trackOpen(this.openTiming, this.article, article);
        this.article = article;
        this.resume = { view: JSON.stringify(this.route), id: article.id };
        void markOpenedRead(article, (id) => this.syncReadState(id, 1));
    }

    onOpenArticle = (e: Event) => {
        const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
        this.readContext = { items: detail.items, index: detail.index };
        this.articleReturnFocus = deepActiveElement();
        trackOpen(this.openTiming, this.article, detail.article);
        this.article = detail.article;
        this.resume = { view: JSON.stringify(this.route), id: detail.article.id };
        void markOpenedRead(detail.article, (id) => this.syncReadState(id, 1));
    };

    private onArticleReadSync = (e: Event): void => {
        const d = (e as CustomEvent<string | { id: string; read: 0 | 1 }>).detail;
        this.syncReadState(typeof d === 'string' ? d : d.id, typeof d === 'string' ? 1 : d.read);
    };

    private syncReadState(id: string, read: 0 | 1): void {
        if (this.article?.id === id && this.article.read !== read) this.article = { ...this.article, read };
        if (!this.readContext?.items.some((a) => a.id === id && a.read !== read)) return;
        this.readContext = {
            ...this.readContext,
            items: this.readContext.items.map((a) => (a.id === id ? { ...a, read } : a)),
        };
    }

    closeArticle = (dismissed = true) => {
        if (!this.article) return;
        endOpen(this.openTiming, this.article, dismissed);
        this.article = null;
        this.readContext = null;
        this.endArticleResize();
        const target = this.articleReturnFocus;
        this.articleReturnFocus = null;
        target?.focus();
    };

    private endArticleResize() {
        endArticleResize(this as never);
    }
    onArticleResizeStart = (e: PointerEvent) => {
        panelResizeStart(this as never, e);
    };
    onArticleResizeMove = (e: PointerEvent) => {
        panelResizeMove(this as never, e);
    };
    onArticleResizeEnd = (e: PointerEvent) => {
        panelResizeEnd(this as never, e);
    };
    onArticleResizeKey = (e: KeyboardEvent) => {
        panelResizeKey(this as never, e);
    };
}

declare global {
    interface HTMLElementTagNameMap {
        'app-shell': AppShell;
    }
}
