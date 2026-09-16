import {
  parseArray,
  parseBar,
  parseGameConfig,
  parseHoldingsEntry,
  parseOrder,
  parsePlaceOrderRequest,
  parsePlaceTradeRequest,
  parsePortfolioSeries,
  parseQuote,
  parseSymbolSearchResult,
  parseTrade,
  parseUpdateConfigRequest,
} from '@stock-game/shared'
import type { Bar, GameConfig, HoldingsEntry, Interval, Order, PortfolioSeries, Quote, SymbolSearchResult, Trade, UpdateConfigRequest } from '@stock-game/shared'
import { getAccessToken, refreshTokens } from './auth'

export class AuthError extends Error {
  constructor() {
    super('Sign in required')
    this.name = 'AuthError'
  }
}

function emitAuthRequired(): void {
  window.dispatchEvent(new CustomEvent('sg-auth-required'))
}

function apiBase(): string {
  const base = import.meta.env.BASE_URL
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}api`
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`
}

function withAuth(init: RequestInit | undefined, token: string): RequestInit {
  const headers: Record<string, string> = {}
  const incoming = init?.headers as Record<string, string> | undefined
  if (incoming) Object.assign(headers, incoming)
  headers['Authorization'] = `Bearer ${token}`
  if (init?.body && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json'
  }
  return { ...init, headers }
}

async function throwApiError(res: Response): Promise<never> {
  if (res.status === 401) {
    emitAuthRequired()
    throw new AuthError()
  }
  throw new Error(await readError(res))
}

async function apiFetch(path: string, init?: RequestInit, retried = false): Promise<unknown> {
  const token = await getAccessToken()
  if (!token) {
    emitAuthRequired()
    throw new AuthError()
  }
  const res = await fetch(apiUrl(path), withAuth(init, token))
  if (res.status === 401 && !retried) {
    const next = await refreshTokens()
    if (next) return apiFetch(path, init, true)
  }
  if (!res.ok) await throwApiError(res)
  return res.json() as Promise<unknown>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchConfig(): Promise<GameConfig> {
  return parseGameConfig(await apiFetch('/config'))
}

export async function saveConfig(input: UpdateConfigRequest): Promise<GameConfig> {
  const body = parseUpdateConfigRequest(input)
  return parseGameConfig(
    await apiFetch('/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  )
}

export async function listTrades(): Promise<Trade[]> {
  return parseArray(await apiFetch('/trades'), parseTrade)
}

export async function placeTrade(input: unknown): Promise<Trade> {
  const body = parsePlaceTradeRequest(input)
  return parseTrade(
    await apiFetch('/trades', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function listOrders(): Promise<Order[]> {
  return parseArray(await apiFetch('/orders'), parseOrder)
}

export async function placeOrder(input: unknown): Promise<Order> {
  const body = parsePlaceOrderRequest(input)
  return parseOrder(
    await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function cancelOrder(id: number): Promise<{ ok: boolean }> {
  const raw = (await apiFetch(`/orders/${id}/cancel`, { method: 'POST' })) as Record<string, unknown>
  if (typeof raw['ok'] !== 'boolean') throw new Error('invalid cancel response')
  return { ok: raw['ok'] }
}

export async function fetchHoldings(): Promise<HoldingsEntry[]> {
  return parseArray(await apiFetch('/holdings'), parseHoldingsEntry)
}

export async function fetchCash(): Promise<number> {
  const raw = (await apiFetch('/cash')) as Record<string, unknown>
  const cashCents = raw['cashCents']
  if (typeof cashCents !== 'number' || !Number.isInteger(cashCents)) throw new Error('invalid cash')
  return cashCents
}

export async function fetchPortfolioSeries(): Promise<PortfolioSeries> {
  return parsePortfolioSeries(await apiFetch('/portfolio'))
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  return parseQuote(await apiFetch(`/quote?symbol=${encodeURIComponent(symbol)}`))
}

export async function fetchBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]> {
  const q = new URLSearchParams({ symbol, interval, from: String(from), to: String(to) })
  return parseArray(await apiFetch(`/bars?${q.toString()}`), parseBar)
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  return parseArray(await apiFetch(`/search?q=${encodeURIComponent(query)}`), parseSymbolSearchResult)
}
