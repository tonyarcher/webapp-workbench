import type { MenuAnchor } from '../feed-menu/feed-menu';
import type { View } from '../../types';
import { loadTodaySettings } from '../../services/today-settings';
import { loadInterestingOrder, loadInterestingShadow } from '../../services/interesting-settings';
import {
    loadAutoHide,
    loadCollapsed,
    loadFeedSort,
    loadHideReadByFolder,
    loadIgnoredFolders,
} from './source-list-settings';
import type { SourceList } from './source-list';

/**
 * Install a reactive accessor. Assignments request the same batched paint Lit
 * used to, so the class fields behave like the decorators they replaced.
 */
export function defineReactive<T>(host: SourceList, name: string, initial: T): void {
    let current = initial;
    Object.defineProperty(host, name, {
        configurable: true,
        enumerable: true,
        get(): T {
            return current;
        },
        set(next: T): void {
            if (Object.is(current, next)) return;
            const previous = current;
            current = next;
            host.requestUpdate(name, previous);
        },
    });
}

/** Boolean properties that mirror onto their attribute, as `reflect: true` did. */
export function reflectAttribute(element: HTMLElement, name: string, on: boolean): void {
    if (on) element.setAttribute(name, '');
    else element.removeAttribute(name);
}

/** View and library state, all reactive. */
export function initViewState(host: SourceList): void {
    defineReactive(host, 'view', { kind: 'all' } satisfies View);
    defineReactive(host, 'autoHide', loadAutoHide());
    defineReactive(host, 'hover', false);
    defineReactive(host, 'collapsed', loadCollapsed());
    defineReactive(host, 'feedSort', loadFeedSort());
    defineReactive(host, 'hideReadByFolder', loadHideReadByFolder());
    defineReactive(host, 'ignoredFolders', loadIgnoredFolders());
    defineReactive(host, 'interestingShadow', loadInterestingShadow());
    defineReactive(host, 'interestingOrder', loadInterestingOrder());
    defineReactive(host, 'todaySettings', loadTodaySettings());
}

/** Open/anchor state for the five menus, all reactive. */
export function initMenuState(host: SourceList): void {
    defineReactive(host, 'feedListMenuOpen', false);
    defineReactive(host, 'feedListMenuAnchor', null as MenuAnchor | null);
    defineReactive(host, 'menuOpen', false);
    defineReactive(host, 'menuFeedId', null as string | null);
    defineReactive(host, 'menuAnchor', null as MenuAnchor | null);
    defineReactive(host, 'folderMenuOpen', false);
    defineReactive(host, 'folderMenuFolderId', null as string | null);
    defineReactive(host, 'folderMenuAnchor', null as MenuAnchor | null);
    defineReactive(host, 'savedSearchMenuOpen', false);
    defineReactive(host, 'savedSearchMenuId', null as string | null);
    defineReactive(host, 'savedSearchMenuAnchor', null as MenuAnchor | null);
    defineReactive(host, 'todayMenuOpen', false);
    defineReactive(host, 'todayMenuAnchor', null as MenuAnchor | null);
}
