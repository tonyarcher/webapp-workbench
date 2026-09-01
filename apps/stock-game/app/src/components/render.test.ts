// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

const { setDataSpy, applyOptionsSpy } = vi.hoisted(() => ({ setDataSpy: vi.fn(), applyOptionsSpy: vi.fn() }))

vi.mock('lightweight-charts', () => ({
  ColorType: { Solid: 0 },
  LineSeries: {},
  createChart: () => ({
    addSeries: () => ({ setData: setDataSpy, applyOptions: applyOptionsSpy }),
    remove: () => {},
  }),
}))

import './sg-portfolio-chart'
import './sg-holdings-table'
import './sg-symbol-search'
import './sg-trades-table'
import './sg-orders-table'
import './sg-trade-form'
import './sg-settings-form'
import { SgPortfolioChart } from './sg-portfolio-chart'
import { SgHoldingsTable } from './sg-holdings-table'
import { SgSymbolSearch } from './sg-symbol-search'
import { SgTradesTable } from './sg-trades-table'
import { SgOrdersTable } from './sg-orders-table'
import { SgTradeForm } from './sg-trade-form'
import { SgSettingsForm } from './sg-settings-form'
import type {
  HoldingsEntry,
  Order,
  Quote,
  SymbolSearchResult,
  Trade,
} from '@stock-game/shared'

const QUOTE: Quote = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 234.56,
  currency: 'USD',
  exchange: 'NasdaqGS',
  time: Date.parse('2024-01-02T14:30:00Z'),
  delayMinutes: 15,
}

const RESULT: SymbolSearchResult = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'NMS',
  type: 'EQUITY',
}

