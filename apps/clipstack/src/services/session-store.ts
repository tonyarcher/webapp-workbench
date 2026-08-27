import type {SavedSession, SkippedLink, ClipLink} from '../types'

export const SESSION_KEY = 'cs-session'
const PROGRESS_KEY = 'cs-session-progress'
const LEGACY_SESSION_KEY = 'tts-session'
const LEGACY_PROGRESS_KEY = 'tts-session-progress'

function compactLink(link: ClipLink): ClipLink {
    const out: ClipLink = {id: link.id, url: link.url}
    if (link.provider) out.provider = link.provider
    if (link.author) out.author = link.author
    if (link.authorName) out.authorName = link.authorName
    if (link.date) out.date = link.date
    if (link.pageUrl) out.pageUrl = link.pageUrl
    if (link.title) out.title = link.title
    if (link.thumbnailUrl) out.thumbnailUrl = link.thumbnailUrl
    return out
}

function isLink(value: unknown): value is ClipLink {
    if (!value || typeof value !== 'object') return false
    const link = value as ClipLink
    return typeof link.id === 'string' && link.id.length > 0 && typeof link.url === 'string' && link.url.length > 0
}

function isSkipped(value: unknown): value is SkippedLink {
    if (!value || typeof value !== 'object') return false
    const skipped = value as SkippedLink
    return (
        typeof skipped.url === 'string' &&
        (skipped.reason === 'short-link' ||
            skipped.reason === 'no-id' ||
            skipped.reason === 'not-tiktok' ||
            skipped.reason === 'unsupported')
    )
}

/** Parse a stored session blob. Returns null when missing or corrupt. */
export function parseSession(raw: string | null): SavedSession | null {
    if (!raw) return null
    try {
        const data = JSON.parse(raw) as unknown
        if (!data || typeof data !== 'object') return null
        const session = data as Partial<SavedSession>
        if (session.version !== 1 || !Array.isArray(session.items) || session.items.length === 0) return null
        const items = session.items.filter(isLink)
        if (items.length === 0) return null
        const skipped = Array.isArray(session.skipped) ? session.skipped.filter(isSkipped) : []
        const activeIndex = typeof session.activeIndex === 'number' && session.activeIndex >= 0 ? Math.floor(session.activeIndex) : 0
        const maxSeen = typeof session.maxSeen === 'number' && session.maxSeen >= 0 ? Math.floor(session.maxSeen) : activeIndex
        return {version: 1, items, skipped, activeIndex, maxSeen}
    } catch {
        return null
    }
}

export function serializeSession(session: SavedSession): string {
    const payload: SavedSession = {
        version: 1,
        items: session.items.map(compactLink),
        skipped: session.skipped,
        activeIndex: session.activeIndex,
        maxSeen: session.maxSeen,
    }
    return JSON.stringify(payload)
}

function readStored(key: string, legacy: string): string | null {
    return localStorage.getItem(key) ?? localStorage.getItem(legacy)
}

export function loadSession(): SavedSession | null {
    try {
        const session = parseSession(readStored(SESSION_KEY, LEGACY_SESSION_KEY))
        if (!session) return null
        const progressRaw = readStored(PROGRESS_KEY, LEGACY_PROGRESS_KEY)
        if (progressRaw) {
            const progress = JSON.parse(progressRaw) as {activeIndex?: unknown; maxSeen?: unknown}
            if (typeof progress.activeIndex === 'number' && progress.activeIndex >= 0) {
                session.activeIndex = Math.floor(progress.activeIndex)
            }
            if (typeof progress.maxSeen === 'number' && progress.maxSeen >= 0) {
                session.maxSeen = Math.floor(progress.maxSeen)
            }
        }
        return session
    } catch {
        return null
    }
}

export function saveSession(session: SavedSession): void {
    try {
        localStorage.setItem(SESSION_KEY, serializeSession(session))
        localStorage.setItem(
            PROGRESS_KEY,
            JSON.stringify({activeIndex: session.activeIndex, maxSeen: session.maxSeen}),
        )
        localStorage.removeItem(LEGACY_SESSION_KEY)
        localStorage.removeItem(LEGACY_PROGRESS_KEY)
    } catch {
        // quota / private mode — list stays in memory for this visit
    }
}

/** Write enriched author/title/pageUrl without touching the progress cursor. */
export function saveSessionItems(items: ClipLink[]): void {
    try {
        const session = parseSession(readStored(SESSION_KEY, LEGACY_SESSION_KEY))
        if (!session) return
        session.items = items.map(compactLink)
        localStorage.setItem(SESSION_KEY, serializeSession(session))
    } catch {
        // ignore
    }
}

/** Write only the cursor so scrolling a long list does not re-serialize every row. */
export function saveProgress(activeIndex: number, maxSeen: number): void {
    try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify({activeIndex, maxSeen}))
    } catch {
        // ignore
    }
}

export function clearSession(): void {
    try {
        localStorage.removeItem(SESSION_KEY)
        localStorage.removeItem(PROGRESS_KEY)
        localStorage.removeItem(LEGACY_SESSION_KEY)
        localStorage.removeItem(LEGACY_PROGRESS_KEY)
    } catch {
        // ignore
    }
}
