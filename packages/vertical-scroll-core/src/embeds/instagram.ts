import type {EmbedProvider} from './types'
import {safeUrl} from '../url'

const IG_HOST_RE = /(?:^|[./])(?:instagram\.com|instagr\.am)\//i
const IG_CODE_RE = /^[A-Za-z0-9_-]{5,64}$/

function isValidCode(code: string | null): string | null {
    return code && IG_CODE_RE.test(code) ? code : null
}

function pathSegmentAfter(path: string, prefix: string): string | null {
    if (!path.startsWith(prefix)) return null
    const rest = path.slice(prefix.length)
    return rest.split('/')[0] || null
}

/**
 * Instagram reel/post shortcode from a page URL. Short links
 * (l.instagram.com, /share/…) have no code and return null.
 */
export function instagramId(url: string): string | null {
    if (!IG_HOST_RE.test(url)) return null
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return null
    }
    const host = parsed.hostname.toLowerCase()
    const isIg =
        host === 'instagram.com' ||
        host.endsWith('.instagram.com') ||
        host === 'instagr.am' ||
        host.endsWith('.instagr.am')
    if (!isIg) return null
    if (host === 'l.instagram.com' || host.endsWith('.l.instagram.com')) return null

    const path = parsed.pathname.replace(/\/+$/, '') || '/'
    if (path.startsWith('/share/')) return null

    for (const prefix of ['/reel/', '/reels/', '/p/']) {
        const code = isValidCode(pathSegmentAfter(path + '/', prefix))
        if (code) return code
    }

    // /{user}/reel/{code} or /{user}/p/{code}
    const nested = path.match(/^\/[^/]+\/(reel|reels|p)\/([A-Za-z0-9_-]{5,64})(?:\/|$)/)
    if (nested) return isValidCode(nested[2])

    return null
}

export const INSTAGRAM: EmbedProvider = {
    name: 'instagram',
    id: instagramId,
    iframeReferrerPolicy: 'strict-origin-when-cross-origin',
    // No iframeAspect: that flag drives TikTok's card-scaling hack
    // (325px card + pointer-events:none) which would make the embed
    // unplayable here — Instagram has no commandPlayer, so the user must
    // click the iframe's own play button. The `portrait` class in
    // media-video.ts still frames it 9:16.
    embedUrl(url) {
        const code = instagramId(url ?? '')
        // /p/{code}/embed is the documented iframe and works for reels too.
        return code ? safeUrl(`https://www.instagram.com/p/${code}/embed`) : null
    },
    poster() {
        return null
    },
}
