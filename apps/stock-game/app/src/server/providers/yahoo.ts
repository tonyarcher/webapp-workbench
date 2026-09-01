import { z } from 'zod'
import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import { ProviderError, type PriceProvider } from './types'

const YAHOO_BASE = 'https://query1.finance.yahoo.com'

const yahooChartResultSchema = z.object({
  chart: z.object({ result: z.array(z.unknown()).optional(), error: z.unknown().optional() }).optional(),
})

const chartBlockSchema = z.object({
  meta: z
    .object({
      currency: z.string().optional(),
      symbol: z.string().optional(),
      exchangeName: z.string().optional(),
      fullExchangeName: z.string().optional(),
      regularMarketPrice: z.number().nullable().optional(),
      regularMarketTime: z.number().nullable().optional(),
      shortName: z.string().optional(),
      longName: z.string().optional(),
    })
    .optional(),
  timestamp: z.array(z.number().nullable()).optional(),
  indicators: z
    .object({
      quote: z
        .array(
          z.object({
            open: z.array(z.number().nullable()).optional(),
            high: z.array(z.number().nullable()).optional(),
            low: z.array(z.number().nullable()).optional(),
            close: z.array(z.number().nullable()).optional(),
            volume: z.array(z.number().nullable()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

interface ChartBlock {
  meta?:
    | {
        currency?: string | undefined
        symbol?: string | undefined
        exchangeName?: string | undefined
        fullExchangeName?: string | undefined
        regularMarketPrice?: number | null | undefined
        regularMarketTime?: number | null | undefined
        shortName?: string | undefined
        longName?: string | undefined
      }
    | undefined
  timestamp?: Array<number | null> | undefined
  indicators?:
    | {
        quote?:
          | Array<{
              open?: Array<number | null> | undefined
              high?: Array<number | null> | undefined
              low?: Array<number | null> | undefined
              close?: Array<number | null> | undefined
              volume?: Array<number | null> | undefined
            }>
          | undefined
      }
    | undefined
}

function resolvePrice(meta: ChartBlock['meta'], bars: Bar[]): number | undefined {
  return meta?.regularMarketPrice ?? bars.at(-1)?.close
}

function resolveTime(meta: ChartBlock['meta'], bars: Bar[]): number {
  if (meta?.regularMarketTime != null) return meta.regularMarketTime * 1000
  return bars.at(-1)?.time ?? Date.now()
}

function requireSymbol(meta: ChartBlock['meta'], fallback: string): string {
  if (!meta?.symbol) throw new ProviderError(`No quote data for ${fallback}`)
  return meta.symbol
}

function requirePrice(meta: ChartBlock['meta'], bars: Bar[], symbol: string): number {
  const price = resolvePrice(meta, bars)
  if (price === undefined || !Number.isFinite(price)) throw new ProviderError(`No quote data for ${symbol}`)
  return round2(price)
}

function quoteName(meta: ChartBlock['meta'], fallback: string): string {
  if (meta?.shortName) return meta.shortName
  if (meta?.longName) return meta.longName
  return fallback
}

function quoteCurrency(meta: ChartBlock['meta']): string {
  return meta?.currency ?? 'USD'
}

function quoteExchange(meta: ChartBlock['meta']): string {
  if (meta?.fullExchangeName) return meta.fullExchangeName
  if (meta?.exchangeName) return meta.exchangeName
  return ''
}

function buildQuote(symbol: string, meta: ChartBlock['meta'], bars: Bar[]): Quote {
  return {
    symbol: requireSymbol(meta, symbol),
    name: quoteName(meta, symbol),
    price: requirePrice(meta, bars, symbol),
    currency: quoteCurrency(meta),
    exchange: quoteExchange(meta),
    time: resolveTime(meta, bars),
    delayMinutes: 15,
  }
}

export class YahooProvider implements PriceProvider {
  readonly id = 'yahoo'

  async getQuote(symbol: string): Promise<Quote> {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
    const json = await this.fetchJson(url)
    const block = parseChartBlock(json)
    const bars = parseBars(block)
    return buildQuote(symbol, block.meta, bars)
  }

  async getBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]> {
    const period1 = Math.floor(from / 1000)
    const period2 = Math.floor(to / 1000)
    const url =
      `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=${interval}&period1=${period1}&period2=${period2}&events=div,splits`
    const json = await this.fetchJson(url)
    return parseBars(parseChartBlock(json))
  }

  async search(query: string): Promise<SymbolSearchResult[]> {
    const url = `${YAHOO_BASE}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
    const json = await this.fetchJson(url)
    const parsed = z
      .object({
        quotes: z.array(
          z.object({
            symbol: z.string(),
            shortname: z.string().optional(),
            longname: z.string().optional(),
            exchange: z.string().optional(),
            quoteType: z.string().optional(),
          }),
        ),
      })
      .safeParse(json)
    if (!parsed.success) throw new ProviderError('Yahoo search returned an unexpected shape')
    return parsed.data.quotes
      .filter((quote) => quote.symbol.length > 0)
      .map((quote) => ({
        symbol: quote.symbol,
        name: quote.shortname ?? quote.longname ?? quote.symbol,
        exchange: quote.exchange ?? '',
        type: quote.quoteType ?? 'EQUITY',
      }))
  }

  private async fetchJson(url: string): Promise<unknown> {
    let res: Response
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (stock-game; like Gecko) stock-game' } })
    } catch {
      throw new ProviderError('Network error reaching Yahoo Finance')
    }
    if (res.status === 429) throw new ProviderError('Yahoo Finance rate limit hit (429). Try again in a minute.')
    if (!res.ok) throw new ProviderError(`Yahoo Finance request failed with status ${res.status}`)
    return (await res.json()) as unknown
  }
}

export function parseChartBlock(json: unknown): ChartBlock {
  const parsed = yahooChartResultSchema.safeParse(json)
  if (!parsed.success) throw new ProviderError('Yahoo Finance returned an unexpected payload')
  const result = parsed.data.chart?.result
  if (!result || result.length === 0) throw new ProviderError('Yahoo Finance returned no data')
  const first = result[0]
  const block = chartBlockSchema.safeParse(first)
  if (!block.success) throw new ProviderError('Yahoo Finance returned an unexpected payload')
  return block.data
}

function isValidNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

function coalesce(value: number | null | undefined, fallback: number): number {
  return value ?? fallback
}

function areAllValid(values: unknown[]): boolean {
  for (const value of values) if (!isValidNumber(value)) return false
  return true
}

function createBar(
  time: number | null | undefined,
  openValue: number | null | undefined,
  highValue: number | null | undefined,
  lowValue: number | null | undefined,
  closeValue: number | null | undefined,
  volumeValue: number | null | undefined,
): Bar | null {
  if (time == null || closeValue == null) return null
  const open = coalesce(openValue, closeValue)
  const high = coalesce(highValue, closeValue)
  const low = coalesce(lowValue, closeValue)
  const volume = coalesce(volumeValue, 0)
  if (!areAllValid([time, closeValue, open, high, low])) return null
  return { time: time * 1000, open, high, low, close: closeValue, volume }
}

function collectBars(timestamps: Array<number | null>, open: Array<number | null>, high: Array<number | null>, low: Array<number | null>, close: Array<number | null>, volume: Array<number | null>): Bar[] {
  const bars: Bar[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const bar = createBar(timestamps[i] ?? null, open[i], high[i], low[i], close[i] ?? null, volume[i])
    if (bar) bars.push(bar)
  }
  return bars
}

export function parseBars(block: ChartBlock): Bar[] {
  const timestamps = block.timestamp
  const quote = block.indicators?.quote?.[0]
  if (!timestamps || !quote) return []
  return collectBars(timestamps, quote.open ?? [], quote.high ?? [], quote.low ?? [], quote.close ?? [], quote.volume ?? [])
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
