import {safeUrl} from 'vertical-scroll-core'
import type {ClipProvider, ParseResult, SkippedLink, ClipLink} from '../types'

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

export function isInstagramHost(hostname: string): boolean {
    const host = hostname.toLowerCase()
    return (
        host === 'instagram.com' ||
        host.endsWith('.instagram.com') ||
        host === 'instagr.am' ||
        host.endsWith('.instagr.am')
    )
}

/** Short links (vm/vt hosts, /t/ paths) resolve server-side and carry no video id. */
function isTiktokShortLink(parsed: URL): boolean {
    const host = parsed.hostname.toLowerCase()
    return host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || parsed.pathname.startsWith('/t/')
}

function isInstagramShortLink(parsed: URL): boolean {
    const host = parsed.hostname.toLowerCase()
    return host === 'l.instagram.com' || host.endsWith('.l.instagram.com') || parsed.pathname.startsWith('/share/')
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

const IG_CODE_RE = /^[A-Za-z0-9_-]{5,64}$/

function instagramShortcode(path: string): string | null {
    const normalized = path.replace(/\/+$/, '') || '/'
    const direct = normalized.match(/^\/(reel|reels|p)\/([A-Za-z0-9_-]{5,64})(?:\/|$)/)
    if (direct && IG_CODE_RE.test(direct[2])) return direct[2]
    const nested = normalized.match(/^\/[^/]+\/(reel|reels|p)\/([A-Za-z0-9_-]{5,64})(?:\/|$)/)
    if (nested && IG_CODE_RE.test(nested[2])) return nested[2]
    return null
}

function instagramAuthor(path: string): string | null {
    const nested = path.match(/^\/([^/]+)\/(reel|reels|p)\//)
    if (!nested) return null
    const user = nested[1]
    if (user === 'reel' || user === 'reels' || user === 'p' || user === 'share') return null
    return user
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
function pushSkipped(skipped: SkippedLink[], seen: Set<string>, url: string, reason: SkippedLink['reason']): void {
    if (seen.has(url)) return
    seen.add(url)
    skipped.push({url, reason})
}

function parseInstagram(parsed: URL, safe: string, skipped: SkippedLink[], seen: Set<string>): {id: string; author: string | null} | null {
    if (isInstagramShortLink(parsed)) {
        pushSkipped(skipped, seen, safe, 'short-link')
        return null
    }
    const id = instagramShortcode(parsed.pathname)
    if (!id) {
        pushSkipped(skipped, seen, safe, 'no-id')
        return null
    }
    return {id, author: instagramAuthor(parsed.pathname)}
}

function parseTiktok(parsed: URL, safe: string, skipped: SkippedLink[], seen: Set<string>): {id: string; author: string | null} | null {
    if (isTiktokShortLink(parsed)) {
        pushSkipped(skipped, seen, safe, 'short-link')
        return null
    }
    const id = tiktokVideoId(parsed.pathname)
    if (!id) {
        pushSkipped(skipped, seen, safe, 'no-id')
        return null
    }
    return {id, author: authorFromPath(parsed.pathname)}
}

function parseUrlEntry(parsed: URL, safe: string, skipped: SkippedLink[], seen: Set<string>): {provider: ClipProvider; id: string; author: string | null} | null {
    if (isInstagramHost(parsed.hostname)) {
        const res = parseInstagram(parsed, safe, skipped, seen)
        return res ? {provider: 'instagram', ...res} : null
    }
    if (isTiktokHost(parsed.hostname)) {
        const res = parseTiktok(parsed, safe, skipped, seen)
        return res ? {provider: 'tiktok', ...res} : null
    }
    pushSkipped(skipped, seen, safe, 'unsupported')
    return null
}

function processLine(line: string, pending: {date: string | undefined}, items: ClipLink[], skipped: SkippedLink[], seenIds: Set<string>, seenSkipped: Set<string>): void {
    for (const raw of extractUrls(line)) {
        const safe = safeUrl(raw)
        if (!safe) continue
        const date = pending.date
        pending.date = undefined
        let parsed: URL
        try {
            parsed = new URL(safe)
        } catch {
            continue
        }
        const entry = parseUrlEntry(parsed, safe, skipped, seenSkipped)
        if (!entry) continue
        const dedupe = `${entry.provider}:${entry.id}`
        if (seenIds.has(dedupe)) continue
        seenIds.add(dedupe)
        const link: ClipLink = {id: entry.id, url: safe, provider: entry.provider}
        if (entry.author) link.author = entry.author
        if (date) link.date = date
        items.push(link)
    }
}

export function parseLinkList(input: string): ParseResult {
    const items: ClipLink[] = []
    const skipped: SkippedLink[] = []
    const seenIds = new Set<string>()
    const seenSkipped = new Set<string>()
    const pending: {date: string | undefined} = {date: undefined}
    for (const line of input.split(/\r?\n/)) {
        const dateMatch = line.match(DATE_LINE)
        if (dateMatch) {
            pending.date = dateMatch[1].trim()
            continue
        }
        processLine(line, pending, items, skipped, seenIds, seenSkipped)
    }
    return {items, skipped}
}