import { z } from 'zod'
import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import { ProviderError, type PriceProvider } from './types'

const ALPHAVANTAGE_BASE = 'https://www.alphavantage.co/query'

const quoteSchema = z.object({
  'Global Quote': z
    .object({
      '01. symbol': z.string(),
      '05. price': z.string(),
      '08. currency': z.string().optional(),
      '09. change': z.string().optional(),
      '07. latest trading day': z.string().optional(),
    })
    .optional(),
})

const barsSchema = z.object({
  'Time Series (Daily)': z
    .record(
      z.string(),
      z.object({
        '1. open': z.string(),
        '2. high': z.string(),
        '3. low': z.string(),
        '4. close': z.string(),
        '5. volume': z.string(),
      }),
    )
    .optional(),
})

const searchSchema = z.object({
  bestMatches: z.array(
    z.object({
      '1. symbol': z.string(),
      '2. name': z.string().optional(),
      '4. region': z.string().optional(),
      '3. type': z.string().optional(),
    }),
  ),
})

function parseQuotePayload(json: unknown) {
  const parsed = quoteSchema.safeParse(json)
  return parsed.success ? parsed.data['Global Quote'] : undefined
}

function buildQuote(_symbol: string, quote: NonNullable<ReturnType<typeof parseQuotePayload>>): Quote {
  return {
    symbol: quote['01. symbol'],
    name: quote['01. symbol'],
    price: parseNumber(quote['05. price'], 'price'),
    currency: quote['08. currency'] ?? 'USD',
    exchange: '',
    time: quote['07. latest trading day'] ? parseDay(quote['07. latest trading day']) : Date.now(),
    delayMinutes: 15,
  }
}

function filterBars(series: Record<string, { '1. open': string; '2. high': string; '3. low': string; '4. close': string; '5. volume': string }>, from: number, to: number): Bar[] {
  return Object.entries(series)
    .filter(([day]) => {
      const time = parseDay(day)
      return time >= from && time <= to
    })
    .map(([day, value]) => ({
      time: parseDay(day),
      open: parseNumber(value['1. open'], 'open'),
      high: parseNumber(value['2. high'], 'high'),
      low: parseNumber(value['3. low'], 'low'),
      close: parseNumber(value['4. close'], 'close'),
      volume: Math.round(parseNumber(value['5. volume'], 'volume')),
    }))
    .sort((a, b) => a.time - b.time)
}

function parseBarsPayload(json: unknown, from: number, to: number): Bar[] | undefined {
  const parsed = barsSchema.safeParse(json)
  const series = parsed.success ? parsed.data['Time Series (Daily)'] : undefined
  if (!series) return undefined
  return filterBars(series, from, to)
}

export class AlphaVantageProvider implements PriceProvider {
  readonly id = 'alphaVantage'

  constructor(private readonly apiKey: string) {}

  async getQuote(symbol: string): Promise<Quote> {
    const url = `${ALPHAVANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`
    const json = await this.fetchJson(url)
    const quote = parseQuotePayload(json)
    if (!quote) throw new ProviderError(extractErrorMessage(json, 'Alpha Vantage quote failed'))
    return buildQuote(symbol, quote)
  }

  async getBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]> {
    if (interval !== '1d') throw new ProviderError('Alpha Vantage free tier only provides daily bars; use interval "1d"')
    const url = `${ALPHAVANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${this.apiKey}`
    const json = await this.fetchJson(url)
    const bars = parseBarsPayload(json, from, to)
    if (!bars) throw new ProviderError(extractErrorMessage(json, 'Alpha Vantage bars failed'))
    return bars
  }

  async search(query: string): Promise<SymbolSearchResult[]> {
    const url = `${ALPHAVANTAGE_BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.apiKey}`
    const json = await this.fetchJson(url)
    const parsed = searchSchema.safeParse(json)
    if (!parsed.success) throw new ProviderError(extractErrorMessage(json, 'Alpha Vantage search failed'))
    return parsed.data.bestMatches.map((match) => ({
      symbol: match['1. symbol'],
      name: match['2. name'] ?? match['1. symbol'],
      exchange: match['4. region'] ?? '',
      type: match['3. type'] ?? 'EQUITY',
    }))
  }

  private async fetchJson(url: string): Promise<unknown> {
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new ProviderError('Network error reaching Alpha Vantage')
    }
    if (!res.ok) throw new ProviderError(`Alpha Vantage request failed with status ${res.status}`)
    return (await res.json()) as unknown
  }
}

function parseDay(value: string): number {
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!day) return Date.parse(value)
  return Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
}

function parseNumber(value: string, label: string): number {
  const num = Number(value)
  if (!Number.isFinite(num)) throw new ProviderError(`Alpha Vantage returned a non-numeric ${label}: ${value}`)
  return num
}

function extractErrorMessage(json: unknown, fallback: string): string {
  const parsed = z.object({ Note: z.string().optional(), Information: z.string().optional() }).safeParse(json)
  const message = parsed.success ? (parsed.data.Note ?? parsed.data.Information) : undefined
  return message ? `Alpha Vantage: ${message}` : fallback
}
