import { handleListKey } from './article-list-actions';
import { handleSlideshowKeyDown } from './article-list-slideshow';
import type { DwellTracker } from './article-list-dwell';

/**
 * Window-level key routing for the list. The component passes `this as never`;
 * the slideshow and list-key handlers each narrow the host to their own
 * interface, so this module only declares what it touches itself.
 */
export interface KeyDownHost {
    dwell: DwellTracker;
}

export function handleKeyDown(host: KeyDownHost, e: KeyboardEvent): void {
    host.dwell.noteInput();
    if (handleSlideshowKeyDown(host as never, e, handleListKey)) return;
    handleListKey(host as never, e);
}

/** The shortcuts dialog lives in the app shell, so the list asks for it by event. */
export function showShortcutsAction(): void {
    window.dispatchEvent(new CustomEvent('show-shortcuts', { bubbles: true, composed: true }));
}
