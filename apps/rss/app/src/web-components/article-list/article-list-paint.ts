import type { Virtualizer } from '@tanstack/virtual-core';
import type { ListViewType, View } from '../../types';
import {
    renderAdvancedMenu,
    renderInterestingHint,
    renderLoadError,
    renderScroll,
    renderSelectionBar,
    renderToolbar,
} from './article-list-render';
import { renderSlideshowSection } from './article-list-slideshow-render';

/**
 * Imperative paint for the vanilla article list. The element owns the comment
 * anchors, the mounted-node map, and the scroll container; this module reuses
 * them on every reactive flush. Renderers still receive the element itself
 * (`host as never`), so their typed host contracts stay unchanged.
 */
export interface Regions {
    toolbar: Comment;
    selection: Comment;
    hint: Comment;
    advanced: Comment;
    slideshow: Comment;
    loadError: Comment;
}

export interface PaintHost {
    anchors: Regions;
    regionNodes: Map<Comment, Node>;
    scrollEl: HTMLDivElement;
    listView: ListViewType;
    view: View;
    virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
}

/** Trailing comment anchor for a render region, kept in the shadow root. */
export function anchor(root: ShadowRoot): Comment {
    const node = document.createComment('');
    root.appendChild(node);
    return node;
}

/** Swap the single node mounted at an anchor, removing the previous one. */
export function mountRegion(host: PaintHost, anchorNode: Comment, node: Node | null): void {
    const previous = host.regionNodes.get(anchorNode);
    if (previous?.parentNode) previous.parentNode.removeChild(previous);
    if (node) {
        host.regionNodes.set(anchorNode, node);
        anchorNode.parentNode?.insertBefore(node, anchorNode.nextSibling);
    } else {
        host.regionNodes.delete(anchorNode);
    }
}

/** Paint every region from the current state, in the same order as before. */
export function paint(host: PaintHost): void {
    const renderHost = host as never;
    const { toolbar, selection, hint, advanced, slideshow, loadError } = host.anchors;
    mountRegion(host, toolbar, renderToolbar(renderHost));
    mountRegion(host, hint, renderInterestingHint(renderHost));
    mountRegion(host, advanced, renderAdvancedMenu(renderHost));
    if (host.listView === 'slideshow') {
        mountRegion(host, selection, null);
        mountRegion(host, slideshow, renderSlideshowSection(renderHost));
        mountRegion(host, loadError, null);
        host.scrollEl.style.display = 'none';
        return;
    }
    mountRegion(host, selection, renderSelectionBar(renderHost));
    mountRegion(host, slideshow, null);
    mountRegion(host, loadError, renderLoadError(renderHost));
    host.scrollEl.style.display = '';
    const virtualItems = host.virtualizer?.getVirtualItems() ?? [];
    renderScroll(renderHost, virtualItems, host.view.kind !== 'feed', host.scrollEl);
    // Virtual rows are freshly built each paint. Re-measure them once they
    // are in the scroll container, as the old ref directive did.
    for (const row of host.scrollEl.querySelectorAll<HTMLElement>('.viewport .row')) {
        host.virtualizer?.measureElement(row as HTMLDivElement);
    }
}
