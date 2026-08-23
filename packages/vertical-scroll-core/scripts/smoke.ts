import {classifyScrollItem, extractImageUrls, stripImageProxy, aspectRatioFromUrl} from '../src/media'
import {safeUrl} from '../src/url'
import {timeAgo, compactNumber} from '../src/format'
import {registerEmbedProvider, EMBED_PROVIDERS, embedUrlFor, embedProviderForUrl} from '../src/embeds'
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
const ttItem: ScrollItem = {id: 7, title: 'TT', videoUrl: 'https://www.tiktok.com/@user/video/1234567890'}
const ttLinkItem: ScrollItem = {id: 8, title: 'TT link', url: 'https://www.tiktok.com/@user/video/1234567890'}

// classify
assert(classifyScrollItem(videoItem) === 'video', 'video classify')
assert(classifyScrollItem(imageItem) === 'image', 'image classify')
assert(classifyScrollItem(textItem) === 'text', 'text classify')
assert(classifyScrollItem(linkItem) === 'link', 'link classify')
assert(classifyScrollItem(ytItem) === 'video', 'youtube video classify')
assert(classifyScrollItem(ttItem) === 'video', 'tiktok video classify')
assert(classifyScrollItem(ttLinkItem) === 'video', 'tiktok url-only classifies as video')
assert(embedUrlFor(ttLinkItem.url)?.includes('player/v1/1234567890'), 'tiktok url-only embed')

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
assert(EMBED_PROVIDERS.length === 4, 'built-in count includes instagram')
assert(embedUrlFor('https://www.tiktok.com/@user/video/1234567890')?.includes('tiktok.com/player/v1/1234567890'), 'tiktok @user/video embed')
assert(embedUrlFor('https://www.tiktok.com/@user/video/1234567890')?.includes('autoplay=1'), 'tiktok autoplay param')
assert(embedUrlFor('https://www.tiktok.com/@user/video/1234567890')?.includes('muted=0'), 'tiktok not locked muted')
assert(embedUrlFor('https://m.tiktok.com/v/1234567890.html')?.includes('player/v1/1234567890'), 'tiktok mobile embed')
assert(embedUrlFor('https://www.tiktok.com/embed/v2/1234567890')?.includes('player/v1/1234567890'), 'tiktok embed/v2 url')
assert(embedUrlFor('https://www.tiktok.com/player/v1/1234567890')?.includes('player/v1/1234567890'), 'tiktok player url')
assert(embedUrlFor('https://www.instagram.com/reel/CxYz123AbCd/')?.includes('/p/CxYz123AbCd/embed'), 'instagram reel embed')
assert(embedUrlFor('https://www.instagram.com/p/CxYz123AbCd/')?.includes('/p/CxYz123AbCd/embed'), 'instagram p embed')
assert(embedUrlFor('https://www.instagram.com/someone/reel/CxYz123AbCd/')?.includes('/p/CxYz123AbCd/embed'), 'instagram user/reel embed')
assert(embedUrlFor('https://www.instagr.am/reel/CxYz123AbCd/')?.includes('/p/CxYz123AbCd/embed'), 'instagr.am reel embed')
assert(embedUrlFor('https://l.instagram.com/p/CxYz123AbCd/') === null, 'instagram l. short host has no id')
assert(embedUrlFor('https://www.instagram.com/share/reel/xxxx/') === null, 'instagram share path has no id')
assert(embedProviderForUrl('https://www.instagram.com/reel/CxYz123AbCd/')?.name === 'instagram', 'instagram provider name')
assert(embedUrlFor('https://vm.tiktok.com/ZMxxxx/') === null, 'tiktok short link has no id')
assert(
    embedUrlFor('https://www.tiktokv.com/share/video/7450092027154566446/')?.includes('player/v1/7450092027154566446'),
    'tiktokv data-export share url',
)
{
    const provider = embedProviderForUrl('https://www.tiktok.com/@u/video/1234567890')
    assert(provider?.commandPlayer !== undefined, 'tiktok has commandPlayer')
    assert(provider?.isPlayerReadyMessage?.({type: 'onPlayerReady', 'x-tiktok-player': true}), 'tiktok player/v1 ready msg')
    assert(!provider?.isPlayerReadyMessage?.({type: 'onPlayerReady', 'x-tiktok-embed': true}), 'embed/v2 flag ignored')
    assert(!provider?.isPlayerReadyMessage?.({type: 'onStateChange', 'x-tiktok-player': true}), 'tiktok other msg ignored')
    assert(provider?.parsePlayerMessage?.({type: 'onStateChange', value: 1, 'x-tiktok-player': true})?.type === 'playing', 'state playing')
    assert(provider?.parsePlayerMessage?.({type: 'onStateChange', value: 2, 'x-tiktok-player': true})?.type === 'paused', 'state paused')
    assert(
        provider?.parsePlayerMessage?.({
            type: 'onCurrentTime',
            value: {currentTime: 3, duration: 10},
            'x-tiktok-player': true,
        })?.type === 'time',
        'time event',
    )
    assert(typeof provider?.seekPlayer === 'function', 'seekPlayer present')
}

// registerEmbedProvider — fake third-party so built-in count stays stable
const FAKE: EmbedProvider = {
    name: 'fake',
    id(url) { return /example-embed\.test\/v\/(\w+)/.test(url) ? url.match(/\/v\/(\w+)/)?.[1] ?? null : null },
    embedUrl(url) { const id = url?.match(/\/v\/(\w+)/)?.[1]; return id ? `https://example-embed.test/embed/${id}` : null },
    poster() { return null },
}
registerEmbedProvider(FAKE)
assert(EMBED_PROVIDERS.length === 4, 'built-in count unchanged after register')
assert(embedUrlFor('https://example-embed.test/v/abc')?.includes('example-embed.test/embed/abc'), 'registered provider')

// stripImageProxy
assert(stripImageProxy('https://x/api/v3/image_proxy?url=https://real/img.png') === 'https://real/img.png', 'proxy strip')
assert(stripImageProxy('https://x/plain.png') === 'https://x/plain.png', 'plain url unchanged')

// aspectRatioFromUrl
assert(aspectRatioFromUrl('https://x/pictrs/img_1280x720.png') === 1280 / 720, 'aspect ratio')

console.log('smoke.ts: all assertions passed')
