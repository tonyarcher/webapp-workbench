export interface ScrollItem {
    id: string | number
    title: string
    body?: string | null
    url?: string | null
    mediaType?: 'Image' | 'Video' | 'Link' | 'Discussion' | null
    imageUrls?: string[]
    videoUrl?: string | null
    thumbnailUrl?: string | null
    linkUrl?: string | null
    nsfw?: boolean
    originalUrl?: string | null
    metaLine?: string
    stats?: {up: number; down: number; comments: number} | null
    date?: string | null
    author?: string
    /** Display name when it differs from `author` (the handle). */
    authorName?: string
}

export type ScrollMediaKind = 'image' | 'video' | 'text' | 'link'
