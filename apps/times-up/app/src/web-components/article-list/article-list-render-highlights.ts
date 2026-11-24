import { append, el } from './article-list-dom';
import type { RowHighlight } from '../../types';

export interface RowHighlightRenderState {
    enabled: boolean;
    open: boolean;
    loading: boolean;
    result: RowHighlight | null | undefined;
    onToggle: (e: Event) => void;
}

export interface HighlightHost {
    highlightsOn: boolean;
    isHighlightOpen(articleId: string): boolean;
    highlightResult(articleId: string): RowHighlight | null | undefined;
    highlightLoading(articleId: string): boolean;
    onToggleRowHighlight(e: Event, articleId: string): void;
}

export function highlightArgs(host: HighlightHost, articleId: string): RowHighlightRenderState {
    return {
        enabled: host.highlightsOn,
        open: host.isHighlightOpen(articleId),
        loading: host.highlightLoading(articleId),
        result: host.highlightResult(articleId),
        onToggle: (e: Event) => host.onToggleRowHighlight(e, articleId),
    };
}

function whyLineForRow(result: RowHighlight): string {
    const parts: string[] = [];
    if (result.interesting !== null && result.interesting !== undefined)
        parts.push(`Jev interest ${Math.round(result.interesting * 100)}%`);
    if (result.spam != null && result.spam >= 0.5) parts.push('looks like boilerplate');
    return parts.join(' · ') || 'key excerpts';
}

export function renderRowHighlights(h: { loading: boolean; result: RowHighlight | null | undefined }): HTMLElement {
    const box = el('div', 'row-highlights');
    box.setAttribute('aria-label', 'Key lines');
    if (h.loading && (!h.result || !h.result.available || !h.result.excerpts.length)) {
        box.appendChild(el('div', 'skl'));
        box.appendChild(el('div', 'skl skl-short'));
        return box;
    }
    const result = h.result;
    if (!result || !result.available || !result.excerpts.length) {
        box.appendChild(el('p', 'row-why', 'No key lines found for this article.'));
        return box;
    }
    const list = document.createElement('ul');
    for (const excerpt of result.excerpts) {
        const item = document.createElement('li');
        item.appendChild(el('blockquote', undefined, excerpt.text));
        list.appendChild(item);
    }
    box.appendChild(list);
    box.appendChild(el('p', 'row-why', `Why: ${whyLineForRow(result)}`));
    return box;
}

export function highlightToggle(minutes: number, h: RowHighlightRenderState | undefined): HTMLButtonElement | null {
    if (!h?.enabled || minutes < 4) return null;
    const button = el('button', 'row-highlight-toggle', h.open ? 'Hide key lines' : 'Key lines');
    button.setAttribute('aria-expanded', String(h.open));
    button.addEventListener('click', h.onToggle);
    return button;
}

/** Join a set of nodes into one DOM fragment (used by multi-root helpers). */
export function rowFragment(...children: Array<Node | null>): DocumentFragment {
    const frag = document.createDocumentFragment();
    append(frag, ...children);
    return frag;
}
