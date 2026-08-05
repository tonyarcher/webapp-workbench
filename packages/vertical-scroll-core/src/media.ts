import type {ScrollItem} from './types'
import {safeUrl} from './url'
import {embedProviderForUrl} from './embeds'
import {stripImageProxy} from './embeds/util'

export {stripImageProxy}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i
const IMAGE_LINK_RE = /!\[[^\]]*\]\((\S+)\)/g

function urlHasImageExt(url: string): boolean {
    return IMAGE_EXT.test(stripImageProxy(url))
}

function urlHasVideoExt(url: string): boolean {
    return VIDEO_EXT.test(stripImageProxy(url))
}

/**
 * Classifies a scroll item for the scroll view. Explicit provider types win
 * (PieFed's post_type, newer Lemmy's post_url_content_type); otherwise the
 * item URL is inspected, decoding instance image proxies first.
 */
export function classifyScrollItem(item: ScrollItem): 'image' | 'video' | 'text' | 'link' {
    switch (item.mediaType) {
        case 'Image':
            return 'image'
        case 'Video':
            return 'video'
        case 'Discussion':
            return 'text'
        case 'Link':
            break
    }
    if (item.url && embedProviderForUrl(item.url)) return 'video'
    if (item.videoUrl || (item.url && urlHasVideoExt(item.url))) return 'video'
    if (item.url && urlHasImageExt(item.url)) return 'image'
    if (item.url) return 'link'
    return 'text'
}

/**
 * All images for the scroll view: the item's own media first, then any
 * image links embedded in the markdown body, deduped.
 */
export function extractImageUrls(item: ScrollItem): string[] {
    const urls: string[] = []
    const push = (url: string | null): void => {
        if (url && urlHasImageExt(url) && !urls.includes(url)) urls.push(url)
    }
    push(item.url ?? null)
    if (item.body) {
        for (const match of item.body.matchAll(IMAGE_LINK_RE)) {
            const [, link] = match
            if (link && link !== item.url) push(link)
        }
    }
    return urls
}

/** Best-effort aspect ratio from a media URL (e.g. pictrs `..._1280x720.png`), null otherwise. */
export function aspectRatioFromUrl(url: string | null): number | null {
    if (!url) return null
    const match = stripImageProxy(url).match(/_(\d{2,4})x(\d{2,4})\./)
    if (!match) return null
    const w = Number(match[1])
    const h = Number(match[2])
    return w > 0 && h > 0 ? w / h : null
}

// ---- embed providers ----

export interface ResolvedVideo {
    /** First source to try. */
    src: string | null
    poster: string | null
    /** Additional sources to try in order if playback fails. */
    candidates: string[]
}

/**
 * Resolves a direct media source for the scroll player. Only used for
 * non-embed videos; embed-site posts are played through the provider's
 * official iframe player (see the embeds registry) instead of a <video>.
 */
export function resolveVideoUrl(videoUrl: string | null): ResolvedVideo {
    if (!videoUrl) return {src: null, poster: null, candidates: []}
    // embed-site pages must go through the iframe player, never a <video> element
    if (embedProviderForUrl(videoUrl)) return {src: null, poster: null, candidates: []}
    const safe = safeUrl(videoUrl)
    return safe ? {src: safe, poster: null, candidates: []} : {src: null, poster: null, candidates: []}
}
