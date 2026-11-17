import { CARD_MIN_WIDTH } from './article-list-helpers';
import type { DwellTracker } from './article-list-dwell';
import type { Article } from '../../types';

/**
 * Scroll-container layout: the column count for cards and the pointer/resize
 * watchers that feed the dwell tracker. The element keeps the reactive `cols`
 * and the raw handles (`boundScrollEl`, `resizeObserver`); this module rebinds
 * them whenever the scroll element identity changes.
 */
export interface LayoutHost {
    scrollElRef: { value: HTMLDivElement | null };
    boundScrollEl: HTMLDivElement | null;
    resizeObserver: ResizeObserver | undefined;
    maxCardCols: number;
    cols: number;
    items: Article[];
    renderRoot: { contains(node: Node | null): boolean };
    dwell: DwellTracker;
    onPointerActivity: (e: Event) => void;
}

export function updateCols(host: LayoutHost): void {
    const el = host.scrollElRef.value;
    if (!el) return;
    const width = el.clientWidth;
    const cols = Math.max(1, Math.min(host.maxCardCols, Math.floor(width / CARD_MIN_WIDTH)));
    if (cols !== host.cols) {
        host.cols = cols;
    }
}

export function syncScrollBindings(host: LayoutHost): void {
    const el = host.scrollElRef.value ?? null;
    if (el === host.boundScrollEl) return;
    if (host.boundScrollEl) detachPointerTracking(host);
    host.boundScrollEl = el;
    if (el) attachPointerTracking(host, el);
}

function detachPointerTracking(host: LayoutHost): void {
    const el = host.boundScrollEl;
    if (el) {
        el.removeEventListener('pointermove', host.onPointerActivity);
        el.removeEventListener('wheel', host.onPointerActivity);
    }
    host.resizeObserver?.disconnect();
    host.resizeObserver = undefined;
}

function attachPointerTracking(host: LayoutHost, el: HTMLDivElement): void {
    updateCols(host);
    host.resizeObserver = new ResizeObserver(() => updateCols(host));
    host.resizeObserver.observe(el);
    el.addEventListener('pointermove', host.onPointerActivity);
    el.addEventListener('wheel', host.onPointerActivity, { passive: true });
}

/** Disconnect cleanup: drop the scroll-element watchers for good. */
export function detachScrollBindings(host: LayoutHost): void {
    if (host.boundScrollEl) {
        host.boundScrollEl.removeEventListener('pointermove', host.onPointerActivity);
        host.boundScrollEl.removeEventListener('wheel', host.onPointerActivity);
        host.boundScrollEl = null;
    }
    host.resizeObserver?.disconnect();
    host.resizeObserver = undefined;
}

export function trackPointerActivity(host: LayoutHost, e: Event): void {
    host.dwell.trackEvent(e, host.items, host.cols, host.renderRoot);
}
