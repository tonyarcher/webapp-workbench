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
    /**
     * Aspect ratio (width / height) to frame the iframe at. Providers whose
     * embed card renders a side description panel in wide viewports (TikTok)
     * set this to force the portrait layout, where the video fills the full
     * height and the panel is gone.
     */
    iframeAspect?: number
    /**
     * True when `data` is this provider's "player ready" postMessage.
     * When set, media-video keeps the iframe mounted and drives play/pause
     * through `commandPlayer` instead of relying on autoplay=1 (which
     * browsers and TikTok both ignore without a follow-up command).
     */
    isPlayerReadyMessage?(data: unknown): boolean
    /** Decode a postMessage from the embed into a typed player event. */
    parsePlayerMessage?(data: unknown): EmbedPlayerEvent | null
    /** postMessage a play/pause/mute command into the embed iframe. */
    commandPlayer?(win: Window, command: 'play' | 'pause' | 'mute' | 'unmute'): void
    /** Seek the embed player to `seconds`. */
    seekPlayer?(win: Window, seconds: number): void
}

export type EmbedPlayerEvent =
    | {type: 'ready'}
    | {type: 'playing'}
    | {type: 'paused'}
    | {type: 'ended'}
    | {type: 'time'; currentTime: number; duration: number}
