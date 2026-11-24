import { articleLink, history, navigate, parseArticleId, parsePath, viewToPath } from '../../router';
import type { Command, CommandContext } from '../../services/commands';
import { dismissToast, onToast, type ToastNotice } from '../../services/toast';
import { startInterestingCountsRefresh, stopInterestingCountsRefresh } from '../../services/interesting-counts-refresh';
import { startForegroundSync, stopForegroundSync } from '../../services/foreground-sync';
import { currentUsername, hasSession } from '../../services/auth';
import { fetchArticleById } from '../../services/api';
import { sharedLinkFromParams } from '../../services/shared-links';
import type { ArticleList } from '../article-list/article-list';
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
import { ShellDom } from './app-shell-render';
import type { Article, View } from '../../types';
import '../settings-view/settings-view';
import '../saved-view/saved-view';
import '../backgrounder-view/backgrounder-view';
import '../listen-view/listen-view';
import '../coverage-view/coverage-view';
import '../health-view/health-view';
import '../account-menu/account-menu';
import '../boards-view/boards-view';
import '../board-view/board-view';
import '../focus-view/focus-view';
import '../shortcuts-dialog/shortcuts-dialog';
import '../command-palette/command-palette';
import styles from './app-shell.css?inline';

/** Install a reactive accessor. Assignments request the same batched paint Lit used to. */
function defineReactive<T>(host: AppShell, name: string, initial: T): void {
    let current = initial;
    Object.defineProperty(host, name, {
        configurable: true,
        enumerable: true,
        get(): T {
            return current;
        },
        set(next: T): void {
            if (Object.is(current, next)) return;
            current = next;
            host.requestUpdate(name);
        },
    });
}

/**
 * Vanilla custom element: state, lifecycle, and thin delegators. Behavior lives
 * in the sibling `app-shell-*` modules, each receiving the element as an
 * explicitly typed host (`this as never`). DOM is built once by `ShellDom`,
 * which updates it in place; no template literal or html tag is involved.
 */
export class AppShell extends HTMLElement {
    declare route: View;
    declare article: Article | null;
    declare deepLinkArticleId: string | null;
    declare shortcutsOpen: boolean;
    declare paletteOpen: boolean;
    declare paletteCommands: Command[];
    declare resume: { view: string; id: string } | null;
    declare authed: boolean;
    declare username: string | null;
    declare authError: string;
    declare toasts: ToastNotice[];
    declare articleWidth: number;

    articleReturnFocus: HTMLElement | null = null;
    paletteContext: CommandContext | null = null;
    toastTimers = new Map<number, ReturnType<typeof setTimeout>>();
    readContext: { items: Article[]; index: number } | null = null;
    articleResizing = false;
    articleResizeHandleEl: HTMLElement | null = null;
    articleResizeStart: { x: number; width: number; pointerId: number } | null = null;

