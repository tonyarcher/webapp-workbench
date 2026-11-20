/**
 * Sidebar context menus are popovers in the top layer, not extra rows in the
 * nav. The menu elements already carry the popover styles; this wires their
 * open state to the native API and pins them under the button that opened
 * them. Opening another popover closes this one, and the close event keeps
 * the source-list state in step.
 */
export interface MenuAnchor {
    x: number;
    y: number;
}

/**
 * Prefer the button's bottom edge. A repaint during the click can detach the
 * trigger before its rect is read, so fall back to the click coordinates.
 */
export function anchorFromEvent(event: MouseEvent): MenuAnchor {
    const button = event.currentTarget as HTMLElement | null;
    const rect = button?.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) return { x: rect.left, y: rect.bottom };
    return { x: event.clientX, y: event.clientY };
}

export function syncMenuPopover(
    node: HTMLElement,
    open: boolean,
    anchor: MenuAnchor | null,
    onClose: () => void,
): void {
    if (!node.hasAttribute('popover')) {
        node.setAttribute('popover', 'auto');
        node.addEventListener('beforetoggle', (event) => {
            if ((event as ToggleEvent).newState === 'closed' && node.dataset['showing'] === 'true') {
                node.dataset['showing'] = 'false';
                onClose();
            }
        });
    }
    if (!open) {
        if (node.matches(':popover-open')) node.hidePopover();
        return;
    }
    if (anchor) {
        node.style.left = `${Math.max(4, Math.min(anchor.x, window.innerWidth - 280))}px`;
        node.style.top = `${Math.max(4, Math.min(anchor.y, window.innerHeight - 240))}px`;
    }
    if (!node.matches(':popover-open')) {
        node.dataset['showing'] = 'true';
        node.showPopover();
    }
}
