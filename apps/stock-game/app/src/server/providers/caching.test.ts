import { describe, expect, it } from 'vitest'
import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import type { PriceProvider } from './types'
import { withCache } from './caching'
import { openRepo } from '../db'
import { dayBar } from '../testing/fakeProvider'

interface CountingProvider extends PriceProvider {
  getCalls(): number
}

function makeCountingProvider(bars: Bar[]): CountingProvider {
  let calls = 0
  return {
    id: 'counting',
    async getQuote(symbol: string): Promise<Quote> {
      return { symbol, name: symbol, price: 1, currency: 'USD', exchange: '', time: 0, delayMinutes: 0 }
    },
    async getBars(
      _symbol: string,
      _interval: Interval,
      from: number,
      to: number,
    ): Promise<Bar[]> {
      calls++
      return bars.filter((bar) => bar.time >= from && bar.time <= to)
    },
    async search(_query: string): Promise<SymbolSearchResult[]> {
      return []
    },
    getCalls(): number {
      return calls
    },
  }
}

describe('withCache', () => {
  it('serves bars from the cache after the first fetch', async () => {
    const repo = openRepo(':memory:')
    const bars = [dayBar('2024-01-02', 100), dayBar('2024-01-03', 105)]
    const provider = makeCountingProvider(bars)
    const cached = withCache(provider, repo, 60_000)

    const from = bars[0]!.time - 12 * 60 * 60 * 1000
    const to = bars[1]!.time + 12 * 60 * 60 * 1000
    const first = await cached.getBars('AAPL', '1d', from, to)
    expect(first).toHaveLength(2)
    expect(provider.getCalls()).toBe(1)

    const second = await cached.getBars('AAPL', '1d', from, to)
    expect(second).toHaveLength(2)
    expect(provider.getCalls()).toBe(1)
  })

  it('does not refetch a range the provider reported as empty', async () => {
    const repo = openRepo(':memory:')
    const provider = makeCountingProvider([])
    const cached = withCache(provider, repo, 60_000)

    const from = Date.parse('2024-01-06T00:00:00Z')
    const to = Date.parse('2024-01-07T00:00:00Z')
    const first = await cached.getBars('AAPL', '1d', from, to)
    expect(first).toHaveLength(0)
    expect(provider.getCalls()).toBe(1)

    const second = await cached.getBars('AAPL', '1d', from, to)
    expect(second).toHaveLength(0)
    expect(provider.getCalls()).toBe(1)
  })

  it('persists partial coverage and only fetches missing gaps', async () => {
    const repo = openRepo(':memory:')
    const bars = [dayBar('2024-01-02', 100), dayBar('2024-01-03', 105)]
    const provider = makeCountingProvider(bars)
    const cached = withCache(provider, repo, 60_000)

    const from = bars[0]!.time - 2 * 24 * 60 * 60 * 1000
    const to = bars[1]!.time + 2 * 24 * 60 * 60 * 1000
    await cached.getBars('AAPL', '1d', from, to)
    expect(provider.getCalls()).toBe(1)

    await cached.getBars('AAPL', '1d', from, to)
    expect(provider.getCalls()).toBe(3)

    await cached.getBars('AAPL', '1d', from, to)
    expect(provider.getCalls()).toBe(3)
  })
})
