/**
 * Article share links. Pure URL builders, no DOM: the component decides how
 * to open them (new tab) or fall back (copy the link).
 *
 * Facebook and X publish share intents. Mastodon is federated, so its share
 * page lives on the reader's own instance (see share-settings); the host is
 * required. Instagram publishes no web share endpoint at all, so there is
 * no URL to build — the UI copies the link instead of pretending otherwise.
 */

export type ShareTarget = 'facebook' | 'x' | 'mastodon' | 'instagram';

export function facebookShareUrl(articleUrl: string): string {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
}

export function xShareUrl(articleUrl: string, title: string): string {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`;
}

/** Undefined without a configured instance: there is no global Mastodon share page. */
export function mastodonShareUrl(host: string | undefined, articleUrl: string, title: string): string | undefined {
    const clean = normalizeMastodonHost(host ?? '');
    if (!clean) return undefined;
    return `https://${clean}/share?text=${encodeURIComponent(`${title} ${articleUrl}`)}`;
}

/**
 * The watch-page link for a share target. Instagram has no endpoint, and
 * Mastodon needs a configured instance, so those resolve to undefined and
 * the caller degrades (copy the link, or prompt for the instance).
 */
export function shareUrl(
    target: ShareTarget,
    articleUrl: string,
    title: string,
    mastodonHost?: string,
): string | undefined {
    switch (target) {
        case 'facebook':
            return facebookShareUrl(articleUrl);
        case 'x':
            return xShareUrl(articleUrl, title);
        case 'mastodon':
            return mastodonShareUrl(mastodonHost, articleUrl, title);
        case 'instagram':
            return undefined;
    }
}

/**
 * A bare instance domain from user input. Accepts a pasted share URL, a
 * handle (`@user@host`), or a bare domain, and rejects anything that is
 * not plausibly a host (spaces, no dot, empty).
 */
export function normalizeMastodonHost(raw: string): string | undefined {
    let host = raw.trim().toLowerCase();
    if (!host) return undefined;
    host = host.replace(/^https?:\/\//, '');
    const handle = /@([^@]+)@([^@]+)$/.exec(host);
    if (handle?.[2]) host = handle[2];
    host = host.split('/')[0] ?? '';
    host = host.startsWith('@') ? host.slice(1) : host;
    if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?$/.test(host)) return undefined;
    if (!host.includes('.')) return undefined;
    return host;
}
