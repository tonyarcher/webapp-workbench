import { navigate } from '../../router';
import type { AccountMenuHost } from '../account-menu/account-menu';
import type { MenuAnchor } from '../menu-popover';
import { requestAddFeed } from '../../services/add-feed-intent';
import type { SharedLink } from '../../services/shared-links';
import { dismissToast, type ToastNotice } from '../../services/toast';
import { MAX_ARTICLE_PANEL_WIDTH, MIN_ARTICLE_PANEL_WIDTH } from './article-panel-settings';
import type { Article, SettingsSection, View } from '../../types';

/**
 * State and handlers the shell DOM reads. The element passes itself, so every
 * assignment (dialogs, toasts) goes back through its setters.
 */
export interface AppShellRenderHost {
    authed: boolean;
    route: View;
    article: Article | null;
    readContext: { items: Article[]; index: number } | null;
    deepLinkArticleId: string | null;
    shortcutsOpen: boolean;
    paletteOpen: boolean;
    paletteCommands: unknown[];
    resume: { view: string; id: string } | null;
    username: string | null;
    authError: string;
    toasts: ToastNotice[];
    articleWidth: number;
    onOpenArticle: (e: Event) => void;
    onOpenClusterMember: (e: Event) => void;
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

interface DialogElement extends HTMLElement {
    open: boolean;
}
interface PaletteElement extends DialogElement {
    commands: unknown[];
}
interface ArticleListElement extends HTMLElement {
    view: View;
    active: boolean;
    resumeArticleId: string | null;
    deepLinkArticleId: string | null;
}
interface SettingsViewElement extends HTMLElement {
    section: SettingsSection;
}
interface SharedViewElement extends HTMLElement {
    link: SharedLink | null;
}
interface BoardViewElement extends HTMLElement {
    boardId: string;
}
interface ArticleViewElement extends HTMLElement {
    article: Article | null;
    relatedCorpus: Article[];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The element each route kind mounts inside `main`. */
const VIEW_TAGS: Record<View['kind'], string> = {
    all: 'article-list',
    folder: 'article-list',
    interesting: 'article-list',
    feed: 'article-list',
    brief: 'brief-view',
    today: 'today-view',
    alerts: 'alerts-view',
    frontpage: 'front-page',
    focus: 'focus-view',
    settings: 'settings-view',
    saved: 'saved-view',
    shared: 'shared-view',
    backgrounder: 'backgrounder-view',
    listen: 'listen-view',
    coverage: 'coverage-view',
    health: 'health-view',
    boards: 'boards-view',
    board: 'board-view',
    search: 'article-list',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className !== undefined) node.className = className;
    return node;
}

function display(node: HTMLElement, visible: boolean): void {
    node.style.display = visible ? '' : 'none';
}

/** Build an SVG glyph from literal attributes and literal child shapes. */
function svg(attrs: Record<string, string>, shapes: Array<[string, Record<string, string>]>): SVGElement {
    const root = document.createElementNS(SVG_NS, 'svg');
    for (const [name, value] of Object.entries(attrs)) root.setAttribute(name, value);
    for (const [tag, shape] of shapes) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [name, value] of Object.entries(shape)) node.setAttribute(name, value);
        root.appendChild(node);
    }
    return root;
}

