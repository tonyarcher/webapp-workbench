/**
 * Command palette registry. Pure data plus closures over the shell's
 * context; the palette component only renders and dispatches. Month one
 * ships go, filter, and act verbs; ask waits for N3 and brief triggers for
 * K1/K4.
 */
import type { ArticleSort, ListViewType, View } from '../types';
import { loadInterestingOrder, loadInterestingShadow, orderedInterestingFolderIds } from './interesting-settings';

export interface CommandContext {
    navigate(view: View): void;
    star(): void;
    markShownRead(): void;
    refresh(): void;
    setListView(view: ListViewType): void;
    setSort(sort: ArticleSort): void;
    toggleUnread(): void;
    toggleSelect(): void;
    openSettings(): void;
    openShortcuts(): void;
}

export type CommandGroup = 'go' | 'filter' | 'act';

export interface Command {
    id: string;
    title: string;
    group: CommandGroup;
    hint: string;
    /** Runs against the context captured when the command was built. */
    run(): void;
}

/** The library slice the go commands need; structurally a LibraryData. */
export interface PaletteLibrary {
    folders: Array<{ id: string; title: string }>;
    feeds: Array<{ id: string; title: string }>;
    savedSearches: Array<{
        id: string;
        title: string;
        query: string;
        scopeKind: 'all' | 'folder' | 'feed';
        scopeId?: string | undefined;
    }>;
}

export interface BuildCommandsOptions {
    /** List-only filter/act commands need an article list mounted. */
    listAvailable?: boolean;
}

export function buildCommands(
    lib: PaletteLibrary | undefined,
    ctx: CommandContext,
    options: BuildCommandsOptions = {},
): Command[] {
    const { listAvailable = true } = options;
    const commands: Command[] = [];

    const go = (id: string, title: string, run: () => void) => {
        commands.push({ id, title, group: 'go', hint: 'Go', run: () => run() });
    };

    go('all', 'All articles', () => ctx.navigate({ kind: 'all' }));
    go('frontpage', 'Front Page', () => ctx.navigate({ kind: 'frontpage' }));
    go('brief', 'Daily Brief', () => ctx.navigate({ kind: 'brief' }));
    go('today', 'Today', () => ctx.navigate({ kind: 'today' }));
    go('focus', 'Focus session', () => ctx.navigate({ kind: 'focus' }));
    go('saved', 'Saved for later', () => ctx.navigate({ kind: 'saved' }));
    go('coverage', 'Coverage balance', () => ctx.navigate({ kind: 'coverage' }));
    go('listen', 'Listen queue', () => ctx.navigate({ kind: 'listen' }));
    go('backgrounder', 'Catch me up', () => ctx.navigate({ kind: 'backgrounder' }));
    go('boards', 'Boards', () => ctx.navigate({ kind: 'boards' }));
    go('search', 'Search', () => ctx.navigate({ kind: 'search' }));
    go('settings', 'Settings', () => ctx.openSettings());
    go('settings-organize', 'Settings: Organize', () => ctx.navigate({ kind: 'settings', section: 'organize' }));
    go('settings-mute-filters', 'Settings: Mute filters', () =>
        ctx.navigate({ kind: 'settings', section: 'mute-filters' }),
    );
    go('settings-privacy', 'Settings: Privacy', () => ctx.navigate({ kind: 'settings', section: 'privacy' }));
    go('settings-stats', 'Settings: Mastery stats', () => ctx.navigate({ kind: 'settings', section: 'stats' }));
    go('settings-glossary', 'Settings: Glossary', () => ctx.navigate({ kind: 'settings', section: 'glossary' }));
    go('shortcuts', 'Keyboard shortcuts', () => ctx.openShortcuts());

    for (const folder of lib?.folders ?? []) {
        go(`folder:${folder.id}`, folder.title, () => ctx.navigate({ kind: 'folder', id: folder.id }));
    }
    for (const feed of lib?.feeds ?? []) {
        go(`feed:${feed.id}`, feed.title, () => ctx.navigate({ kind: 'feed', id: feed.id }));
    }
    const shadow = loadInterestingShadow();
    const order = loadInterestingOrder();
    const folderById = new Map((lib?.folders ?? []).map((f) => [f.id, f]));
    for (const id of orderedInterestingFolderIds(shadow, lib?.folders ?? [], order)) {
        const folder = folderById.get(id);
        if (folder)
            go(`interesting:${id}`, `Interesting in ${folder.title}`, () => ctx.navigate({ kind: 'interesting', id }));
    }
    for (const search of lib?.savedSearches ?? []) {
        go(`saved-search:${search.id}`, search.title, () =>
            ctx.navigate({
                kind: 'search',
                savedId: search.id,
                q: search.query,
                scope: search.scopeKind,
                ...(search.scopeId ? { id: search.scopeId } : {}),
            }),
        );
    }

    if (listAvailable) {
        const filter = (id: string, title: string, run: () => void) => {
            commands.push({ id, title, group: 'filter', hint: 'Filter', run: () => run() });
        };
        filter('sort-hot', 'Sort: Hot', () => ctx.setSort('hot'));
        filter('sort-newest', 'Sort: Newest', () => ctx.setSort('newest'));
        filter('sort-oldest', 'Sort: Oldest', () => ctx.setSort('oldest'));
        filter('unread-only', 'Toggle Unread only', () => ctx.toggleUnread());

        const act = (id: string, title: string, run: () => void) => {
            commands.push({ id, title, group: 'act', hint: 'Act', run: () => run() });
        };
        act('star', 'Star current article', () => ctx.star());
        act('mark-shown-read', 'Mark shown as read', () => ctx.markShownRead());
        act('refresh', 'Refresh this view', () => ctx.refresh());
        act('view-detailed', 'Detailed list view', () => ctx.setListView('detailed'));
        act('view-headline', 'Headline view', () => ctx.setListView('headline'));
        act('view-cards', 'Cards view', () => ctx.setListView('cards'));
        act('view-slideshow', 'Slideshow view', () => ctx.setListView('slideshow'));
        act('select', 'Select current article', () => ctx.toggleSelect());
    }

    return commands;
}
