import { navigate } from '../../router';
import { libraryKey, queryClient, type LibraryData } from '../../query';
import { buildCommands, type Command, type CommandContext } from '../../services/commands';
import { isModalOpen } from '../../services/modal-guard';
import { overlayShortcut } from '../../services/shortcuts';
import type { Article, View } from '../../types';
import type { ArticleView } from '../article-view/article-view';
import type { ArticleList } from '../article-list/article-list';

export function deepActiveElement(): HTMLElement | null {
    let element: Element | null = document.activeElement;
    while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
    return element instanceof HTMLElement ? element : null;
}

export interface AppShellKeyboardHost {
    route: View;
    article: Article | null;
    shortcutsOpen: boolean;
    paletteOpen: boolean;
    paletteCommands: Command[];
    paletteContext: CommandContext | null;
    readContext: { items: Article[]; index: number } | null;
    renderRoot: ShadowRoot;
    closeArticle: (dismissed?: boolean) => void;
    openAt: (index: number) => Promise<void>;
    openPalette: () => void;
}

export function openPalette(host: AppShellKeyboardHost): void {
    const lib = queryClient.getQueryData(libraryKey) as LibraryData | undefined;
    const list = host.renderRoot.querySelector<ArticleList>('article-list');
    const listAvailable =
        host.route.kind === 'all' ||
        host.route.kind === 'folder' ||
        host.route.kind === 'feed' ||
        host.route.kind === 'interesting';
    host.paletteContext = {
        navigate: (view) => navigate(view),
        star: () => list?.toggleStarCursor(),
        markShownRead: () => void list?.onMarkShownRead(),
        refresh: () => void list?.onRefresh(),
        setListView: (view) => list?.setListView(view),
        setSort: (sort) => list?.setSort(sort),
        toggleUnread: () => list?.toggleUnread(),
        toggleSelect: () => list?.toggleSelectCursor(),
        openSettings: () => navigate({ kind: 'settings', section: 'general' }),
        openShortcuts: () => {
            host.shortcutsOpen = true;
        },
    };
    host.paletteCommands = buildCommands(lib, host.paletteContext, { listAvailable });
    host.paletteOpen = true;
}

export function autoSyncFeedIds(route: View): string[] | undefined {
    const lib = queryClient.getQueryData(libraryKey) as
        { feeds?: Array<{ id: string; folderIds: string[] }> } | undefined;
    const feeds = lib?.feeds;
    if (!feeds?.length) return undefined;
    if (route.kind === 'feed') return feeds.filter((f) => f.id === route.id).map((f) => f.id);
    if (route.kind === 'folder' || route.kind === 'interesting')
        return feeds.filter((f) => f.folderIds.includes(route.id)).map((f) => f.id);
    return undefined;
}

export function handleShellKeyDown(host: AppShellKeyboardHost, e: KeyboardEvent): void {
    if (isModalOpen()) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        host.openPalette();
        return;
    }
    if (host.article && e.key === 'Escape') {
        host.closeArticle();
        return;
    }
    if (e.key === '?' && !shouldIgnoreKey()) {
        e.preventDefault();
        host.shortcutsOpen = true;
        return;
    }
    if (e.key === '/' && !shouldIgnoreKey()) {
        e.preventDefault();
        navigate({ kind: 'search' });
        return;
    }
    if (host.article && !shouldIgnoreKey()) {
        const action = overlayShortcut(e.key);
        if (action === 'star' || action === 'derank' || action === 'original') {
            e.preventDefault();
            const view = host.renderRoot.querySelector('article-view') as ArticleView | null;
            if (action === 'star') view?.keyboardStar();
            else if (action === 'derank') view?.keyboardDerank();
            else view?.keyboardOriginal();
            return;
        }
    }
    if (!host.readContext || shouldIgnoreKey()) return;
    handleNavKey(host, e);
}

function shouldIgnoreKey(): boolean {
    const active = deepActiveElement();
    const tag = active?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (active?.isContentEditable) return true;
    return !!document.querySelector('dialog[open]');
}

function handleNavKey(host: AppShellKeyboardHost, e: KeyboardEvent): void {
    if (!host.readContext) return;
    const { items, index } = host.readContext;
    if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (index < items.length - 1) void host.openAt(index + 1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (index > 0) void host.openAt(index - 1);
    } else if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        host.closeArticle();
    }
}
