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
function tiktokId(url: string): string | null {
    if (!TIKTOK_HOST_RE.test(url)) return null
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return null
    }
    const host = parsed.hostname.toLowerCase()
    const isTiktok =
        host === 'tiktok.com' ||
        host.endsWith('.tiktok.com') ||
        host === 'tiktokv.com' ||
        host.endsWith('.tiktokv.com')
    if (!isTiktok) return null

    const path = parsed.pathname
    // /share/video/ is the official data-export form (tiktokv.com)
    for (const prefix of ['/share/video/', '/video/', '/embed/v2/', '/player/v1/', '/v/']) {
        const raw = pathSegmentAfter(path, prefix)
        if (!raw) continue
        // mobile pages look like /v/1234567890.html
        const id = raw.replace(/\.html$/i, '')
        const valid = isValidId(id)
        if (valid) return valid
    }

    // /@user/video/{id} — pathname is not prefixed with /video/, so the
    // loop above misses it.
    const atVideo = path.match(/\/video\/(\d+)/)
    if (atVideo) return isValidId(atVideo[1])

    return null
}

const TIKTOK_PLAYER_ORIGIN = 'https://www.tiktok.com'
/** Official embed player (player/v1) bus. embed/v2 uses `x-tiktok-embed`. */
const TIKTOK_PLAYER_FLAG = 'x-tiktok-player'

function isPlayerReadyMessage(data: unknown): boolean {
    return parsePlayerMessage(data)?.type === 'ready'
}

function parsePlayerMessage(data: unknown): EmbedPlayerEvent | null {
    if (!data || typeof data !== 'object') return null
    const msg = data as Record<string, unknown>
    if (msg[TIKTOK_PLAYER_FLAG] !== true) return null
    if (msg.type === 'onPlayerReady') return {type: 'ready'}
    if (msg.type === 'onStateChange') {
        // player/v1 mirrors YouTube-style codes: 1 playing, 2 paused, 0 ended
        if (msg.value === 1) return {type: 'playing'}
        if (msg.value === 2) return {type: 'paused'}
        if (msg.value === 0) return {type: 'ended'}
        return null
    }
    if (msg.type === 'onCurrentTime' && msg.value && typeof msg.value === 'object') {
        const value = msg.value as {currentTime?: unknown; duration?: unknown}
        const currentTime = typeof value.currentTime === 'number' ? value.currentTime : null
        const duration = typeof value.duration === 'number' ? value.duration : null
        if (currentTime === null || duration === null || duration <= 0) return null
        return {type: 'time', currentTime, duration}
    }
    return null
}

function commandPlayer(win: Window, command: 'play' | 'pause' | 'mute' | 'unmute'): void {
    const type = command === 'unmute' ? 'unMute' : command
    const msg: Record<string, unknown> = {type, [TIKTOK_PLAYER_FLAG]: true}
    if (command === 'mute') msg.value = true
    win.postMessage(msg, TIKTOK_PLAYER_ORIGIN)
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
        // giant init play button, no description column. play_button=0 so
        // our tap overlay + sound toggle own the chrome.
        return id
            ? safeUrl(
                  `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&play_button=0&music_info=0&description=0&rel=0&progress_bar=0&volume_control=0&fullscreen_button=0`,
              )
            : null
    },
    // no static thumbnail without an extra API call
    poster() {
        return null
    },
}
