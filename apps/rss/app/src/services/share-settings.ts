import { normalizeMastodonHost, type ShareTarget } from './share';

/** The instance Mastodon shares post through. Federated, so it is configured, not coded. */
export const MASTODON_HOST_KEY = 'rss-reader:mastodon-host';
export const DEFAULT_MASTODON_HOST = 'mastodon.social';

/** Which share buttons the article toolbar shows, in this order. */
export const SHARE_TARGETS_KEY = 'rss-reader:share-targets';
export const ALL_SHARE_TARGETS: ShareTarget[] = ['facebook', 'x', 'mastodon', 'instagram'];

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

/**
 * Enabled share targets. Absent storage means every button (a fresh install
 * shares everywhere); an explicit empty list means the reader turned them
 * all off, which is honored rather than reset.
 */
export function loadShareTargets(): ShareTarget[] {
    try {
        const raw = localStorage.getItem(SHARE_TARGETS_KEY);
        if (raw === null) return [...ALL_SHARE_TARGETS];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [...ALL_SHARE_TARGETS];
        const valid = (parsed as unknown[]).filter(
            (t): t is ShareTarget => typeof t === 'string' && (ALL_SHARE_TARGETS as readonly string[]).includes(t),
        );
        return ALL_SHARE_TARGETS.filter((t) => valid.includes(t));
    } catch {
        return [...ALL_SHARE_TARGETS];
    }
}

export function saveShareTargets(targets: ShareTarget[]): void {
    try {
        localStorage.setItem(SHARE_TARGETS_KEY, JSON.stringify(targets));
    } catch {
        // storage unavailable; the selection just won't persist
    }
}
