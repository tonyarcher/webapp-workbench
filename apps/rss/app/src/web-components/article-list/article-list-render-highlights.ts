import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
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

export function renderRowHighlights(h: { loading: boolean; result: RowHighlight | null | undefined }) {
    if (h.loading && (!h.result || !h.result.available || !h.result.excerpts.length)) {
        return html`<div class="row-highlights" aria-label="Key lines"><div class="skl"></div><div class="skl skl-short"></div></div>`;
    }
    const result = h.result;
    if (!result || !result.available || !result.excerpts.length) {
        return html`<div class="row-highlights" aria-label="Key lines"><p class="row-why">No key lines found for this article.</p></div>`;
    }
    return html`<div class="row-highlights" aria-label="Key lines"><ul>${repeat(
        result.excerpts,
        (e) => e.index,
        (e) => html`<li><blockquote>${e.text}</blockquote></li>`,
    )}</ul><p class="row-why">Why: ${whyLineForRow(result)}</p></div>`;
}

export function highlightToggle(minutes: number, h: RowHighlightRenderState | undefined) {
    if (!h?.enabled || minutes < 4) return '';
    return html`<button class="row-highlight-toggle" @click=${h.onToggle} aria-expanded=${h.open}>${h.open ? 'Hide key lines' : 'Key lines'}</button>`;
}