    readonly renderRoot: ShadowRoot;
    private shell: ShellDom | null = null;
    private unsubscribe?: () => void;
    private unsubscribeToasts: (() => void) | null = null;
    private openTiming: OpenTiming = initialOpenTiming();
    private updatePending = false;
    private updatePromise: Promise<boolean> = Promise.resolve(true);
    private resolveUpdate: ((value: boolean) => void) | null = null;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        this.renderRoot = shadow;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(styles);
        shadow.adoptedStyleSheets = [sheet];
        defineReactive(this, 'route', { kind: 'all' } satisfies View);
        defineReactive(this, 'article', null as Article | null);
        defineReactive(this, 'deepLinkArticleId', parseArticleId(history.location.search));
        defineReactive(this, 'shortcutsOpen', false);
        defineReactive(this, 'paletteOpen', false);
        defineReactive(this, 'paletteCommands', [] as Command[]);
        defineReactive(this, 'resume', null as { view: string; id: string } | null);
        defineReactive(this, 'authed', hasSession());
        defineReactive(this, 'username', currentUsername());
        defineReactive(this, 'authError', '');
        defineReactive(this, 'toasts', [] as ToastNotice[]);
        defineReactive(this, 'articleWidth', loadArticlePanelWidth());
    }

    requestUpdate(_name?: string, _oldValue?: unknown): void {
        if (this.updatePending || !this.isConnected) return;
        this.updatePending = true;
        this.updatePromise = new Promise((resolve) => {
            this.resolveUpdate = resolve;
        });
        queueMicrotask(() => this.performUpdate());
    }

    get updateComplete(): Promise<boolean> {
        return this.updatePromise;
    }

    private performUpdate(): void {
        if (!this.updatePending) return;
        this.updatePending = false;
        if (!this.isConnected) {
            this.resolveUpdate?.(true);
            this.resolveUpdate = null;
            return;
        }
        if (!this.shell) this.shell = new ShellDom(this.renderRoot, this as never);
        this.shell.render();
        this.resolveUpdate?.(true);
        this.resolveUpdate = null;
    }

    connectedCallback() {
        this.adoptSharedLink();
        this.route = parsePath(history.location.pathname, history.location.search);
        this.deepLinkArticleId = parseArticleId(history.location.search);
        this.unsubscribe = history.subscribe(({ location }) => {
            const nextRoute = parsePath(location.pathname, location.search);
            const nextArticleId = parseArticleId(location.search);
            const routeChanged = JSON.stringify(nextRoute) !== JSON.stringify(this.route);
            const articleTargetChanged = nextArticleId !== this.deepLinkArticleId && nextArticleId !== this.article?.id;
            this.route = nextRoute;
            this.deepLinkArticleId = nextArticleId;
            if (routeChanged || articleTargetChanged) this.closeArticle(false, false);
            if (routeChanged) this.resume = null;
            void this.resolveDeepLink();
        });
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('times-up-auth-required', this.onAuthRequired);
        window.addEventListener('times-up-auth-changed', this.onAuthChanged);
        window.addEventListener('times-up-auth-error', this.onAuthErrorEv);
        window.addEventListener('show-shortcuts', this.onShowShortcuts);
        window.addEventListener('article-read', this.onArticleReadSync);
        window.addEventListener('search-query', this.onSearchQuery);
        this.unsubscribeToasts = onToast((notices) => {
            this.toasts = notices;
            syncToastTimersAuth(this as never, dismissToast);
        });
        if (this.authed) {
            startInterestingCountsRefresh();
            startForegroundSync(this.autoSyncFeedIds);
            void this.resolveDeepLink();
        }
        this.requestUpdate();
    }

    private adoptSharedLink(): void {
        const shared = sharedLinkFromParams(new URLSearchParams(window.location.search));
        if (!shared) return;
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`);
        history.replace(viewToPath({ kind: 'shared', ...shared }));
    }

    disconnectedCallback() {
        stopInterestingCountsRefresh();
        stopForegroundSync();
        this.unsubscribeToasts?.();
        this.unsubscribeToasts = null;
        this.endArticleResize();
        for (const timer of this.toastTimers.values()) clearTimeout(timer);
        this.toastTimers.clear();
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('times-up-auth-required', this.onAuthRequired);
        window.removeEventListener('times-up-auth-changed', this.onAuthChanged);
        window.removeEventListener('times-up-auth-error', this.onAuthErrorEv);
        window.removeEventListener('show-shortcuts', this.onShowShortcuts);
        window.removeEventListener('article-read', this.onArticleReadSync);
        window.removeEventListener('search-query', this.onSearchQuery);
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
        void this.resolveDeepLink();
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

    private onKeyDown = (e: KeyboardEvent) => {
        handleShellKeyDown(this as never, e);
    };

    async openAt(index: number) {
        if (!this.readContext) return;
        const article = this.readContext.items[index];
        if (!article) return;
        this.showArticle(article, this.readContext.items, index);
    }

    private showArticle(article: Article, items: Article[], index: number): void {
        this.readContext = { items, index };
        this.articleReturnFocus = deepActiveElement();
        trackOpen(this.openTiming, this.article, article);
        this.article = article;
        this.resume = { view: JSON.stringify(this.route), id: article.id };
        this.syncArticleUrl(article.id);
        void markOpenedRead(article, (id) => this.syncReadState(id, 1));
    }

    private async resolveDeepLink(): Promise<void> {
        const id = this.deepLinkArticleId;
        if (!id || !this.authed || this.article) return;
        try {
            const article = await fetchArticleById(id);
            if (!this.isConnected || !this.authed || this.deepLinkArticleId !== id || this.article) return;
            await this.updateComplete;
            if (!this.isConnected || !this.authed || this.deepLinkArticleId !== id || this.article) return;
            const list = this.renderRoot.querySelector<ArticleList>('article-list');
            if (list) list.revealArticle(article);
            else this.showArticle(article, [article], 0);
        } catch {
            // The list may still contain the row. If not, the link is unavailable.
        }
    }

    private syncArticleUrl(articleId: string | null): void {
        const path = articleId ? articleLink(this.route, articleId) : viewToPath(this.route);
        if (`${history.location.pathname}${history.location.search}` !== path) history.replace(path);
    }

    private onSearchQuery = (e: Event): void => {
        const q = (e as CustomEvent<{ q: string }>).detail.q;
        if (this.route.kind !== 'search') return;
        navigate({ ...this.route, q }, true);
    };

    onOpenArticle = (e: Event) => {
        const detail = (e as CustomEvent<{ article: Article; index: number; items: Article[] }>).detail;
        this.showArticle(detail.article, detail.items, detail.index);
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

    closeArticle = (dismissed = true, updateUrl = true) => {
        if (this.article) {
            endOpen(this.openTiming, this.article, dismissed);
            this.article = null;
            this.readContext = null;
            this.endArticleResize();
            const target = this.articleReturnFocus;
            this.articleReturnFocus = null;
            target?.focus();
        }
        if (updateUrl && parseArticleId(history.location.search)) this.syncArticleUrl(null);
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

customElements.define('app-shell', AppShell);

declare global {
    interface HTMLElementTagNameMap {
        'app-shell': AppShell;
    }
}
