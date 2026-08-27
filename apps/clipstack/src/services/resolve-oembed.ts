import {safeUrl} from 'vertical-scroll-core'

export interface OEmbedInfo {
    author?: string
    authorName?: string
    title?: string
    pageUrl?: string
    thumbnailUrl?: string
}

/**
 * TikTok's oEmbed endpoint accepts a dummy `/@x/video/{id}` cite and
 * returns the real author + page. `/video/{id}` without `@user` 404s, and
 * tiktokv.com share URLs are rejected (400), so this probe is the
 * client-side transformer for data-export ids.
 */
const OEMBED_TIMEOUT_MS = 8_000

export async function resolveTiktokOEmbed(id: string, signal?: AbortSignal): Promise<OEmbedInfo | null> {
    const probe = `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@x/video/${id}`)}`
    const timeout = AbortSignal.timeout(OEMBED_TIMEOUT_MS)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    const response = await fetch(probe, {signal: combined})
    if (!response.ok) return null
    const data = (await response.json()) as {
        author_unique_id?: unknown
        author_name?: unknown
        title?: unknown
        thumbnail_url?: unknown
    }
    const author = typeof data.author_unique_id === 'string' && data.author_unique_id ? data.author_unique_id : undefined
    const authorName = typeof data.author_name === 'string' && data.author_name ? data.author_name : undefined
    const title = typeof data.title === 'string' && data.title ? data.title : undefined
    const thumbnailUrl = typeof data.thumbnail_url === 'string' ? safeUrl(data.thumbnail_url) ?? undefined : undefined
    const pageUrl = author ? `https://www.tiktok.com/@${author}/video/${id}` : undefined
    if (!author && !authorName && !title && !pageUrl && !thumbnailUrl) return null
    const info: OEmbedInfo = {}
    if (author) info.author = author
    if (authorName) info.authorName = authorName
    if (title) info.title = title
    if (pageUrl) info.pageUrl = pageUrl
    if (thumbnailUrl) info.thumbnailUrl = thumbnailUrl
    return info
}
