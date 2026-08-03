import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'

export class ProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

export interface PriceProvider {
  readonly id: string
  getQuote(symbol: string): Promise<Quote>
  getBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]>
  search(query: string): Promise<SymbolSearchResult[]>
}
