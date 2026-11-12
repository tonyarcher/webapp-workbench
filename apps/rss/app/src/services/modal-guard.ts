/**
 * Native dialogs live inside shadow roots, where document-level queries
 * cannot see them. Components announce modal open/close here instead, so
 * global shortcuts stay silent while a dialog owns the keyboard.
 */
let openModals = 0;

export function modalOpened(): void {
    openModals += 1;
}

export function modalClosed(): void {
    openModals = Math.max(0, openModals - 1);
}

export function isModalOpen(): boolean {
    return openModals > 0;
}
