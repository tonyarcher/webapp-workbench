import type { MenuAnchor } from '../feed-menu/feed-menu';
import { setSearchQuery, setSearchScope, type SearchHost } from './article-list-search';

export function onSearchQueryAction(host: SearchHost, q: string): void {
    setSearchQuery(host, q);
}

export function onSearchScopeAction(host: SearchHost, scope: string): void {
    setSearchScope(host, scope);
}

/** Advanced-menu surface: anchor placement and the two persisted toggles. */
export interface AdvancedHost {
    advancedOpen: boolean;
    advancedAnchor: MenuAnchor | null;
    unreadOnly: boolean;
    markOnScroll: boolean;
    saveViewSettings(): void;
}

export function toggleAdvancedAction(host: AdvancedHost, e: Event): void {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    host.advancedAnchor = { x: rect.right, y: rect.bottom + 6 };
    host.advancedOpen = !host.advancedOpen;
}

export function advancedUnreadAction(
    host: AdvancedHost & { view?: { kind: string }; hideRead?: boolean; reset?: () => Promise<void> },
    e: Event,
): void {
    const next = (e as CustomEvent<boolean>).detail;
    if (host.view?.kind === 'interesting') {
        // Interesting ranks a bounded recent batch; server-side unreadOnly starves it.
        host.hideRead = next;
        host.saveViewSettings();
        void host.reset?.();
        return;
    }
    host.unreadOnly = next;
    host.saveViewSettings();
}

export function advancedMarkScrollAction(host: AdvancedHost, e: Event): void {
    host.markOnScroll = (e as CustomEvent<boolean>).detail;
    host.saveViewSettings();
}
