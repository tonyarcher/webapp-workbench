import { z } from 'zod'
import type { Bar, Interval, Quote, SymbolSearchResult } from '@stock-game/shared'
import { ProviderError, type PriceProvider } from './types'

const TWELVEDATA_BASE = 'https://api.twelvedata.com'

const INTERVAL_MAP: Record<Interval, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '60m': '1h',
  '1d': '1day',
  '1wk': '1week',
  '1mo': '1month',
}

const errorSchema = z.object({
  status: z.literal('error').optional(),
  code: z.number().optional(),
  message: z.string().optional(),
})

const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  close: z.string(),
  currency: z.string().optional(),
  exchange: z.string().optional(),
  timestamp: z.string().optional(),
})

const barsSchema = z.object({
  status: z.literal('ok').optional(),
  values: z.array(
    z.object({
      datetime: z.string(),
      open: z.string(),
      high: z.string(),
      low: z.string(),
      close: z.string(),
      volume: z.string(),
    }),
  ),
})

const searchSchema = z.object({
  data: z.array(
    z.object({
      symbol: z.string(),
      name: z.string().optional(),
      exchange: z.string().optional(),
      instrument_type: z.string().optional(),
    }),
  ),
})

function mapBars(values: z.infer<typeof barsSchema>['values']): Bar[] {
  return values.map((value) => ({
    time: parseTwelveDataDate(value.datetime),
    open: parseNumber(value.open, 'open'),
    high: parseNumber(value.high, 'high'),
    low: parseNumber(value.low, 'low'),
    close: parseNumber(value.close, 'close'),
    volume: Math.round(parseNumber(value.volume, 'volume')),
  }))
}

function parseBarsResponse(json: unknown): Bar[] {
  const parsed = barsSchema.safeParse(json)
  if (!parsed.success) throw new ProviderError(extractErrorMessage(json, 'Twelve Data bars failed'))
  return mapBars(parsed.data.values)
}

function buildBarsUrl(symbol: string, interval: Interval, from: number, to: number, apiKey: string): string {
  const startDate = toDateString(from)
  const endDate = toDateString(to)
  return (
    `${TWELVEDATA_BASE}/time_series` +
    `?symbol=${encodeURIComponent(symbol)}&interval=${INTERVAL_MAP[interval]}` +
    `&start_date=${startDate}&end_date=${endDate}&outputsize=5000&apikey=${apiKey}`
  )
}

export class TwelveDataProvider implements PriceProvider {
  readonly id = 'twelvedata'

  constructor(private readonly apiKey: string) {}

  async getQuote(symbol: string): Promise<Quote> {
    const url = `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`
    const json = await this.fetchJson(url)
    const parsed = quoteSchema.safeParse(json)
    if (!parsed.success) throw new ProviderError(extractErrorMessage(json, 'Twelve Data quote failed'))
    return {
      symbol: parsed.data.symbol,
      name: parsed.data.name ?? parsed.data.symbol,
      price: parseNumber(parsed.data.close, 'price'),
      currency: parsed.data.currency ?? 'USD',
      exchange: parsed.data.exchange ?? '',
      time: parseTwelveDataDate(parsed.data.timestamp ?? ''),
      delayMinutes: 0,
    }
  }

  async getBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]> {
    const url = buildBarsUrl(symbol, interval, from, to, this.apiKey)
    const json = await this.fetchJson(url)
    return parseBarsResponse(json)
  }

  async search(query: string): Promise<SymbolSearchResult[]> {
    const url = `${TWELVEDATA_BASE}/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${this.apiKey}`
    const json = await this.fetchJson(url)
    const parsed = searchSchema.safeParse(json)
    if (!parsed.success) throw new ProviderError(extractErrorMessage(json, 'Twelve Data search failed'))
    return parsed.data.data.map((item) => ({
      symbol: item.symbol,
      name: item.name ?? item.symbol,
      exchange: item.exchange ?? '',
      type: item.instrument_type ?? 'EQUITY',
    }))
  }

  private async fetchJson(url: string): Promise<unknown> {
    let res: Response
    try {
      res = await fetch(url)
    } catch {
      throw new ProviderError('Network error reaching Twelve Data')
    }
    if (!res.ok) throw new ProviderError(`Twelve Data request failed with status ${res.status}`)
    return (await res.json()) as unknown
  }
}

function parseTwelveDataDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})?/.exec(value)
  if (!match) {
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (!day) return Date.parse(value)
    return Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] ?? '0'))
}

function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

function parseNumber(value: string, label: string): number {
  const num = Number(value)
  if (!Number.isFinite(num)) throw new ProviderError(`Twelve Data returned a non-numeric ${label}: ${value}`)
  return num
}

function extractErrorMessage(json: unknown, fallback: string): string {
  const parsed = errorSchema.safeParse(json)
  if (parsed.success && parsed.data.message) {
    const code = parsed.data.code ? ` (${parsed.data.code})` : ''
    return `Twelve Data error${code}: ${parsed.data.message}`
  }
  return fallback
}
