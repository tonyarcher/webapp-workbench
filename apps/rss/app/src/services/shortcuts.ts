/**
 * Keyboard shortcuts, centralized so the cheatsheet, the handlers, and the
 * smoke tests all read the same table. `?` is the literal key (shift+/ on
 * most layouts). Handlers ignore these while typing or while a native
 * dialog is open; that guard lives with each handler, not here.
 */

export type ListShortcut =
    'star' | 'unread' | 'refresh' | 'view-detailed' | 'view-headline' | 'view-cards' | 'select' | 'help';

export type OverlayShortcut = 'star' | 'derank' | 'original' | 'help';

/** Single-key action for the article list, or null when the key is not ours. */
export function listShortcut(key: string): ListShortcut | null {
    switch (key) {
        case 's':
            return 'star';
        case 'u':
            return 'unread';
        case 'r':
            return 'refresh';
        case '1':
            return 'view-detailed';
        case '2':
            return 'view-headline';
        case '3':
            return 'view-cards';
        case 'x':
            return 'select';
        case '?':
            return 'help';
        default:
            return null;
    }
}

/** Single-key action for the open article overlay, or null when not ours. */
export function overlayShortcut(key: string): OverlayShortcut | null {
    switch (key) {
        case 's':
            return 'star';
        case 'd':
            return 'derank';
        case 'o':
            return 'original';
        case '?':
            return 'help';
        default:
            return null;
    }
}

export interface ShortcutHelp {
    keys: string;
    action: string;
}

export const LIST_SHORTCUTS_HELP: ShortcutHelp[] = [
    { keys: 'j / k', action: 'Next / previous article (opens it)' },
    { keys: 's', action: 'Star / unstar the current article' },
    { keys: 'x', action: 'Select / deselect the current article' },
    { keys: 'Shift+click', action: 'Select a range of articles' },
    { keys: 'u', action: 'Toggle Unread only' },
    { keys: 'r', action: 'Refresh this view' },
    { keys: '1 / 2 / 3', action: 'Detailed / headline / cards view' },
    { keys: '/', action: 'Open search' },
    { keys: '?', action: 'This cheatsheet' },
];

export const OVERLAY_SHORTCUTS_HELP: ShortcutHelp[] = [
    { keys: 'j / k or ↓ / ↑', action: 'Next / previous article' },
    { keys: 's', action: 'Star / unstar' },
    { keys: 'd', action: 'Mark not interesting' },
    { keys: 'o', action: 'Open original' },
    { keys: 'Esc', action: 'Close' },
    { keys: '?', action: 'This cheatsheet' },
];
