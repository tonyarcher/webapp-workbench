/**
 * A shared "add feed" intent. Entry points (header, Organize, feed-list menu)
 * request it; the General settings panel opens its form when it mounts or when
 * it is already on screen. This keeps one form and one mutation path.
 */
import { navigate } from '../router';

const ADD_FEED_EVENT = 'rss-add-feed-requested';
let pending = false;
let pendingUrl: string | null = null;

export function requestAddFeed(url?: string): void {
    navigate({ kind: 'settings', section: 'organize' });
    pending = true;
    pendingUrl = url ?? null;
    window.dispatchEvent(new Event(ADD_FEED_EVENT));
}

export function takeAddFeedRequest(): boolean {
    const wasPending = pending;
    pending = false;
    return wasPending;
}

export function takeAddFeedUrl(): string | null {
    const url = pendingUrl;
    pendingUrl = null;
    return url;
}

export function onAddFeedRequested(handler: () => void): () => void {
    window.addEventListener(ADD_FEED_EVENT, handler);
    return () => window.removeEventListener(ADD_FEED_EVENT, handler);
}
