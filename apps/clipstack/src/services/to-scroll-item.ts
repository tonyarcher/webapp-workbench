import type {ScrollItem} from 'vertical-scroll-core'
import type {ClipLink} from '../types'

export function toScrollItem(link: ClipLink, index: number, total: number): ScrollItem {
    const page = link.pageUrl ?? link.url
    const item: ScrollItem = {
        id: link.id,
        title: link.title ?? (link.author ? `@${link.author}` : ''),
        mediaType: 'Video',
        videoUrl: page,
        url: page,
        originalUrl: page,
        metaLine: link.date ? `${index + 1} of ${total} · ${link.date}` : `${index + 1} of ${total}`,
    }
    if (link.author !== undefined) item.author = link.author
    if (link.authorName !== undefined) item.authorName = link.authorName
    if (link.thumbnailUrl !== undefined) item.thumbnailUrl = link.thumbnailUrl
    return item
}