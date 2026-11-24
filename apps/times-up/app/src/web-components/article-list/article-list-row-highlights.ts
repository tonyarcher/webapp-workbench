import { areHighlightsEnabled, loadRowHighlights } from '../../services/highlights';
import type { RowHighlight } from '../../types';

interface RowState {
    open: Record<string, boolean>;
    loading: Record<string, boolean>;
    data: Record<string, RowHighlight | null>;
}

export interface RowHighlightsHost {
    isConnected: boolean;
    highlightsOn: boolean;
    rowHighlights: RowState;
}

export function syncHighlightsEnabled(host: RowHighlightsHost, key: string | null): void {
    if (key !== null && key !== 'times-up:highlights-enabled') return;
    const enabled = areHighlightsEnabled();
    host.highlightsOn = enabled;
    if (!enabled) host.rowHighlights = { open: {}, loading: {}, data: {} };
}

export function toggleRowHighlight(host: RowHighlightsHost, articleId: string): void {
    if (!host.highlightsOn) return;
    const s = host.rowHighlights;
    const open = !s.open[articleId];
    host.rowHighlights = { ...s, open: { ...s.open, [articleId]: open } };
    if (!open || s.data[articleId] !== undefined || s.loading[articleId]) return;
    host.rowHighlights = {
        ...host.rowHighlights,
        loading: { ...host.rowHighlights.loading, [articleId]: true },
    };
    void (async () => {
        const result = await loadRowHighlights(articleId);
        if (!host.isConnected) return;
        host.rowHighlights = {
            ...host.rowHighlights,
            data: { ...host.rowHighlights.data, [articleId]: result },
            loading: { ...host.rowHighlights.loading, [articleId]: false },
        };
    })();
}
