export type ClipProvider = 'tiktok' | 'instagram'

export interface ClipLink {
    id: string
    url: string
    /** Missing on sessions saved before Instagram support — treat as tiktok. */
    provider?: ClipProvider
    author?: string
    /** Display name from oEmbed (`author_name`), when it differs from the handle. */
    authorName?: string
    /** ISO-ish timestamp from a TikTok data-export `Date:` line, if present. */
    date?: string
    /** Real `/@user/video/{id}` page, filled in after oEmbed. */
    pageUrl?: string
    title?: string
    thumbnailUrl?: string
}

export interface SkippedLink {
    url: string
    reason: 'short-link' | 'no-id' | 'not-tiktok' | 'unsupported'
}

export interface ParseResult {
    items: ClipLink[]
    skipped: SkippedLink[]
}

export interface SavedSession {
    version: 1
    items: ClipLink[]
    skipped: SkippedLink[]
    activeIndex: number
    maxSeen: number
}