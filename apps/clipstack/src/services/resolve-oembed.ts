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

function combinedSignal(signal: AbortSignal | undefined): AbortSignal {
    const timeout = AbortSignal.timeout(OEMBED_TIMEOUT_MS)
    return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function extractString(data: Record<string, unknown>, key: string): string | undefined {
    const v = data[key]
    return typeof v === 'string' && v ? v : undefined
}

function thumbFrom(data: Record<string, unknown>): string | undefined {
    const raw = data.thumbnail_url
    return typeof raw === 'string' ? safeUrl(raw) ?? undefined : undefined
}

function hasValue(...vals: (string | undefined)[]): boolean {
    return vals.some((v) => !!v)
}

function assignInfo(target: OEmbedInfo, key: keyof OEmbedInfo, value: string | undefined): void {
    if (value) target[key] = value
}

function buildInfo(id: string, data: Record<string, unknown>): OEmbedInfo | null {
    const author = extractString(data, 'author_unique_id')
    const authorName = extractString(data, 'author_name')
    const title = extractString(data, 'title')
    const thumbnailUrl = thumbFrom(data)
    const pageUrl = author ? `https://www.tiktok.com/@${author}/video/${id}` : undefined
    if (!hasValue(author, authorName, title, pageUrl, thumbnailUrl)) return null
    const info: OEmbedInfo = {}
    assignInfo(info, 'author', author)
    assignInfo(info, 'authorName', authorName)
    assignInfo(info, 'title', title)
    assignInfo(info, 'pageUrl', pageUrl)
    assignInfo(info, 'thumbnailUrl', thumbnailUrl)
    return info
}

/**
 * Only the clip being watched may be probed. A lookahead window used to
 * prefetch neighbors and hammered TikTok when the rail jumped or paged.
 */
export function watchedOEmbedIndex(activeIndex: number, length: number): number | null {
    if (activeIndex < 0 || activeIndex >= length) return null
    return activeIndex
}

export async function resolveTiktokOEmbed(id: string, signal?: AbortSignal): Promise<OEmbedInfo | null> {
    const probe = `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@x/video/${id}`)}`
    const response = await fetch(probe, {signal: combinedSignal(signal)})
    if (!response.ok) return null
    const data = (await response.json()) as Record<string, unknown>
    return buildInfo(id, data)
}
