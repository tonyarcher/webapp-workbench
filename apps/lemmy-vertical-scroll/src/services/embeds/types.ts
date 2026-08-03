/**
 * A site whose video pages can only be played through its official embed
 * player (cross-origin media loads are blocked or ORB-mangled), so the app
 * renders an <iframe> instead of a <video> element. Providers are pure and
 * unit-tested via the registry in index.ts.
 */
export interface EmbedProvider {
    /** Stable identifier, used for iframe titles and debugging. */
    name: string
    /** Extracts the embed id from a page URL, or null if the URL isn't this provider. */
    id(url: string): string | null
    /** Maps a page URL to the official embed iframe URL, or null when not this provider / unsafe. */
    embedUrl(url: string | null): string | null
    /**
     * Static poster image for the inactive placeholder, or null when the
     * provider has no simple thumbnail (e.g. redgifs).
     */
    poster(id: string): string | null
    /**
     * Referrer-Policy for the embed iframe. Defaults to the privacy-safe
     * `no-referrer`; providers whose player requires a Referer to configure
     * itself (YouTube refuses with Error 153) must override it.
     */
    iframeReferrerPolicy?: string
}
