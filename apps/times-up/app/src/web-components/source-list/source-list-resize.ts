import { clampSidebarWidth, nextSidebarWidth, saveSidebarWidth } from './source-list-settings';

/**
 * The splitter half that needs a live element: pointer capture, the transient
 * handle reference, body cursor, and the width write. The width math itself
 * lives in source-list-settings.ts so it is testable without a DOM.
 */
export interface ResizeHost {
    hideTimer: number | null;
    hover: boolean;
    autoHide: boolean;
    sidebarWidth: number;
    handle: HTMLElement;
    style: CSSStyleDeclaration;
    getBoundingClientRect(): DOMRect;
    onHoverLeave(): void;
}

/** Drag-scoped state, held per element so the component carries no dead fields. */
interface ResizeState {
    resizing: boolean;
    handle: HTMLElement | null;
}

const states = new WeakMap<ResizeHost, ResizeState>();

function stateOf(host: ResizeHost): ResizeState {
    const existing = states.get(host);
    if (existing) return existing;
    const created: ResizeState = { resizing: false, handle: null };
    states.set(host, created);
    return created;
}

/**
 * The handle element, whether or not a drag is in progress.
 *
 * The drag-scoped reference only exists between pointerdown and pointerup,
 * because it exists to hold the pointer capture and the resizing class. A
 * keyboard resize never sets it, so writing aria-valuenow through it alone left
 * the attribute frozen at its rendered value for exactly the users this change
 * exists for: the sidebar would widen while the announced width stayed put.
 * Falling back to the persistent handle keeps the two paths honest.
 */
function resizeHandle(host: ResizeHost): HTMLElement {
    return stateOf(host).handle ?? host.handle;
}

/**
 * The one place a sidebar width is applied, so the pointer and keyboard paths
 * cannot drift apart. It also writes aria-valuenow, because a drag does not
 * re-render and a stale value on a separator is a lie a screen reader reports.
 */
function applyWidth(host: ResizeHost, raw: number): void {
    const width = clampSidebarWidth(raw);
    host.style.setProperty('--sidebar-width', `${width}px`);
    host.sidebarWidth = width;
    resizeHandle(host).setAttribute('aria-valuenow', String(width));
    saveSidebarWidth(width);
}

export function startResize(host: ResizeHost, e: PointerEvent): void {
    if (e.button !== 0) return;
    const state = stateOf(host);
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    state.handle = handle;
    state.resizing = true;
    handle.classList.add('resizing');
    if (host.hideTimer !== null) {
        clearTimeout(host.hideTimer);
        host.hideTimer = null;
    }
    host.hover = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

export function moveResize(host: ResizeHost, e: PointerEvent): void {
    if (!stateOf(host).resizing) return;
    const rect = host.getBoundingClientRect();
    applyWidth(host, e.clientX - rect.left);
}

/**
 * Keyboard equivalent of the drag. This only decides whether the key is ours;
 * the stepping and clamping live in nextSidebarWidth.
 */
export function keyResize(host: ResizeHost, e: KeyboardEvent): void {
    const next = nextSidebarWidth(host.sidebarWidth, e.key, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    applyWidth(host, next);
}

export function endResize(host: ResizeHost, e: PointerEvent): void {
    const state = stateOf(host);
    if (!state.resizing) return;
    state.resizing = false;
    state.handle?.classList.remove('resizing');
    if (state.handle?.hasPointerCapture(e.pointerId)) {
        state.handle.releasePointerCapture(e.pointerId);
    }
    state.handle = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (!host.autoHide) return;
    const rect = host.getBoundingClientRect();
    const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!over) host.onHoverLeave();
}
