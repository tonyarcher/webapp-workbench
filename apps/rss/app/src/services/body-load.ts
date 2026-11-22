/**
 * Pure body-depth states for the reader. Dynamic depth means the summary is
 * visible first; a stored body is a progressive enhancement. A source without
 * a canonical link cannot be refetched, so it must not promise one.
 */
export type BodyLoadState = 'idle' | 'loading' | 'loaded' | 'unavailable';

export interface BodyLoadStatus {
    state: BodyLoadState;
    /** Line shown under the meta row, or null when nothing needs saying. */
    text: string | null;
    busy: boolean;
}

export function canRefetchBody(article: { link?: string | undefined }): boolean {
    return typeof article.link === 'string' && article.link.trim().length > 0;
}

export function bodyLoadStatus(
    article: { content?: string | undefined; summary?: string | undefined; link?: string | undefined },
    loading: boolean,
): BodyLoadStatus {
    if (article.content) return { state: 'loaded', text: null, busy: false };
    if (loading) return { state: 'loading', text: 'Loading full text…', busy: true };
    if (!canRefetchBody(article))
        return { state: 'unavailable', text: 'Full text is unavailable for this source.', busy: false };
    return { state: 'idle', text: null, busy: false };
}
