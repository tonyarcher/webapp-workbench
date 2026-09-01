import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import type { PriceProvider } from '../providers/types'

function filterBars(bars: Bar[], from: number, to: number): Bar[] {
  return bars.filter((bar) => bar.time >= from && bar.time <= to)
}

export function fakeProvider(overrides?: { quote?: Quote; bars?: Bar[] }): PriceProvider {
  return {
    id: 'fake',
    async getQuote(symbol: string): Promise<Quote> {
      return overrides?.quote ?? { symbol, name: symbol, price: 50, currency: 'USD', exchange: 'TEST', time: 0, delayMinutes: 0 }
    },
    async getBars(_symbol: string, _interval: Interval, from: number, to: number): Promise<Bar[]> {
      return filterBars(overrides?.bars ?? [], from, to)
    },
    async search(_query: string): Promise<SymbolSearchResult[]> {
      return []
    },
  }
}

export function dayBar(date: string, close: number, overrides?: { open?: number; high?: number; low?: number }): Bar {
  const time = Date.parse(date) + 14 * 60 * 60 * 1000 + 30 * 60 * 1000
  const open = overrides?.open ?? close
  const high = overrides?.high ?? close
  const low = overrides?.low ?? close
  return { time, open, high, low, close, volume: 1000 }
}