const HOLDING: HoldingsEntry = {
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

const TRADE: Trade = {
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

const ORDER: Order = {
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

function mount<T extends HTMLElement>(tag: string, props: Partial<T> = {}): T {
  const el = document.createElement(tag) as T
  for (const [key, value] of Object.entries(props)) {
    ;(el as unknown as Record<string, unknown>)[key] = value
  }
  document.body.appendChild(el)
  return el
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('custom elements render and react to properties', () => {
  it('sg-symbol-search renders results, searching, error, and no-match states', async () => {
    const el = mount<SgSymbolSearch>('sg-symbol-search', {
      value: 'aapl',
      query: 'aapl',
      open: true,
      results: [RESULT],
    })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('AAPL')

    el.searching = true
    await tick()
    expect(el.shadowRoot?.textContent).toContain('Searching')

    el.searching = false
    el.error = 'rate limited'
    await tick()
    expect(el.shadowRoot?.textContent).toContain('rate limited')

    el.error = null
    el.results = []
    await tick()
    expect(el.shadowRoot?.textContent).toContain('No matches')
    el.remove()
  })

  it('sg-symbol-search suppresses stale results while the input diverges from the query', async () => {
    const el = mount<SgSymbolSearch>('sg-symbol-search', {
      value: 'aapl',
      query: 'aapl',
      open: true,
      results: [RESULT],
    })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('AAPL')

    el.value = 'aaplx'
    await tick()
    expect(el.shadowRoot?.textContent).toContain('Searching')
    expect(el.shadowRoot?.textContent).not.toContain('Apple Inc.')
    el.remove()
  })

  it('sg-symbol-search emits sg-symbol-select on result click', async () => {
    const el = mount<SgSymbolSearch>('sg-symbol-search', {
      value: 'aapl',
      query: 'aapl',
      open: true,
      results: [RESULT],
    })
    await tick()
    let detail: unknown
    el.addEventListener('sg-symbol-select', (event) => {
      detail = (event as CustomEvent).detail
    })
    const item = el.shadowRoot?.querySelector('li')
    expect(item).not.toBeNull()
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(detail).toEqual(RESULT)
    el.remove()
  })

  it('sg-trade-form renders fields and reacts to quote changes', async () => {
    const el = mount<SgTradeForm>('sg-trade-form', { cashCents: 100_000, quote: QUOTE })
    await tick()
    const root = el.shadowRoot
    expect(root).not.toBeNull()
    expect(root?.textContent).toContain('Apple Inc.')
    expect(root?.textContent).toContain('Cash available')
    expect(root?.textContent).toContain('$234.56')

    el.quote = { ...QUOTE, price: 999 }
    await tick()
    expect(root?.textContent).toContain('$999.00')
    el.remove()
  })

  it('sg-trade-form shows quote loading and error states', async () => {
    const el = mount<SgTradeForm>('sg-trade-form', { quoteLoading: true })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('Loading quote')

    el.quoteLoading = false
    el.quoteError = 'Yahoo failed'
    await tick()
    expect(el.shadowRoot?.textContent).toContain('Yahoo failed')
    el.remove()
  })

  it('sg-holdings-table renders and re-renders rows from the holdings property', async () => {
    const el = mount<SgHoldingsTable>('sg-holdings-table', { holdings: [HOLDING] })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('AAPL')
    expect(el.shadowRoot?.textContent).toContain('10')

    el.holdings = [{ ...HOLDING, symbol: 'MSFT' }]
    await tick()
    expect(el.shadowRoot?.textContent).toContain('MSFT')
    expect(el.shadowRoot?.textContent).not.toContain('Apple Inc.')
    el.remove()
  })

  it('sg-trades-table renders and reacts to trades', async () => {
    const el = mount<SgTradesTable>('sg-trades-table', { trades: [TRADE] })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('AAPL')
    expect(el.shadowRoot?.textContent).toContain('backdated')

    el.trades = [{ ...TRADE, symbol: 'MSFT', side: 'sell' }]
    await tick()
    expect(el.shadowRoot?.textContent).toContain('MSFT')
    expect(el.shadowRoot?.textContent).toContain('sell')
    el.remove()
  })

  it('sg-orders-table renders, reacts, and emits cancel', async () => {
    const el = mount<SgOrdersTable>('sg-orders-table', { orders: [ORDER] })
    await tick()
    expect(el.shadowRoot?.textContent).toContain('pending')
    let detail: unknown
    el.addEventListener('sg-order-cancel', (event) => {
      detail = (event as CustomEvent).detail
    })
    const cancel = el.shadowRoot?.querySelector('button')
    expect(cancel).not.toBeNull()
    cancel?.click()
    expect(detail).toEqual({ id: ORDER.id })

    el.orders = [{ ...ORDER, symbol: 'MSFT', status: 'filled', tradeId: 7 }]
    await tick()
    expect(el.shadowRoot?.textContent).toContain('MSFT')
    expect(el.shadowRoot?.querySelector('button')).toBeNull()
    el.remove()
  })

  it('sg-settings-form renders and reacts to config changes', async () => {
    const el = mount<SgSettingsForm>('sg-settings-form', {
      config: {
        startingCashCents: 123_400,
        startDate: Date.parse('2024-01-01'),
        provider: 'yahoo',
        quoteDelayMinutes: 15,
        commissionCentsPerTrade: 0,
      },
    })
    await tick()
    const cash = el.shadowRoot?.querySelector<HTMLInputElement>('#cash')
    expect(cash?.value).toBe('1234')
    expect(el.shadowRoot?.querySelector<HTMLInputElement>('#quoteDelay')?.value).toBe('15')
    expect(el.shadowRoot?.querySelector<HTMLInputElement>('#commission')?.value).toBe('0')
    expect(el.shadowRoot?.textContent).toContain('Starting cash')

    el.config = {
      startingCashCents: 999_00,
      startDate: Date.parse('2024-01-01'),
      provider: 'yahoo',
      quoteDelayMinutes: 15,
      commissionCentsPerTrade: 0,
    }
    await tick()
    const updated = el.shadowRoot?.querySelector<HTMLInputElement>('#cash')
    expect(updated?.value).toBe('999')
    el.remove()
  })

  it('sg-portfolio-chart renders a chart and pushes updated points to the series', async () => {
    const el = mount<SgPortfolioChart>('sg-portfolio-chart', {
      points: [{ time: Date.parse('2024-01-01'), value: 100 }],
    })
    await tick()
    expect(el.shadowRoot?.querySelector('.chart')).not.toBeNull()
    expect(setDataSpy).toHaveBeenCalled()

    setDataSpy.mockClear()
    el.points = [
      { time: Date.parse('2024-01-01'), value: 100 },
      { time: Date.parse('2024-01-02'), value: 200 },
    ]
    await tick()
    const calls = setDataSpy.mock.calls.map((c) => c[0] as Array<{ value: number }>)
    const pointsCall = calls.find((c) => c.length === 2)
    expect(pointsCall).toBeDefined()
    expect(pointsCall?.[1]?.value).toBe(200)
    el.remove()
  })
})
