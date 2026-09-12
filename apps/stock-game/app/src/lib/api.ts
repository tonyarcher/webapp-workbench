import {
    barSchema,
    gameConfigSchema,
    holdingsEntrySchema,
    orderSchema,
    portfolioSeriesSchema,
    placeOrderRequestSchema,
    placeTradeRequestSchema,
    quoteSchema,
    symbolSearchResultSchema,
    tradeSchema,
    updateConfigRequestSchema,
} from '@stock-game/shared'
import type {
    Bar,
    GameConfig,
    HoldingsEntry,
    Interval,
    Order,
    PortfolioSeries,
    Quote,
    SymbolSearchResult,
    Trade,
    UpdateConfigRequest,
} from '@stock-game/shared'
import {z} from 'zod'
import {getAccessToken, refreshTokens} from './auth'

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
    return {...init, headers}
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
        const body = (await res.json()) as {error?: string}
        return body.error ?? res.statusText
    } catch {
        return res.statusText
    }
}

export async function fetchConfig(): Promise<GameConfig> {
    return gameConfigSchema.parse(await apiFetch('/config'))
}

export async function saveConfig(input: UpdateConfigRequest): Promise<GameConfig> {
    const body = updateConfigRequestSchema.parse(input)
    return gameConfigSchema.parse(await apiFetch('/config', {
        method: 'PUT',
        body: JSON.stringify(body),
    }))
}

export async function listTrades(): Promise<Trade[]> {
    return z.array(tradeSchema).parse(await apiFetch('/trades'))
}

export async function placeTrade(input: unknown): Promise<Trade> {
    const body = placeTradeRequestSchema.parse(input)
    return tradeSchema.parse(await apiFetch('/trades', {
        method: 'POST',
        body: JSON.stringify(body),
    }))
}

export async function listOrders(): Promise<Order[]> {
    return z.array(orderSchema).parse(await apiFetch('/orders'))
}

export async function placeOrder(input: unknown): Promise<Order> {
    const body = placeOrderRequestSchema.parse(input)
    return orderSchema.parse(await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(body),
    }))
}

export async function cancelOrder(id: number): Promise<{ok: boolean}> {
    return z.object({ok: z.boolean()}).parse(await apiFetch(`/orders/${id}/cancel`, {method: 'POST'}))
}

export async function fetchHoldings(): Promise<HoldingsEntry[]> {
    return z.array(holdingsEntrySchema).parse(await apiFetch('/holdings'))
}

export async function fetchCash(): Promise<number> {
    const body = z.object({cashCents: z.number().int()}).parse(await apiFetch('/cash'))
    return body.cashCents
}

export async function fetchPortfolioSeries(): Promise<PortfolioSeries> {
    return portfolioSeriesSchema.parse(await apiFetch('/portfolio'))
}

export async function fetchQuote(symbol: string): Promise<Quote> {
    return quoteSchema.parse(await apiFetch(`/quote?symbol=${encodeURIComponent(symbol)}`))
}

export async function fetchBars(symbol: string, interval: Interval, from: number, to: number): Promise<Bar[]> {
    const q = new URLSearchParams({symbol, interval, from: String(from), to: String(to)})
    return z.array(barSchema).parse(await apiFetch(`/bars?${q.toString()}`))
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    return z.array(symbolSearchResultSchema).parse(await apiFetch(`/search?q=${encodeURIComponent(query)}`))
}
