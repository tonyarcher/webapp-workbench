import { clampArticlePanelWidth, nextArticlePanelWidth, saveArticlePanelWidth } from './article-panel-settings';

/** Panel-resize drag state, owned by the shell element. */
export interface PanelResizeHost {
    articleResizing: boolean;
    articleResizeHandleEl: HTMLElement | null;
    articleResizeStart: { x: number; width: number; pointerId: number } | null;
    articleWidth: number;
    renderRoot: ShadowRoot | null;
}

/**
 * Release a panel resize torn down mid-drag. Escape and route changes
 * remove the overlay (and the handle holding the pointer capture) while
 * a drag is in flight, so without this the body keeps col-resize and
 * unselectable text until the next successful drag-end or reload.
 */
export function endArticleResize(host: PanelResizeHost): void {
    if (!host.articleResizing) return;
    host.articleResizing = false;
    const handle = host.articleResizeHandleEl;
    const pointerId = host.articleResizeStart?.pointerId;
    host.articleResizeStart = null;
    host.articleResizeHandleEl = null;
    if (handle && pointerId !== undefined) {
        try {
            if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        } catch {
            // handle already detached; nothing to release
        }
        handle.classList.remove('resizing');
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

/**
 * The handle element, whether or not a drag is in progress. The active
 * handle only exists between pointerdown and pointerup; a keyboard
 * resize never sets it, so the shadow root fallback keeps aria-valuenow
 * honest for exactly the users this control exists for.
 */
function panelHandle(host: PanelResizeHost): HTMLElement | null {
    return host.articleResizeHandleEl ?? host.renderRoot?.querySelector<HTMLElement>('.article-panel-handle') ?? null;
}

/**
 * The one place an article panel width is applied, so the pointer and
 * keyboard paths cannot drift apart. Writes the CSS var on the panel
 * (no re-render per pointermove) and the separator value a screen
 * reader announces.
 */
export function applyArticlePanelWidth(host: PanelResizeHost, raw: number): void {
    const width = clampArticlePanelWidth(raw);
    host.articleWidth = width;
    const panel = host.renderRoot?.querySelector<HTMLElement>('.article-panel');
    panel?.style.setProperty('--article-width', `${width}px`);
    panelHandle(host)?.setAttribute('aria-valuenow', String(width));
    saveArticlePanelWidth(width);
}

export function panelResizeStart(host: PanelResizeHost, e: PointerEvent): void {
    if (e.button !== 0) return;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    host.articleResizeHandleEl = handle;
    host.articleResizeStart = { x: e.clientX, width: host.articleWidth, pointerId: e.pointerId };
    host.articleResizing = true;
    handle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

export function panelResizeMove(host: PanelResizeHost, e: PointerEvent): void {
    if (!host.articleResizing || !host.articleResizeStart) return;
    // The panel docks right: dragging left grows it.
    applyArticlePanelWidth(host, host.articleResizeStart.width + (host.articleResizeStart.x - e.clientX));
}

export function panelResizeEnd(host: PanelResizeHost, e: PointerEvent): void {
    if (!host.articleResizing) return;
    const handle = host.articleResizeHandleEl;
    host.articleResizing = false;
    host.articleResizeStart = null;
    host.articleResizeHandleEl = null;
    handle?.classList.remove('resizing');
    if (handle) {
        try {
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        } catch {
            // handle already detached; nothing to release
        }
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

/**
 * Keyboard equivalent of the drag. Handled keys stop propagation: the
 * shell's window keydown also listens for ArrowLeft (close) and would
 * otherwise fire after the target listener and shut the overlay
 * mid-resize.
 */
export function panelResizeKey(host: PanelResizeHost, e: KeyboardEvent): boolean {
    const next = nextArticlePanelWidth(host.articleWidth, e.key, e.shiftKey);
    if (next === null) return false;
    e.preventDefault();
    e.stopPropagation();
    applyArticlePanelWidth(host, next);
    return true;
}
