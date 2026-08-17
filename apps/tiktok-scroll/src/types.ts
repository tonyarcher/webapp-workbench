export interface TikTokLink {
    id: string
    url: string
    author?: string
    /** ISO-ish timestamp from a TikTok data-export `Date:` line, if present. */
    date?: string
    /** Real `/@user/video/{id}` page, filled in after oEmbed. */
    pageUrl?: string
    title?: string
    thumbnailUrl?: string
}

export interface SkippedLink {
    url: string
    reason: 'short-link' | 'no-id' | 'not-tiktok'
}

export interface ParseResult {
    items: TikTokLink[]
    skipped: SkippedLink[]
}

export interface SavedSession {
    version: 1
    items: TikTokLink[]
    skipped: SkippedLink[]
    activeIndex: number
    maxSeen: number
}