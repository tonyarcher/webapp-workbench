import { navigate } from '../../router';
import { dismissToast, type ToastNotice } from '../../services/toast';
import { MAX_ARTICLE_PANEL_WIDTH, MIN_ARTICLE_PANEL_WIDTH } from './article-panel-settings';
import type { Article, View } from '../../types';

/**
 * State and handlers the shell DOM reads. The element passes itself, so every
 * assignment (settings gear, dialog close) goes back through its setters.
 */
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

interface DialogElement extends HTMLElement {
    open: boolean;
}
interface SettingsElement extends DialogElement {
    view: View;
}
interface PaletteElement extends DialogElement {
    commands: unknown[];
}
interface ArticleListElement extends HTMLElement {
    view: View;
    active: boolean;
    resumeArticleId: string | null;
}
interface SearchViewElement extends HTMLElement {
    view: View;
}
interface BoardViewElement extends HTMLElement {
    boardId: string;
}
interface ArticleViewElement extends HTMLElement {
    article: Article | null;
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
    frontpage: 'front-page',
    focus: 'focus-view',
    organize: 'organize-view',
    'mute-filters': 'mute-filters-view',
    saved: 'saved-view',
    backgrounder: 'backgrounder-view',
    listen: 'listen-view',
    glossary: 'glossary-view',
    coverage: 'coverage-view',
    stats: 'stats-view',
    boards: 'boards-view',
    board: 'board-view',
    search: 'search-view',
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
        ['circle', { cx: '6', cy: '18', r: '2', fill: 'currentColor' }],
        [
            'path',
            {
                d: 'M4 4a16 16 0 0 1 16 16',
                stroke: 'currentColor',
                'stroke-width': '2',
                fill: 'none',
                'stroke-linecap': 'round',
            },
        ],
        [
            'path',
            {
                d: 'M4 11a9 9 0 0 1 9 9',
                stroke: 'currentColor',
                'stroke-width': '2',
                fill: 'none',
                'stroke-linecap': 'round',
            },
        ],
    ]);
}

function gearIcon(): SVGElement {
    return svg({ viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
        [
            'path',
            {
                d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.7',
            },
        ],
        [
            'path',
            {
                d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
                fill: 'none',
                stroke: 'currentColor',
                'stroke-width': '1.5',
            },
        ],
    ]);
}

function brandButton(): HTMLButtonElement {
    const brand = el('button', 'brand-link');
    const heading = el('h1');
    heading.textContent = 'RSS Reader';
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
    who: HTMLElement;
    signOut: HTMLButtonElement;
}

function buildHeader(host: AppShellRenderHost): HeaderNodes {
    const header = el('header');
    const who = el('span', 'who');
    const signOut = el('button', 'signout');
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => host.onSignOut());
    header.append(
        brandButton(),
        el('div', 'spacer'),
        who,
        signOut,
        buildHelpButton(host),
        buildPaletteTrigger(host),
        buildGearButton(host),
    );
    return { root: header, who, signOut };
}

function buildHelpButton(host: AppShellRenderHost): HTMLButtonElement {
    const help = el('button', 'gear help');
    help.title = 'Keyboard shortcuts (?)';
    help.setAttribute('aria-label', 'Keyboard shortcuts (?)');
    help.textContent = '?';
    help.addEventListener('click', () => host.onShowShortcuts());
    return help;
}

function buildPaletteTrigger(host: AppShellRenderHost): HTMLButtonElement {
    const trigger = el('button', 'palette-search-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Search commands Ctrl+K');
    trigger.title = 'Command palette (Ctrl+K)';
    const text = el('span', 'palette-search-text');
    text.textContent = 'Search commands';
    const hint = el('kbd', 'palette-search-hint');
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = 'Ctrl+K';
    trigger.append(text, hint);
    trigger.addEventListener('click', () => host.openPalette());
    return trigger;
}

function buildGearButton(host: AppShellRenderHost): HTMLButtonElement {
    const gear = el('button', 'gear');
    gear.title = 'Settings';
    gear.appendChild(gearIcon());
    gear.addEventListener('click', () => {
        host.settingsOpen = true;
    });
    return gear;
}

interface DialogNodes {
    settings: SettingsElement;
    shortcuts: DialogElement;
    palette: PaletteElement;
    toasts: HTMLElement;
}

function buildDialogs(host: AppShellRenderHost): DialogNodes {
    const settings = document.createElement('settings-dialog') as SettingsElement;
    const shortcuts = document.createElement('shortcuts-dialog') as DialogElement;
    const palette = document.createElement('command-palette') as PaletteElement;
    settings.addEventListener('close', () => {
        host.settingsOpen = false;
    });
    shortcuts.addEventListener('close', () => {
        host.shortcutsOpen = false;
    });
    palette.addEventListener('close', () => {
        host.paletteOpen = false;
    });
    palette.addEventListener('run', host.onRunCommand);
    const toasts = el('div', 'toasts');
    toasts.setAttribute('role', 'status');
    return { settings, shortcuts, palette, toasts };
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
            this.dialogs.settings,
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
            this.dialogs.settings,
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
        const username = this.host.username;
        const signedIn = username !== null && username !== '';
        this.header.who.textContent = username ?? '';
        display(this.header.who, signedIn);
        display(this.header.signOut, signedIn);
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
        else if (tag === 'search-view') this.updateSearchView(view, route);
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
    }

    private updateSearchView(view: HTMLElement, route: View): void {
        const search = view as SearchViewElement;
        if (search.view !== route) search.view = route;
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
        const { settings, shortcuts, palette } = this.dialogs;
        if (settings.open !== host.settingsOpen) settings.open = host.settingsOpen;
        if (settings.view !== host.route) settings.view = host.route;
        if (shortcuts.open !== host.shortcutsOpen) shortcuts.open = host.shortcutsOpen;
        if (palette.open !== host.paletteOpen) palette.open = host.paletteOpen;
        if (palette.commands !== host.paletteCommands) palette.commands = host.paletteCommands;
    }
}
