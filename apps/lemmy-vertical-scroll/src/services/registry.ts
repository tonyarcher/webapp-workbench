import type {PopularServer} from '../types'

// ---- bundled popular servers ----
// Offline fallback, and the only PieFed source (no keyless PieFed registry exists).
// Entries: [host, name, nsfw]

const BUNDLED_HOSTS: ReadonlyArray<readonly [string, string, boolean]> = [
    ['lemmy.world', 'Lemmy.World', false],
    ['lemmy.ml', 'Lemmy.ml', false],
    ['lemm.ee', 'Lemm.ee', false],
    ['sh.itjust.works', 'sh.itjust.works', false],
    ['feddit.org', 'Feddit.org', false],
    ['feddit.de', 'Feddit', false],
    ['lemmings.world', 'Lemmings.World', false],
    ['programming.dev', 'Programming.dev', false],
    ['lemmy.ca', 'Lemmy.ca', false],
    ['sopuli.xyz', 'Sopuli', false],
    ['discuss.online', 'Discuss Online', false],
    ['lemmy.today', 'Lemmy Today', false],
    ['lemmy.zip', 'Lemmy.zip', false],
    ['hexbear.net', 'Hexbear', false],
    ['lemmy.blahaj.zone', 'Blåhaj Lemmy', false],
    ['lemmynsfw.com', 'Lemmy NSFW', true],
    ['piefed.social', 'PieFed', false],
    ['piefed.ca', 'PieFed.ca', false],
    ['piefed.world', 'PieFed.world', false],
    ['piefed.zip', 'PieFed.zip', false],
    ['piefed.blahaj.zone', 'Blåhaj PieFed', false],
    ['quokk.au', 'Quokk.au', false],
]

export const POPULAR_SERVERS: PopularServer[] = BUNDLED_HOSTS.map(([host, name, nsfw]) => ({host, name, nsfw}))

// ---- live registry ----
// maltfield/awesome-lemmy-instances publishes a frequently-updated CSV of Lemmy
// instances ranked by monthly users; served from raw.githubusercontent.com with
// CORS enabled and no API key. Lemmy-only; PieFed coverage stays bundled.

const REGISTRY_URL =
    'https://raw.githubusercontent.com/maltfield/awesome-lemmy-instances/main/awesome-lemmy-instances.csv'
const REGISTRY_LIMIT = 25
const REGISTRY_TIMEOUT_MS = 15_000
/** Upper bound for the CSV body (~500KB in practice); guards against a runaway response. */
const REGISTRY_MAX_BYTES = 2_000_000
export const REGISTRY_TTL_MS = 24 * 60 * 60_000

/** Hosts known to be dedicated NSFW instances; the registry CSV has no such flag. */
const NSFW_HOSTS = new Set(['lemmynsfw.com', 'fedinsfw.app'])

/**
 * Parses the registry CSV (columns: Instance,NU,NC,Fed,Adult,↓V,Users,...).
 * The Instance cell is markdown like `[Name](https://host)`. Malformed lines
 * are skipped so a future format change degrades gracefully.
 */
function parseRegistryRow(line: string): {host: string; name: string; users: number} | null {
    if (!line.trim()) return null
    const cells = line.split(',')
    const match = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/.exec(cells[0] ?? '')
    const host = match?.[2]?.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const name = match?.[1]?.trim()
    const users = Number(cells[6])
    if (!host || !name || !Number.isFinite(users)) return null
    return {host, name, users}
}

export function parseRegistryCsv(text: string): PopularServer[] {
    const rows: Array<{host: string; name: string; users: number}> = []
    for (const line of text.split(/\r?\n/)) {
        const row = parseRegistryRow(line)
        if (row) rows.push(row)
    }
    rows.sort((a, b) => b.users - a.users)
    return rows.slice(0, REGISTRY_LIMIT).map((row) => ({host: row.host, name: row.name, nsfw: NSFW_HOSTS.has(row.host)}))
}

/** Fetches the current registry; resolves to [] on any failure so callers can fall back to bundled. */
export async function fetchRegistryPopular(fetchImpl: typeof fetch = fetch): Promise<PopularServer[]> {
    try {
        const response = await fetchImpl(REGISTRY_URL, {signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS)})
        if (!response.ok) return []
        const text = await response.text()
        if (text.length > REGISTRY_MAX_BYTES) return []
        return parseRegistryCsv(text)
    } catch {
        return []
    }
}

/** Bundled ∪ registry, deduped by host; registry entries keep their (current) rank first. */
export function mergePopular(bundled: PopularServer[], registry: PopularServer[]): PopularServer[] {
    const seen = new Set<string>()
    const merged: PopularServer[] = []
    for (const server of [...registry, ...bundled]) {
        if (seen.has(server.host)) continue
        seen.add(server.host)
        merged.push(server)
    }
    return merged
}
