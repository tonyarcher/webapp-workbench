import {classifyScrollItem, extractImageUrls, stripImageProxy, aspectRatioFromUrl} from '../src/media'
import {safeUrl} from '../src/url'
import {timeAgo, compactNumber} from '../src/format'
import {registerEmbedProvider, EMBED_PROVIDERS, embedUrlFor} from '../src/embeds'
import type {EmbedProvider} from '../src/embeds/types'
import type {ScrollItem} from '../src/types'

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

const videoItem: ScrollItem = {id: 1, title: 'Video', mediaType: 'Video', videoUrl: 'https://example.com/vid.mp4'}
const imageItem: ScrollItem = {id: 2, title: 'Image', mediaType: 'Image', url: 'https://example.com/img.png', imageUrls: ['https://example.com/img.png']}
const textItem: ScrollItem = {id: 3, title: 'Hello', body: 'World'}
const linkItem: ScrollItem = {id: 4, title: 'Link', mediaType: 'Link', url: 'https://example.com/article', linkUrl: 'https://example.com/article'}
const ytItem: ScrollItem = {id: 5, title: 'YT', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}

// classify
assert(classifyScrollItem(videoItem) === 'video', 'video classify')
assert(classifyScrollItem(imageItem) === 'image', 'image classify')
assert(classifyScrollItem(textItem) === 'text', 'text classify')
assert(classifyScrollItem(linkItem) === 'link', 'link classify')
assert(classifyScrollItem(ytItem) === 'video', 'youtube video classify')

// image extraction
assert(extractImageUrls(imageItem).length === 1, 'image extraction')
const galleryItem: ScrollItem = {id: 6, title: 'G', body: '![a](https://x/a.png) ![b](https://x/b.png)', url: 'https://x/main.png'}
assert(extractImageUrls(galleryItem).length === 3, 'gallery extraction')

// safeUrl
assert(safeUrl('https://ok.com') === 'https://ok.com', 'safe url')
assert(safeUrl('javascript:alert(1)') === null, 'unsafe url')

// format
assert(timeAgo('2026-01-01T00:00:00Z', Date.parse('2026-01-02T00:00:00Z')) === '1d', 'timeAgo')
assert(compactNumber(1234) === '1.2K', 'compactNumber')
assert(compactNumber(3400000) === '3.4M', 'compactNumber M')

// embeds
assert(embedUrlFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.includes('youtube-nocookie.com'), 'youtube embed')
assert(embedUrlFor('https://www.redgifs.com/watch/abc')?.includes('redgifs.com'), 'redgifs embed')
assert(embedUrlFor('https://example.com/x') === null, 'no embed for plain url')

// registerEmbedProvider
const TIKTOK: EmbedProvider = {
    name: 'tiktok',
    id(url) { return /tiktok\.com\/.*\/video\/(\d+)/.test(url) ? url.match(/\/video\/(\d+)/)?.[1] ?? null : null },
    embedUrl(url) { const id = url?.match(/\/video\/(\d+)/)?.[1]; return id ? `https://www.tiktok.com/embed/v2/${id}` : null },
    poster() { return null },
}
registerEmbedProvider(TIKTOK)
assert(EMBED_PROVIDERS.length === 2, 'built-in count unchanged')
assert(embedUrlFor('https://www.tiktok.com/@user/video/1234567890')?.includes('tiktok.com/embed/v2/1234567890'), 'tiktok embed')

// stripImageProxy
assert(stripImageProxy('https://x/api/v3/image_proxy?url=https://real/img.png') === 'https://real/img.png', 'proxy strip')
assert(stripImageProxy('https://x/plain.png') === 'https://x/plain.png', 'plain url unchanged')

// aspectRatioFromUrl
assert(aspectRatioFromUrl('https://x/pictrs/img_1280x720.png') === 1280 / 720, 'aspect ratio')

console.log('smoke.ts: all assertions passed')
