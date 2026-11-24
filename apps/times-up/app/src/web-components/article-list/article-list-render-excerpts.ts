import { el } from './article-list-dom';

/** Excerpt lines are optional: a row keeps its compact shape until one loads. */
export function renderRowExcerpt(text: string | null | undefined): HTMLElement | null {
    if (!text) return null;
    return el('div', 'row-excerpt', text);
}
