/**
 * Client cache and opt-out for row-level key lines. The decision model
 * selects the excerpts server-side; this only remembers them per article so
 * a scroll past a row does not re-query it.
 */
import { fetchRowHighlights } from './api';
import type { RowHighlight } from '../types';

const ENABLED_KEY = 'rss-reader:highlights-enabled';
const CACHE_TTL_MS = 60 * 60_000;

interface CacheEntry {
    at: number;
    value: RowHighlight | null;
}

const cache = new Map<string, CacheEntry>();

export function areHighlightsEnabled(): boolean {
    try {
        const raw = localStorage.getItem(ENABLED_KEY);
        return raw === null ? true : raw === 'true';
    } catch {
        return true;
    }
}

export function setHighlightsEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(ENABLED_KEY, String(enabled));
    } catch {
        // storage unavailable; the session still honors the toggle
    }
    if (!enabled) cache.clear();
}

/** Cached highlights, or null when disabled/unavailable/failed. */
export async function loadRowHighlights(articleId: string): Promise<RowHighlight | null> {
    if (!areHighlightsEnabled()) return null;
    const cached = cache.get(articleId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;
    try {
        const value = await fetchRowHighlights(articleId);
        // Don't pin transient unavailability; successful excerpts are stable.
        if (value.available) cache.set(articleId, { at: Date.now(), value });
        else cache.delete(articleId);
        return value;
    } catch {
        return null;
    }
}
