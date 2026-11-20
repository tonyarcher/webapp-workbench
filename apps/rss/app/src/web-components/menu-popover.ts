/**
 * Sidebar context menus are popovers in the top layer, not extra rows in the
 * nav. The menu elements already carry the popover styles; this wires their
 * open state to the native API and keeps them inside the viewport. Opening
 * another popover closes this one, and the close event keeps the source-list
 * state in step.
 */
export interface MenuAnchor {
    x: number;
    y: number;
}

const GAP = 8;
const anchors = new WeakMap<HTMLElement, MenuAnchor | null>();

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

/** Measure the shown popover, then clamp or flip it into the viewport. */
function place(node: HTMLElement, anchor: MenuAnchor): void {
    if (!node.matches(':popover-open')) {
        node.dataset['showing'] = 'true';
        node.showPopover();
    }
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const maxX = Math.max(GAP, window.innerWidth - width - GAP);
    const maxY = Math.max(GAP, window.innerHeight - height - GAP);
    const below = anchor.y + GAP;
    const above = anchor.y - height - GAP;
    const y = below + height <= window.innerHeight - GAP ? below : Math.min(above, maxY);
    node.style.left = `${Math.min(Math.max(GAP, anchor.x), maxX)}px`;
    node.style.top = `${Math.max(GAP, Math.min(y, maxY))}px`;
}

export function syncMenuPopover(
    node: HTMLElement,
    open: boolean,
    anchor: MenuAnchor | null,
    onClose: () => void,
): void {
    anchors.set(node, anchor);
    if (!node.hasAttribute('popover')) {
        node.setAttribute('popover', 'auto');
        node.addEventListener('beforetoggle', (event) => {
            if ((event as ToggleEvent).newState === 'closed' && node.dataset['showing'] === 'true') {
                node.dataset['showing'] = 'false';
                onClose();
            }
        });
        window.addEventListener('resize', () => {
            const current = anchors.get(node);
            if (node.matches(':popover-open') && current) place(node, current);
        });
    }
    if (!open) {
        if (node.matches(':popover-open')) node.hidePopover();
        return;
    }
    if (anchor) place(node, anchor);
}
