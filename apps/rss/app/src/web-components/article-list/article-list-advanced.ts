import type { MenuAnchor } from '../feed-menu/feed-menu';

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

export function advancedUnreadAction(host: AdvancedHost, e: Event): void {
    host.unreadOnly = (e as CustomEvent<boolean>).detail;
    host.saveViewSettings();
}

export function advancedMarkScrollAction(host: AdvancedHost, e: Event): void {
    host.markOnScroll = (e as CustomEvent<boolean>).detail;
    host.saveViewSettings();
}
