import {safeUrl} from 'vertical-scroll-core'
import type {ParseResult, SkippedLink, TikTokLink} from '../types'

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi
const ID_RE = /^\d{6,32}$/
/** CSV cells can be separated by comma, tab, semicolon, or newline. */
const CELL_DELIM = /[\n\r\t,;]+/
/** Trailing punctuation that is sentence/CSV noise, never part of the URL. */
const TRAILING_PUNCT = /[,.;)]+$/

export function isTiktokHost(hostname: string): boolean {
    const host = hostname.toLowerCase()
    return (
        host === 'tiktok.com' ||
        host.endsWith('.tiktok.com') ||
        host === 'tiktokv.com' ||
        host.endsWith('.tiktokv.com')
    )
}

/** Short links (vm/vt hosts, /t/ paths) resolve server-side and carry no video id. */
function isShortLink(parsed: URL): boolean {
    const host = parsed.hostname.toLowerCase()
    return host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || parsed.pathname.startsWith('/t/')
}

function validId(raw: string): string | null {
    const id = raw.replace(/\.html$/i, '')
    return ID_RE.test(id) ? id : null
}

/**
 * Extracts the numeric video id from a TikTok page path. `/video/` is
 * checked first so `/@user/video/{id}` and `/video/{id}` win over the
 * shorter `/v/{id}` mobile form.
 */
function tiktokVideoId(path: string): string | null {
    const share = path.match(/\/share\/video\/(\d{6,32})/)
    if (share) return share[1]
    const video = path.match(/(?:^|\/)video\/(\d{6,32})/)
    if (video) return video[1]
    const v = path.match(/(?:^|\/)v\/(\d{6,32})(?:\.html)?/i)
    if (v) return validId(v[1])
    const embed = path.match(/\/embed\/v2\/(\d{6,32})/)
    if (embed) return embed[1]
    const player = path.match(/\/player\/v1\/(\d{6,32})/)
    if (player) return player[1]
    return null
}

function authorFromPath(path: string): string | null {
    const match = path.match(/\/@([^/]+)\//)
    return match ? match[1] : null
}

/**
 * Splits the raw input into cells first (CSV separators), then pulls URLs
 * out of each cell. Splitting on commas/tabs/semicolons keeps a URL in its
 * own CSV column from swallowing the following column's text.
 */
function extractUrls(input: string): string[] {
    const urls: string[] = []
    for (const cell of input.split(CELL_DELIM)) {
        for (const match of cell.matchAll(URL_RE)) {
            urls.push(match[0].replace(TRAILING_PUNCT, ''))
        }
    }
    return urls
}

const DATE_LINE = /^Date:\s*(.+)$/i

/**
 * Walks the input line-by-line so a TikTok data-export `Date:` line
 * attaches to the following `Link:`. URLs on any other line still parse
 * (paste / csv). Export share URLs are kept as-is; `/video/{id}` without
 * `@user` 404s on tiktok.com, so we never invent that path.
 */
export function parseLinkList(input: string): ParseResult {
    const items: TikTokLink[] = []
    const skipped: SkippedLink[] = []
    const seenIds = new Set<string>()
    const seenSkipped = new Set<string>()
    let pendingDate: string | undefined
    for (const line of input.split(/\r?\n/)) {
        const dateMatch = line.match(DATE_LINE)
        if (dateMatch) {
            pendingDate = dateMatch[1].trim()
            continue
        }
        for (const raw of extractUrls(line)) {
            const safe = safeUrl(raw)
            if (!safe) continue
            // consume Date: once per following URL, even if that URL is skipped,
            // so a short-link after Date: cannot stamp the next playable item
            const date = pendingDate
            pendingDate = undefined
            let parsed: URL
            try {
                parsed = new URL(safe)
            } catch {
                continue
            }
            if (!isTiktokHost(parsed.hostname)) {
                if (!seenSkipped.has(safe)) {
                    seenSkipped.add(safe)
                    skipped.push({url: safe, reason: 'not-tiktok'})
                }
                continue
            }
            if (isShortLink(parsed)) {
                if (!seenSkipped.has(safe)) {
                    seenSkipped.add(safe)
                    skipped.push({url: safe, reason: 'short-link'})
                }
                continue
            }
            const id = tiktokVideoId(parsed.pathname)
            if (!id) {
                if (!seenSkipped.has(safe)) {
                    seenSkipped.add(safe)
                    skipped.push({url: safe, reason: 'no-id'})
                }
                continue
            }
            if (seenIds.has(id)) continue
            seenIds.add(id)
            const author = authorFromPath(parsed.pathname)
            const link: TikTokLink = {id, url: safe}
            if (author) link.author = author
            if (date) link.date = date
            items.push(link)
        }
    }
    return {items, skipped}
}