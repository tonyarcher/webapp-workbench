import type {EmbedProvider} from './types'
import {safeUrl} from '../url'

const YOUTUBE_HOST_RE = /(?:^|[./])(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\//i
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,64}$/

function isValidId(id: string | null): string | null {
    return id && YOUTUBE_ID_RE.test(id) ? id : null
}

/** First path segment after a fixed prefix, e.g. '/shorts/abc/...' -> 'abc'. */
function pathSegmentAfter(path: string, prefix: string): string | null {
    if (!path.startsWith(prefix)) return null
    const rest = path.slice(prefix.length)
    return rest.split('/')[0] || null
}

function parseUrlSafe(url: string): URL | null {
    try {
        return new URL(url)
    } catch {
        return null
    }
}

function isYoutuHost(host: string): boolean {
    return host === 'youtu.be'
}

function isYoutubeHost(host: string): boolean {
    return host === 'youtube.com' || host.endsWith('.youtube.com')
}

function isNocookieHost(host: string): boolean {
    return host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')
}

function youtubeIdFromWatch(parsed: URL): string | null {
    if (parsed.pathname === '/watch' || parsed.pathname.startsWith('/watch/')) {
        return isValidId(parsed.searchParams.get('v'))
    }
    return null
}

function youtubeIdFromPath(parsed: URL): string | null {
    for (const prefix of ['/embed/', '/shorts/', '/live/']) {
        const id = pathSegmentAfter(parsed.pathname, prefix)
        if (id) return isValidId(id)
    }
    return null
}

function youtubeId(url: string): string | null {
    if (!YOUTUBE_HOST_RE.test(url)) return null
    const parsed = parseUrlSafe(url)
    if (!parsed) return null
    const host = parsed.hostname.toLowerCase()
    if (isYoutuHost(host)) return isValidId(pathSegmentAfter(parsed.pathname, '/'))
    if (isYoutubeHost(host) || isNocookieHost(host)) return youtubeIdFromWatch(parsed) ?? youtubeIdFromPath(parsed)
    return null
}

export const YOUTUBE: EmbedProvider = {
    name: 'youtube',
    id: youtubeId,
    // YouTube identifies the embedding page via the HTTP Referer header and
    // fails with Error 153 when it's stripped, so this overrides the
    // no-referrer default. Sends only the app origin to YouTube.
    iframeReferrerPolicy: 'strict-origin-when-cross-origin',
    embedUrl(url) {
        const id = youtubeId(url ?? '')
        // privacy-enhanced host; plain youtube.com sets cookies even before playback
        return id ? safeUrl(`https://www.youtube-nocookie.com/embed/${id}`) : null
    },
    poster(id) {
        // public thumbnail feed, no API call required
        return safeUrl(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
    },
}
