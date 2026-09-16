// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/auth', () => ({
  getAccessToken: vi.fn(async () => 'test-token' as string | null),
  refreshTokens: vi.fn(async () => null as string | null),
}))

import './sg-portfolio-view'
import type { SgPortfolioView } from './sg-portfolio-view'
import { getQueryClient } from '../lib/queryClient'

const HOLDING = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  qty: 10,
  avgCostCents: 10000,
  costBasisCents: 100000,
  currentPrice: 234.56,
  marketValueCents: 234560,
  unrealizedPnlCents: 134560,
  unrealizedPnlPct: 134.56,
}

const TRADE = {
  id: 1,
  symbol: 'AAPL',
  side: 'buy',
  qty: 10,
  price: 100,
  cashDeltaCents: -100000,
  mode: 'backdated',
  executedAt: Date.parse('2024-01-02T14:30:00Z'),
  createdAt: Date.parse('2024-01-03T00:00:00Z'),
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function settled(): Promise<void> {
  for (let i = 0; i < 8; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function stubListings(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/holdings')) return jsonResponse([HOLDING])
      if (url.endsWith('/trades')) return jsonResponse([TRADE])
      throw new Error(`unexpected fetch ${url}`)
    }),
  )
}

function holdingSymbols(el: SgPortfolioView): Array<string | null | undefined> {
  const table = el.shadowRoot?.querySelector('sg-holdings-table')
  return [...(table?.shadowRoot?.querySelectorAll('tbody tr') ?? [])].map(
    (row) => row.querySelector('td:first-child')?.textContent?.trim(),
  )
}

describe('sg-portfolio-view', () => {
  beforeEach(() => {
    getQueryClient().clear()
    vi.unstubAllGlobals()
  })

  it('loads holdings and trade history', async () => {
    stubListings()
    const el = document.createElement('sg-portfolio-view') as SgPortfolioView
    document.body.appendChild(el)
    await settled()
    expect(holdingSymbols(el)).toEqual(['AAPL'])
    const trades = el.shadowRoot?.querySelector('sg-trades-table')
    expect(trades?.shadowRoot?.textContent).toContain('backdated')
    el.remove()
  })

  it('jumps to the trade page on row click', async () => {
    stubListings()
    const before = window.location.href
    try {
      const el = document.createElement('sg-portfolio-view') as SgPortfolioView
      document.body.appendChild(el)
      await settled()
      el.shadowRoot
        ?.querySelector('sg-holdings-table')
        ?.shadowRoot?.querySelector('tbody tr')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
      expect(window.location.hash).toBe('#/trade?symbol=AAPL')
      el.remove()
    } finally {
      window.history.replaceState(null, '', before)
    }
  })

  it('shows load errors', async () => {
    const priorDefaults = getQueryClient().getDefaultOptions()
    getQueryClient().setDefaultOptions({ queries: { retry: false } })
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url.endsWith('/holdings')) return jsonResponse({ error: 'boom' }, 500)
          return jsonResponse([TRADE])
        }),
      )
      const el = document.createElement('sg-portfolio-view') as SgPortfolioView
      document.body.appendChild(el)
      await settled()
      expect(el.shadowRoot?.textContent).toContain('boom')
      expect(holdingSymbols(el)).toEqual([])
      el.remove()
    } finally {
      getQueryClient().setDefaultOptions(priorDefaults)
    }
  })
})
