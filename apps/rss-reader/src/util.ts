import type {Article} from './types';

export function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= startOfToday) {
        return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    }
    if (ts >= startOfToday - 86_400_000) return 'Yesterday';
    if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
    }
    return d.toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'});
}

export function domainOf(url: string | undefined): string {
    if (!url) return '';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

/**
 * Build a diverse page from per-feed sorted lists: round-robin through the
 * feeds (ordered by their hottest item first) so no single source dominates
 * the page, while the top story is still the hottest overall.
 */
export function interleaveArticles(pages: Article[][], limit: number): Article[] {
    const nonEmpty = pages.filter((p) => p.length > 0);
    if (!nonEmpty.length || limit <= 0) return [];
    const order = [...nonEmpty.keys()].sort(
        (a, b) => (nonEmpty[b][0]?.hot ?? -Infinity) - (nonEmpty[a][0]?.hot ?? -Infinity),
    );
    const pointers = new Array(nonEmpty.length).fill(0);
    const out: Article[] = [];
    let added = true;
    while (out.length < limit && added) {
        added = false;
        for (const i of order) {
            if (out.length >= limit) break;
            const idx = pointers[i];
            if (idx < nonEmpty[i].length) {
                out.push(nonEmpty[i][idx]);
                pointers[i]++;
                added = true;
            }
        }
    }
    return out;
}
