import { coverageBalance } from '../../services/coverage-balance';
import { navigate } from '../../router';
import type { Article, Feed } from '../../types';
import { el } from './today-view-dom';

/** Local coverage meter for one Today section; empty when no topic is known. */
export function buildCoverageBar(articles: Article[], feeds: Feed[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const balance = coverageBalance(articles, feeds);
    if (!balance) return fragment;
    const bar = el('div', 'coverage-bar');
    bar.appendChild(
        el(
            'span',
            'coverage-label',
            `${balance.topic}: ${balance.outlets} outlet${balance.outlets === 1 ? '' : 's'} · ${balance.label}`,
        ),
    );
    for (const suggestion of balance.suggestions) {
        const button = el('button', 'coverage-suggestion', `Also: ${suggestion.title}`);
        button.addEventListener('click', () => navigate({ kind: 'feed', id: suggestion.feedId }));
        bar.appendChild(button);
    }
    fragment.appendChild(bar);
    return fragment;
}
