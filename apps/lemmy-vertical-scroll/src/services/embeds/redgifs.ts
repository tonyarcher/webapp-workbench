import type {EmbedProvider} from './types'
import {safeUrl} from '../url'

const REDGIFS_RE = /(?:^|[./])redgifs\.com\/(?:watch|ifr|i)\/([a-zA-Z0-9_-]+)/i

/** Extracts the redgifs clip id from a watch/embed page URL, or null. */
function redgifsId(url: string): string | null {
    const match = url.match(REDGIFS_RE)
    return match ? match[1] : null
}

export const REDGIFS: EmbedProvider = {
    name: 'redgifs',
    id: redgifsId,
    embedUrl(url) {
        const id = redgifsId(url ?? '')
        return id ? safeUrl(`https://www.redgifs.com/ifr/${id}`) : null
    },
    // redgifs has no static thumbnail without an extra API call, so the
    // placeholder stays blank until the slide becomes active.
    poster() {
        return null
    },
}
