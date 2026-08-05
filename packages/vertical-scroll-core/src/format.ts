// ---- time formatting ----

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
const WEEK = 604_800_000
const YEAR = 31_536_000_000

/** Relative time like `3h` / `2d` / `5mo`, compact for list rows. */
export function timeAgo(publishedIso: string, now: number = Date.now()): string {
    const elapsed = now - Date.parse(publishedIso)
    if (Number.isNaN(elapsed) || elapsed < 0) return ''
    if (elapsed < MINUTE) return 'just now'
    if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
    if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
    if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`
    if (elapsed < YEAR) return `${Math.floor(elapsed / WEEK)}w`
    return `${Math.floor(elapsed / YEAR)}y`
}

// ---- number formatting ----

/** 1_234 -> `1.2K`, 3_400_000 -> `3.4M` */
export function compactNumber(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `${trim(n / 1_000_000)}M`
    if (Math.abs(n) >= 1_000) return `${trim(n / 1_000)}K`
    return String(n)
}

function trim(x: number): string {
    return (Math.round(x * 10) / 10).toString()
}
