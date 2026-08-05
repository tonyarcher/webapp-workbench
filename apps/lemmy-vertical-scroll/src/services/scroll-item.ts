import type {ScrollItem} from 'vertical-scroll-core'
import type {LemmyPost} from '../types'
import {timeAgo} from './format'

export function toScrollItem(post: LemmyPost): ScrollItem {
    return {
        id: post.id,
        title: post.name,
        body: post.body,
        url: post.url,
        mediaType: post.postType,
        imageUrls: post.imageUrls,
        videoUrl: post.videoUrl,
        thumbnailUrl: post.thumbnailUrl,
        linkUrl: post.linkUrl,
        nsfw: post.nsfw,
        originalUrl: post.postUrl,
        metaLine: `${post.communityTitle} • ${post.creatorDisplayName ?? post.creatorName} • ${timeAgo(post.published)}`,
        stats: {up: post.upvotes, down: post.downvotes, comments: post.comments},
    }
}
