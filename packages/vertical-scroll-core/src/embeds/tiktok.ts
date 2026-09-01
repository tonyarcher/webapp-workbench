import type {EmbedPlayerEvent, EmbedProvider} from './types'
import {safeUrl} from '../url'

// tiktok.com plus the data-export/share host tiktokv.com
const TIKTOK_HOST_RE = /(?:^|[./])tiktokv?\.com\//i
const TIKTOK_ID_RE = /^\d{6,32}$/

function isValidId(id: string | null): string | null {
    return id && TIKTOK_ID_RE.test(id) ? id : null
}

/** First path segment after a fixed prefix, e.g. '/video/123/...' -> '123'. */
function pathSegmentAfter(path: string, prefix: string): string | null {
    if (!path.startsWith(prefix)) return null
    const rest = path.slice(prefix.length)
    return rest.split('/')[0] || null
}

/**
 * Extracts the numeric TikTok video id from a page/embed URL.
 * Short links (vm.tiktok.com, /t/…) have no id and return null.
 */
function parseUrlSafe(url: string): URL | null {
    try {
        return new URL(url)
    } catch {
        return null
    }
}

function isTiktokHost(host: string): boolean {
    return host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'tiktokv.com' || host.endsWith('.tiktokv.com')
}

function idFromPrefixes(path: string): string | null {
    for (const prefix of ['/share/video/', '/video/', '/embed/v2/', '/player/v1/', '/v/']) {
        const raw = pathSegmentAfter(path, prefix)
        if (!raw) continue
        const id = raw.replace(/\.html$/i, '')
        const valid = isValidId(id)
        if (valid) return valid
    }
    return null
}

function idFromAtVideo(path: string): string | null {
    const atVideo = path.match(/\/video\/(\d+)/)
    if (atVideo) return isValidId(atVideo[1])
    return null
}

function tiktokId(url: string): string | null {
    if (!TIKTOK_HOST_RE.test(url)) return null
    const parsed = parseUrlSafe(url)
    if (!parsed) return null
    if (!isTiktokHost(parsed.hostname.toLowerCase())) return null
    return idFromPrefixes(parsed.pathname) ?? idFromAtVideo(parsed.pathname)
}

const TIKTOK_PLAYER_ORIGIN = 'https://www.tiktok.com'
/** Official embed player (player/v1) bus. embed/v2 uses `x-tiktok-embed`. */
const TIKTOK_PLAYER_FLAG = 'x-tiktok-player'

function isPlayerReadyMessage(data: unknown): boolean {
    return parsePlayerMessage(data)?.type === 'ready'
}

function stateEvent(value: unknown): EmbedPlayerEvent | null {
    if (value === 1) return {type: 'playing'}
    if (value === 2) return {type: 'paused'}
    if (value === 0) return {type: 'ended'}
    return null
}

function timeEvent(value: unknown): EmbedPlayerEvent | null {
    if (!value || typeof value !== 'object') return null
    const v = value as {currentTime?: unknown; duration?: unknown}
    const currentTime = typeof v.currentTime === 'number' ? v.currentTime : null
    const duration = typeof v.duration === 'number' ? v.duration : null
    if (currentTime === null || duration === null || duration <= 0) return null
    return {type: 'time', currentTime, duration}
}

function parsePlayerMessage(data: unknown): EmbedPlayerEvent | null {
    if (!data || typeof data !== 'object') return null
    const msg = data as Record<string, unknown>
    if (msg[TIKTOK_PLAYER_FLAG] !== true) return null
    if (msg.type === 'onPlayerReady') return {type: 'ready'}
    if (msg.type === 'onStateChange') return stateEvent(msg.value)
    if (msg.type === 'onCurrentTime') return timeEvent(msg.value)
    return null
}

function commandPlayer(win: Window, command: 'play' | 'pause' | 'mute' | 'unmute'): void {
    // Official host→player methods take void; mute's extra `value: true`
    // was leaving some players in a ducked "background" volume after unMute.
    const type = command === 'unmute' ? 'unMute' : command
    win.postMessage({type, [TIKTOK_PLAYER_FLAG]: true}, TIKTOK_PLAYER_ORIGIN)
}

function seekPlayer(win: Window, seconds: number): void {
    win.postMessage({type: 'seekTo', value: seconds, [TIKTOK_PLAYER_FLAG]: true}, TIKTOK_PLAYER_ORIGIN)
}

export const TIKTOK: EmbedProvider = {
    name: 'tiktok',
    id: tiktokId,
    // TikTok's player uses the embedding page Referer the same way YouTube
    // does; stripping it can leave the iframe blank.
    iframeReferrerPolicy: 'strict-origin-when-cross-origin',
    isPlayerReadyMessage,
    parsePlayerMessage,
    commandPlayer,
    seekPlayer,
    embedUrl(url) {
        const id = tiktokId(url ?? '')
        // player/v1 is a full-bleed video player — no 325px white card, no
        // giant init play button, no description column. The iframe is
        // sized 9:16 so the player never paints its blurred side-fill.
        // play_button=0 so our tap overlay + sound toggle own the chrome.
        return id
            ? safeUrl(
                   `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&muted=0&play_button=0&music_info=0&description=0&rel=0&progress_bar=0&volume_control=0&fullscreen_button=0`,
              )
            : null
    },
    // no static thumbnail without an extra API call
    poster() {
        return null
    },
}
