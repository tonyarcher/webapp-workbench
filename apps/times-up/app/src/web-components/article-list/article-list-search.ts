import type { View } from '../../types';

/**
 * Search view helpers. The query lives on the route so back/forward and saved
 * searches keep it, and the shell cannot revert a local edit on its next paint.
 * A `search-query` event asks the shell to update the route; this module stays
 * free of the browser-history import so Node smoke tests can import it.
 */
export interface SearchHost {
    view: View;
    searchScope: string;
    cursors: Map<string, string | undefined>;
    dispatchEvent(e: Event): boolean;
    requestUpdate(): void;
}

export function setSearchQuery(host: SearchHost, q: string): void {
    if (host.view.kind !== 'search' || host.view.q === q) return;
    host.cursors.clear();
    host.dispatchEvent(new CustomEvent('search-query', { detail: { q }, bubbles: true, composed: true }));
}

export function setSearchScope(host: SearchHost, scope: string): void {
    if (host.searchScope === scope) return;
    host.searchScope = scope;
    host.cursors.clear();
    host.requestUpdate();
}

/** Headline-only scope is carried as a documented query operator. */
export function searchQuery(host: SearchHost): string {
    if (host.view.kind !== 'search') return '';
    const text = host.view.q?.trim() ?? '';
    return host.searchScope === 'title' && text ? `${text} in:headline` : text;
}
