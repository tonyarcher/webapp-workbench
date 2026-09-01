import { describe, expect, it } from 'vitest'
import type { GameConfig, Side, Trade } from '@stock-game/shared'
import { createPortfolio } from './portfolio'
import { dayBar, fakeProvider } from '../testing/fakeProvider'

const config: GameConfig = {
  startingCashCents: 100_000,
  startDate: Date.parse('2024-01-01'),
  provider: 'fake',
  quoteDelayMinutes: 15,
  commissionCentsPerTrade: 0,
}

function trade(
  symbol: string,
  side: Side,
  qty: number,
  price: number,
  executedAt: number,
): Trade {
  const amount = Math.round(qty * price * 100)
  const delta = side === 'buy' || side === 'cover' ? -amount : amount
  return {
    id: 1,
    symbol,
    side,
    qty,
    price,
    cashDeltaCents: delta,
    mode: 'backdated',
    executedAt,
    createdAt: executedAt,
  }
}

describe('portfolio series', () => {
  it('values cash and holdings at each trading day', async () => {
    const provider = fakeProvider({
      bars: [dayBar('2024-01-02', 100), dayBar('2024-01-03', 200)],
    })
    const portfolio = createPortfolio(provider)
    const trades = [trade('AAPL', 'buy', 10, 100, Date.parse('2024-01-02T14:30:00'))]
    const series = await portfolio.getSeries(config, trades)

    expect(series.points[0]!.totalCents).toBe(100_000)
    const buyDay = series.points.find((p) => p.time === Date.parse('2024-01-02'))
    expect(buyDay?.cashCents).toBe(0)
    expect(buyDay?.holdingsCents).toBe(100_000)
    const nextDay = series.points.find((p) => p.time === Date.parse('2024-01-03'))
    expect(nextDay?.holdingsCents).toBe(200_000)
    expect(series.totalReturnPct).toBe(100)
  })

  it('forward-fills the last known close on days without a bar', async () => {
    const provider = fakeProvider({
      bars: [dayBar('2024-01-02', 100), dayBar('2024-01-03', 200)],
    })
    const portfolio = createPortfolio(provider)
    const trades = [
      trade('AAPL', 'buy', 10, 100, Date.parse('2024-01-02T14:30:00')),
      trade('AAPL', 'sell', 5, 200, Date.parse('2024-01-04T14:30:00')),
    ]
    const series = await portfolio.getSeries(config, trades)

    const sellDay = series.points.find((p) => p.time === Date.parse('2024-01-04'))
    expect(sellDay?.cashCents).toBe(0 + 5 * 200 * 100)
    expect(sellDay?.holdingsCents).toBe(5 * 200 * 100)
    expect(sellDay?.totalCents).toBe(5 * 200 * 100 + 5 * 200 * 100)
  })

  it('produces a flat cash-only series when there are no trades', async () => {
    const provider = fakeProvider({ bars: [dayBar('2024-01-02', 100)] })
    const portfolio = createPortfolio(provider)
    const series = await portfolio.getSeries(config, [])
    expect(series.points.length).toBeGreaterThan(0)
    for (const point of series.points) {
      expect(point.holdingsCents).toBe(0)
      expect(point.totalCents).toBe(config.startingCashCents)
    }
    expect(series.totalReturnPct).toBe(0)
  })
})

describe('portfolio play', () => {
  it('last point gainCents matches cash+holdings-start', async () => {
    const provider = fakeProvider({ bars: [dayBar('2024-01-02', 100), dayBar('2024-01-03', 110)] })
    const portfolio = createPortfolio(provider)
    const trades = [trade('AAPL', 'buy', 10, 100, Date.parse('2024-01-02T14:30:00')), trade('AAPL', 'sell', 10, 110, Date.parse('2024-01-03T14:30:00'))]
    const series = await portfolio.getSeries(config, trades)
    const last = series.points.at(-1)!
    expect(last.gainCents).toBe(last.totalCents - config.startingCashCents)
    expect(series.totalGainCents).toBe(last.gainCents)
  })
})