function logoIcon(): SVGElement {
    return svg({ class: 'logo', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
        ['rect', { x: '1.5', y: '1.5', width: '21', height: '21', rx: '5.5', fill: 'currentColor', opacity: '0.15' }],
        [
            'path',
            { d: 'M8.4 6.5h7.2', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' },
        ],
        [
            'path',
            { d: 'M12 4.7v1.8', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' },
        ],
        [
            'path',
            {
                d: 'M16.1 7.6l1.3-1.3',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                fill: 'none',
            },
        ],
        ['circle', { cx: '12', cy: '13.5', r: '5.5', stroke: 'currentColor', 'stroke-width': '2', fill: 'none' }],
        [
            'path',
            {
                d: 'M12 10.6v2.9l2.1 1.4',
                stroke: 'currentColor',
                'stroke-width': '2',
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                fill: 'none',
            },
        ],
    ]);
}

function brandButton(): HTMLButtonElement {
    const brand = el('button', 'brand-link');
    const heading = el('h1');
    heading.textContent = 'Times Up';
    const sub = el('span', 'sub');
    sub.textContent = 'your feeds, in one place';
    brand.append(logoIcon(), heading, sub);
    brand.addEventListener('click', () => navigate({ kind: 'all' }));
    return brand;
}

interface SignInNodes {
    header: HTMLElement;
    main: HTMLElement;
    error: HTMLElement;
}

function buildSignIn(host: AppShellRenderHost): SignInNodes {
    const header = el('header');
    header.appendChild(brandButton());
    const main = el('main', 'signin');
    const card = el('div', 'signin-card');
    const title = el('h2');
    title.textContent = 'Sign in to read';
    const copy = el('p', 'muted');
    copy.textContent = 'Your feeds live in your account. Sign in with the workbench identity service to continue.';
    const primary = el('button', 'primary');
    primary.textContent = 'Sign in';
    primary.addEventListener('click', () => host.onSignIn());
    const error = el('p', 'error');
    card.append(title, copy, primary, error);
    main.appendChild(card);
    return { header, main, error };
}

interface HeaderNodes {
    root: HTMLElement;
    account: HTMLElement & {
        host: AccountMenuHost;
        open: boolean;
        anchor: MenuAnchor | null;
    };
}

function buildHeader(_host: AppShellRenderHost): HeaderNodes {
    const header = el('header');
    const account = document.createElement('account-menu') as HeaderNodes['account'];
    account.addEventListener('open-account', ((e: CustomEvent<MenuAnchor>) => {
        account.anchor = e.detail;
        account.open = !account.open;
    }) as EventListener);
    account.addEventListener('close', () => {
        account.open = false;
    });
    header.append(brandButton(), el('div', 'spacer'), buildSearchButton(), buildAddFeedButton(), account);
    return { root: header, account };
}

function buildSearchButton(): HTMLButtonElement {
    const button = el('button', 'gear search-nav');
    button.type = 'button';
    button.title = 'Search';
    button.setAttribute('aria-label', 'Search');
    button.textContent = '🔎';
    button.addEventListener('click', () => navigate({ kind: 'search' }));
    return button;
}

function buildAddFeedButton(): HTMLButtonElement {
    const button = el('button', 'add-feed');
    button.type = 'button';
    button.title = 'Add feed';
    button.setAttribute('aria-label', 'Add feed');
    const plus = el('span', 'add-feed-plus');
    plus.textContent = '+';
    const text = el('span', 'add-feed-text');
    text.textContent = 'Add feed';
    button.append(plus, text);
    button.addEventListener('click', () => requestAddFeed());
    return button;
}

interface DialogNodes {
    shortcuts: DialogElement;
    palette: PaletteElement;
    toasts: HTMLElement;
}

function buildDialogs(host: AppShellRenderHost): DialogNodes {
    const shortcuts = document.createElement('shortcuts-dialog') as DialogElement;
    const palette = document.createElement('command-palette') as PaletteElement;
    shortcuts.addEventListener('close', () => {
        host.shortcutsOpen = false;
    });
    palette.addEventListener('close', () => {
        host.paletteOpen = false;
    });
    palette.addEventListener('run', host.onRunCommand);
    const toasts = el('div', 'toasts');
    toasts.setAttribute('role', 'status');
    return { shortcuts, palette, toasts };
}

function attachBoardId(node: HTMLElement, route: View): void {
    const id = route.kind === 'board' ? route.id : '';
    node.setAttribute('board-id', id);
    (node as BoardViewElement).boardId = id;
}

/**
 * Builds the shell's DOM once and then updates it in place. The active main
 * view, the overlay, and the dialogs keep their element instances across
 * unrelated state changes, so list scroll position and dialog state survive
 * toasts, an open article, and a route change within the same view kind.
 */
export class ShellDom {
    private readonly host: AppShellRenderHost;
    private readonly signIn: SignInNodes;
    private readonly header: HeaderNodes;
    private readonly layout: HTMLElement;
    private readonly sourceList: HTMLElement & { view: View };
    private readonly main: HTMLElement;
    private readonly dialogs: DialogNodes;

    private authedShown: boolean | null = null;
    private view: HTMLElement | null = null;
    private viewKey = '';
    private overlay: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private handle: HTMLElement | null = null;
    private articleView: ArticleViewElement | null = null;
    private toastKey = '';

    constructor(shadow: ShadowRoot, host: AppShellRenderHost) {
        this.host = host;
        this.signIn = buildSignIn(host);
        this.header = buildHeader(host);
        this.sourceList = document.createElement('source-list') as HTMLElement & { view: View };
        this.main = el('main');
        this.layout = el('div', 'layout');
        this.layout.append(this.sourceList, this.main);
        this.dialogs = buildDialogs(host);
        shadow.append(
            this.signIn.header,
            this.signIn.main,
            this.header.root,
            this.layout,
            this.dialogs.shortcuts,
            this.dialogs.palette,
            this.dialogs.toasts,
        );
    }

    render(): void {
        const host = this.host;
        this.showAuthed(host.authed);
        if (!host.authed) {
            this.signIn.error.textContent = host.authError;
            display(this.signIn.error, host.authError !== '');
            return;
        }
        this.renderHeader();
        this.renderMain();
        this.renderOverlay();
        this.renderToasts();
        this.renderDialogs();
    }

    private showAuthed(authed: boolean): void {
        if (this.authedShown === authed) return;
        this.authedShown = authed;
        display(this.signIn.header, !authed);
        display(this.signIn.main, !authed);
        const shell = [
            this.header.root,
            this.layout,
            this.dialogs.shortcuts,
            this.dialogs.palette,
            this.dialogs.toasts,
        ];
        for (const node of shell) display(node, authed);
        if (!authed) this.unmountView();
    }

    /** Drop the signed-in content, as the sign-in template branch used to. */
    private unmountView(): void {
        this.view?.remove();
        this.view = null;
        this.viewKey = '';
        this.removeOverlay();
    }

    private renderHeader(): void {
        this.header.account.host = {
            username: this.host.username,
            openPalette: () => this.host.openPalette(),
            onShowShortcuts: () => this.host.onShowShortcuts(),
            onSignOut: () => this.host.onSignOut(),
        };
    }

    private renderMain(): void {
        const route = this.host.route;
        if (this.sourceList.view !== route) this.sourceList.view = route;
        this.mountView(route);
    }

    private mountView(route: View): void {
        const tag = VIEW_TAGS[route.kind];
        this.ensureView(route, tag);
        const view = this.view;
        if (!view) return;
        if (tag === 'article-list') this.updateArticleList(view, route);
        else if (tag === 'settings-view') this.updateSettingsView(view, route);
        else if (tag === 'shared-view') this.updateSharedView(view, route);
    }

    /** Reuse the mounted view unless the route needs a different element. */
    private ensureView(route: View, tag: string): void {
        const key = route.kind === 'board' ? `${tag}|${route.id}` : tag;
        if (this.view && this.viewKey === key) return;
        const next = document.createElement(tag);
        next.addEventListener('open-article', this.host.onOpenArticle);
        if (tag === 'board-view') attachBoardId(next, route);
        if (this.view) this.main.replaceChild(next, this.view);
        else this.main.insertBefore(next, this.overlay);
        this.view = next;
        this.viewKey = key;
    }

    private updateArticleList(view: HTMLElement, route: View): void {
        const list = view as ArticleListElement;
        if (list.view !== route) list.view = route;
        const active = !this.host.article;
        if (list.active !== active) list.active = active;
        const resume = this.host.resume;
        const resumeArticleId = resume && JSON.stringify(route) === resume.view ? resume.id : null;
        if (list.resumeArticleId !== resumeArticleId) list.resumeArticleId = resumeArticleId;
        const deepLinkArticleId = this.host.article ? null : this.host.deepLinkArticleId;
        if (list.deepLinkArticleId !== deepLinkArticleId) list.deepLinkArticleId = deepLinkArticleId;
    }

    private updateSettingsView(view: HTMLElement, route: View): void {
        if (route.kind !== 'settings') return;
        const settings = view as SettingsViewElement;
        if (settings.section !== route.section) settings.section = route.section;
    }

    private updateSharedView(view: HTMLElement, route: View): void {
        if (route.kind !== 'shared') return;
        const shared = view as SharedViewElement;
        const next: SharedLink | null = route.url
            ? {
                  url: route.url,
                  ...(route.title ? { title: route.title } : {}),
                  ...(route.text ? { text: route.text } : {}),
              }
            : null;
        if (JSON.stringify(shared.link) !== JSON.stringify(next)) shared.link = next;
    }

    private renderOverlay(): void {
        const article = this.host.article;
        if (!article) {
            this.removeOverlay();
            return;
        }
        if (!this.overlay) this.createOverlay();
        const panel = this.panel;
        const handle = this.handle;
        const articleView = this.articleView;
        if (!panel || !handle || !articleView) return;
        const width = `${Math.round(this.host.articleWidth)}px`;
        if (panel.style.getPropertyValue('--article-width') !== width)
            panel.style.setProperty('--article-width', width);
        if (handle.getAttribute('aria-valuenow') !== String(Math.round(this.host.articleWidth))) {
            handle.setAttribute('aria-valuenow', String(Math.round(this.host.articleWidth)));
        }
        articleView.relatedCorpus = this.host.readContext?.items ?? [];
        if (articleView.article !== article) articleView.article = article;
    }

    private removeOverlay(): void {
        if (!this.overlay) return;
        this.overlay.remove();
        this.overlay = null;
        this.panel = null;
        this.handle = null;
        this.articleView = null;
    }

    private createOverlay(): void {
        const overlay = el('div', 'article-overlay');
        // pointer-only: the backdrop is a click-outside affordance, not the way
        // out. article-view has a visible Back button and Escape closes it, so
        // a keyboard user is not trapped here.
        const backdrop = el('div', 'article-backdrop');
        backdrop.addEventListener('click', () => this.host.closeArticle());
        overlay.append(backdrop, this.createPanel());
        this.main.appendChild(overlay);
        this.overlay = overlay;
    }

    private createPanel(): HTMLElement {
        const host = this.host;
        const panel = el('div', 'article-panel');
        panel.style.setProperty('--article-width', `${Math.round(host.articleWidth)}px`);
        const handle = this.createResizeHandle();
        const articleView = document.createElement('article-view') as ArticleViewElement;
        articleView.addEventListener('close', () => host.closeArticle());
        articleView.addEventListener('open-article', host.onOpenArticle);
        articleView.addEventListener('open-cluster-member', host.onOpenClusterMember);
        articleView.article = host.article;
        panel.append(handle, articleView);
        this.panel = panel;
        this.handle = handle;
        this.articleView = articleView;
        return panel;
    }

    private createResizeHandle(): HTMLElement {
        const host = this.host;
        const handle = el('div', 'article-panel-handle');
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.setAttribute('aria-label', 'Resize article panel');
        handle.setAttribute('aria-valuenow', String(Math.round(host.articleWidth)));
        handle.setAttribute('aria-valuemin', String(MIN_ARTICLE_PANEL_WIDTH));
        handle.setAttribute('aria-valuemax', String(MAX_ARTICLE_PANEL_WIDTH));
        handle.setAttribute('tabindex', '0');
        handle.title = 'Drag to resize';
        handle.addEventListener('pointerdown', host.onArticleResizeStart);
        handle.addEventListener('pointermove', host.onArticleResizeMove);
        handle.addEventListener('pointerup', host.onArticleResizeEnd);
        handle.addEventListener('pointercancel', host.onArticleResizeEnd);
        handle.addEventListener('keydown', host.onArticleResizeKey);
        const grip = el('span', 'article-panel-grip');
        grip.setAttribute('aria-hidden', 'true');
        handle.appendChild(grip);
        return handle;
    }

    private renderToasts(): void {
        const notices = this.host.toasts;
        const key = notices.map((notice) => `${notice.id}\u0000${notice.kind}\u0000${notice.message}`).join('\u0001');
        if (key === this.toastKey) return;
        this.toastKey = key;
        const buttons = notices.map((notice) => {
            const node = el('button', notice.kind === 'info' ? 'toast toast-info' : 'toast');
            node.textContent = notice.message;
            node.addEventListener('click', () => dismissToast(notice.id));
            return node;
        });
        this.dialogs.toasts.replaceChildren(...buttons);
    }

    private renderDialogs(): void {
        const host = this.host;
        const { shortcuts, palette } = this.dialogs;
        if (shortcuts.open !== host.shortcutsOpen) shortcuts.open = host.shortcutsOpen;
        if (palette.open !== host.paletteOpen) palette.open = host.paletteOpen;
        if (palette.commands !== host.paletteCommands) palette.commands = host.paletteCommands;
    }
}
