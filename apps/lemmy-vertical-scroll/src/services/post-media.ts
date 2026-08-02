import type {LemmyPost} from '../types'
import {safeUrl} from './url'

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp)(\?|#|$)/i
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|#|$)/i
const IMAGE_LINK_RE = /!\[[^\]]*\]\((\S+)\)/g
const REDGIFS_RE = /(?:^|[./])redgifs\.com\/(?:watch|ifr|i)\/([a-zA-Z0-9_-]+)/i

/**
 * Resolves the final URL an instance-side image proxy is fronting, so
 * content-type inference can see the real extension.
 */
export function stripImageProxy(url: string): string {
    try {
        const parsed = new URL(url)
        if (parsed.pathname.includes('/image_proxy') || parsed.pathname.includes('/proxy/image')) {
            const target = parsed.searchParams.get('url')
            if (target) return target
        }
    } catch {
        // not a URL we can parse — fall through
    }
    return url
}

function urlHasImageExt(url: string): boolean {
    return IMAGE_EXT.test(stripImageProxy(url))
}

function urlHasVideoExt(url: string): boolean {
    return VIDEO_EXT.test(stripImageProxy(url))
}

/**
 * Classifies a post for the scroll view. Explicit provider types win
 * (PieFed's post_type, newer Lemmy's post_url_content_type); otherwise the
 * post URL is inspected, decoding instance image proxies first.
 */
export function classifyPost(post: LemmyPost): 'image' | 'video' | 'text' | 'link' {
    switch (post.postType) {
        case 'Image':
            return 'image'
        case 'Video':
            return 'video'
        case 'Discussion':
            return 'text'
        case 'Link':
            break
    }
    if (post.url && redgifsId(post.url)) return 'video'
    if (post.videoUrl || (post.url && urlHasVideoExt(post.url))) return 'video'
    if (post.url && urlHasImageExt(post.url)) return 'image'
    if (post.url) return 'link'
    return 'text'
}

/**
 * All images for the scroll view: the post's own media first, then any
 * image links embedded in the markdown body, deduped.
 */
export function extractImageUrls(post: LemmyPost): string[] {
    const urls: string[] = []
    const push = (url: string | null): void => {
        if (url && urlHasImageExt(url) && !urls.includes(url)) urls.push(url)
    }
    push(post.url)
    if (post.body) {
        for (const match of post.body.matchAll(IMAGE_LINK_RE)) {
            const [, link] = match
            if (link && link !== post.url) push(link)
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

// ---- embed providers (redgifs and friends) ----

/** Extracts the redgifs clip id from a watch/embed page URL, or null. */
export function redgifsId(url: string): string | null {
    const match = stripImageProxy(url).match(REDGIFS_RE)
    return match ? match[1] : null
}

export function isRedgifsUrl(url: string | null): boolean {
    return !!url && redgifsId(url) !== null
}

export interface ResolvedVideo {
    /** First source to try. */
    src: string | null
    poster: string | null
    /** Additional sources to try in order if playback fails. */
    candidates: string[]
}

/**
 * Redgifs refuses cross-origin media loads from browsers (403 + text/html,
 * which the browser ORB-blocks), so redgifs posts are played through the
 * platform's official embed player instead of a <video> element.
 */
export function redgifsEmbedUrl(url: string | null): string | null {
    const id = redgifsId(url ?? '')
    return id ? safeUrl(`https://www.redgifs.com/ifr/${id}`) : null
}

/**
 * Resolves a direct media source for the scroll player. Only used for
 * non-redgifs videos; redgifs posts go through redgifsEmbedUrl instead.
 */
export function resolveVideoUrl(videoUrl: string | null): ResolvedVideo {
    if (!videoUrl) return {src: null, poster: null, candidates: []}
    // redgifs pages must go through the embed player, never a <video> element
    if (redgifsId(videoUrl)) return {src: null, poster: null, candidates: []}
    const safe = safeUrl(videoUrl)
    return safe ? {src: safe, poster: null, candidates: []} : {src: null, poster: null, candidates: []}
}
