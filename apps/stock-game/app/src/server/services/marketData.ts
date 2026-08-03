import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import type { PriceProvider } from '../providers/types'
import type { Repo } from '../db'
import { openRepo } from '../db'
import { createProvider } from '../providers/factory'

let repo: Repo | undefined
let provider: PriceProvider | undefined

export function getRepo(): Repo {
  if (repo === undefined) repo = openRepo()
  return repo
}

export function getProvider(): PriceProvider {
  if (provider === undefined) provider = createProvider(getRepo())
  return provider
}

export async function getQuote(symbol: string): Promise<Quote> {
  return getProvider().getQuote(symbol)
}

export async function getBars(
  symbol: string,
  interval: Interval,
  from: number,
  to: number,
): Promise<Bar[]> {
  return getProvider().getBars(symbol, interval, from, to)
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  return getProvider().search(query)
}

export async function ensureDailyBars(symbol: string, from: number, to: number): Promise<void> {
  await getProvider().getBars(symbol, '1d', from, to)
}
