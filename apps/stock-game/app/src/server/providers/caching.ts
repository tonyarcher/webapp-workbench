import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import type { PriceProvider } from './types'
import type { Repo } from '../db'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const EMPTY_RANGE_TTL_MS = 10 * MINUTE_MS

const INTERVAL_MS: Record<Interval, number> = {
  '1m': MINUTE_MS,
  '5m': 5 * MINUTE_MS,
  '15m': 15 * MINUTE_MS,
  '30m': 30 * MINUTE_MS,
  '60m': HOUR_MS,
  '1d': DAY_MS,
  '1wk': 7 * DAY_MS,
  '1mo': 30 * DAY_MS,
}

export function withCache(
  provider: PriceProvider,
  repo: Repo,
  quoteTtlMs: number,
): PriceProvider {
  const quoteCache = new Map<string, { at: number; quote: Quote }>()
  const emptyRanges = new Map<string, number>()
  const inFlight = new Map<string, Promise<void>>()

  async function cachedQuote(symbol: string): Promise<Quote> {
    const hit = quoteCache.get(symbol)
    if (hit && Date.now() - hit.at < quoteTtlMs) return hit.quote
    const quote = await provider.getQuote(symbol)
    quoteCache.set(symbol, { at: Date.now(), quote })
    return quote
  }

  async function fetchRange(
    symbol: string,
    interval: Interval,
    start: number,
    end: number,
  ): Promise<void> {
    const fetched = await provider.getBars(symbol, interval, start, end)
    if (fetched.length === 0) {
      emptyRanges.set(emptyKey(symbol, interval, start, end), Date.now() + EMPTY_RANGE_TTL_MS)
      return
    }
    repo.upsertBars(symbol, interval, fetched)
  }

  async function cachedBars(
    symbol: string,
    interval: Interval,
    from: number,
    to: number,
  ): Promise<Bar[]> {
    const existing = repo.getBars(symbol, interval, from, to)
    const now = Date.now()
    const ranges = missingRanges(existing, interval, from, to).filter(([start, end]) => {
      const expiry = emptyRanges.get(emptyKey(symbol, interval, start, end))
      return expiry === undefined || expiry <= now
    })

    for (const [start, end] of ranges) {
      const key = rangeKey(symbol, interval, start, end)
      let pending = inFlight.get(key)
      if (pending === undefined) {
        pending = fetchRange(symbol, interval, start, end)
        inFlight.set(key, pending)
        void pending.finally(() => {
          inFlight.delete(key)
        })
      }
      await pending
    }
    return repo.getBars(symbol, interval, from, to)
  }

  return {
    id: provider.id,
    getQuote: cachedQuote,
    getBars: cachedBars,
    search: (query: string): Promise<SymbolSearchResult[]> => provider.search(query),
  }
}

function emptyKey(symbol: string, interval: Interval, from: number, to: number): string {
  return rangeKey(symbol, interval, from, to)
}

function rangeKey(symbol: string, interval: Interval, from: number, to: number): string {
  return `${symbol}:${interval}:${from}:${to}`
}

function missingRanges(
  existing: Bar[],
  interval: Interval,
  from: number,
  to: number,
): Array<[number, number]> {
  const width = INTERVAL_MS[interval]
  const times = existing.map((bar) => bar.time).sort((a, b) => a - b)
  if (times.length === 0) return [[from, to]]
  const ranges: Array<[number, number]> = []
  let cursor = from
  for (const time of times) {
    if (time - width > cursor) ranges.push([cursor, time - width])
    cursor = Math.max(cursor, time + width)
  }
  if (cursor <= to) ranges.push([cursor, to])
  return ranges
}
