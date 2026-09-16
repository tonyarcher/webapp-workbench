// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/auth', () => ({
  getAccessToken: vi.fn(async () => 'test-token' as string | null),
  refreshTokens: vi.fn(async () => null as string | null),
}))

import './sg-orders-view'
import type { SgOrdersView } from './sg-orders-view'
import { getQueryClient } from '../lib/queryClient'

const ORDER = {
  id: 1,
  symbol: 'AAPL',
  side: 'buy',
  qty: 10,
  executeAt: Date.now() + 60_000,
  status: 'pending',
  createdAt: Date.now(),
  tradeId: null,
  orderType: 'market',
  tif: 'GTC',
  limitPrice: null,
  stopPrice: null,
  expiresAt: null,
  fillPriceSource: 'ask',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function settled(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function rowSymbols(el: SgOrdersView): Array<string | null | undefined> {
  const table = el.shadowRoot?.querySelector('sg-orders-table')
  return [...(table?.shadowRoot?.querySelectorAll('tbody tr') ?? [])].map(
    (row) => row.querySelector('td:nth-child(2)')?.textContent?.trim(),
  )
}

function cancelButton(el: SgOrdersView): HTMLButtonElement | null {
  return (
    el.shadowRoot?.querySelector('sg-orders-table')?.shadowRoot?.querySelector('button') ?? null
  )
}

describe('sg-orders-view', () => {
  beforeEach(() => {
    getQueryClient().clear()
    vi.unstubAllGlobals()
  })

  it('loads orders and refreshes the table after cancel', async () => {
    let cancelled = false
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        if (init?.method === 'POST') {
          cancelled = true
          return jsonResponse({ ok: true })
        }
        return jsonResponse([cancelled ? { ...ORDER, status: 'filled', tradeId: 7 } : ORDER])
      }),
    )
    const el = document.createElement('sg-orders-view') as SgOrdersView
    document.body.appendChild(el)
    await settled()
    expect(rowSymbols(el)).toEqual(['AAPL'])
    expect(cancelButton(el)).not.toBeNull()

    cancelButton(el)?.click()
    await settled()
    expect(calls.some((c) => c.startsWith('POST') && c.includes('/orders/1/cancel'))).toBe(true)
    expect(rowSymbols(el)).toEqual(['AAPL'])
    expect(cancelButton(el)).toBeNull()
    el.remove()
  })

  it('shows cancel errors and keeps the order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') return jsonResponse({ error: 'boom' }, 500)
        return jsonResponse([ORDER])
      }),
    )
    const el = document.createElement('sg-orders-view') as SgOrdersView
    document.body.appendChild(el)
    await settled()
    cancelButton(el)?.click()
    await settled()
    expect(el.shadowRoot?.textContent).toContain('boom')
    expect(rowSymbols(el)).toEqual(['AAPL'])
    expect(cancelButton(el)).not.toBeNull()
    el.remove()
  })

  it('tick refreshes the list even with a fresh cache', async () => {
    const gets: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        gets.push(url)
        return jsonResponse([ORDER])
      }),
    )
    vi.useFakeTimers()
    let el: SgOrdersView | null = null
    try {
      el = document.createElement('sg-orders-view') as SgOrdersView
      document.body.appendChild(el)
      await vi.advanceTimersByTimeAsync(1000)
      expect(gets.length).toBe(1)
      await vi.advanceTimersByTimeAsync(30_100)
      expect(gets.length).toBe(2)
    } finally {
      el?.remove()
      vi.useRealTimers()
    }
  })

  it('clears its poll timer on disconnect', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([ORDER])))
    const setSpy = vi.spyOn(window, 'setInterval')
    const clearSpy = vi.spyOn(window, 'clearInterval')
    try {
      const el = document.createElement('sg-orders-view') as SgOrdersView
      document.body.appendChild(el)
      await settled()
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 30_000)
      el.remove()
      expect(clearSpy).toHaveBeenCalledWith(setSpy.mock.results[0]?.value)
    } finally {
      setSpy.mockRestore()
      clearSpy.mockRestore()
    }
  })
})
