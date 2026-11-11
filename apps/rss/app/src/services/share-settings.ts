import { normalizeMastodonHost } from './share';

/** The instance Mastodon shares post through. Federated, so it is configured, not coded. */
export const MASTODON_HOST_KEY = 'rss-reader:mastodon-host';
export const DEFAULT_MASTODON_HOST = 'mastodon.social';

export function loadMastodonHost(): string {
    try {
        return normalizeMastodonHost(localStorage.getItem(MASTODON_HOST_KEY) ?? '') ?? DEFAULT_MASTODON_HOST;
    } catch {
        return DEFAULT_MASTODON_HOST;
    }
}

export function saveMastodonHost(host: string): void {
    try {
        localStorage.setItem(MASTODON_HOST_KEY, host.trim());
    } catch {
        // storage unavailable; the instance just won't persist
    }
}
