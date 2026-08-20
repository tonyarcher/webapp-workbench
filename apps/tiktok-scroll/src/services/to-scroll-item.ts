import type {ScrollItem} from 'vertical-scroll-core'
import type {TikTokLink} from '../types'

export function toScrollItem(link: TikTokLink, index: number, total: number): ScrollItem {
    const page = link.pageUrl ?? link.url
    return {
        id: link.id,
        title: link.title ?? (link.author ? `@${link.author}` : ''),
        author: link.author,
        mediaType: 'Video',
        videoUrl: page,
        url: page,
        originalUrl: page,
        thumbnailUrl: link.thumbnailUrl,
        metaLine: link.date ? `${index + 1} of ${total} · ${link.date}` : `${index + 1} of ${total}`,
    }
}