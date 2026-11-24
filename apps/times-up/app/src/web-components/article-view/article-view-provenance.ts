import type { ArticleProvenance, EvidenceItem } from '../../services/api-provenance';
import { el } from './article-view-dom';

export interface ProvenanceHost {
    provenance: ArticleProvenance | null;
    provenanceLoading: boolean;
    onCopyProvenance: () => void;
}

/** Evidence section for the article panel. All text comes from the API as verbatim slices. */
export function buildProvenance(host: ProvenanceHost): Node[] {
    const data = host.provenance;
    if (!data) {
        return host.provenanceLoading ? [el('div', 'skl skl-short')] : [];
    }
    const section = el('section', 'provenance');
    section.setAttribute('aria-label', 'Evidence');

    const head = el('div', 'provenance-head');
    head.appendChild(el('h2', undefined, 'Evidence'));
    const copy = el('button', 'provenance-copy', 'Copy markdown');
    copy.addEventListener('click', host.onCopyProvenance);
    head.appendChild(copy);
    section.appendChild(head);

    const origin = data.source.sourceKind ?? data.source.connectorId;
    section.appendChild(el('p', 'provenance-source', `${data.source.feedTitle}${origin ? ` · ${origin}` : ''}`));
    appendList(section, 'Quotes', data.quotes, 'No quotes found for this article.');
    appendList(section, 'Figures', data.figures, 'No figures found for this article.');
    return [section];
}

function appendList(section: HTMLElement, label: string, items: EvidenceItem[], empty: string): void {
    section.appendChild(el('h3', 'provenance-label', label));
    if (items.length === 0) {
        section.appendChild(el('p', 'provenance-empty', empty));
        return;
    }
    const list = el('ul', 'provenance-list');
    for (const item of items) {
        const li = el('li', 'provenance-item');
        li.dataset['evidenceId'] = item.id;
        li.appendChild(el('blockquote', undefined, item.text));
        list.appendChild(li);
    }
    section.appendChild(list);
}
