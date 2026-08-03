import { describe, expect, it } from 'vitest'
import { openRepo } from '../db'
import { TradingError, createTrading } from './trading'
import { dayBar, fakeProvider } from '../testing/fakeProvider'

const BARS = [
  dayBar('2024-01-02', 100),
  dayBar('2024-01-03', 105),
  dayBar('2024-01-04', 110),
  dayBar('2024-01-05', 115),
  dayBar('2024-01-08', 120),
]
const EARLY_START = Date.parse('2023-01-01')

function configureForBackdated(
  trading: ReturnType<typeof createTrading>,
  startDate = EARLY_START,
): void {
  trading.updateConfig({ startingCashCents: 10_000_000, startDate, provider: 'fake' })
}

describe('createTrading.placeBackdatedTrade', () => {
  it('fills at the close of the trading day on/after the chosen time', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars: BARS }))
    configureForBackdated(trading)
    const trade = await trading.placeBackdatedTrade({
      symbol: 'AAPL',
      side: 'buy',
      qty: 10,
      at: Date.parse('2024-01-02T10:00:00Z'),
    })
    expect(trade.price).toBe(100)
    expect(trade.cashDeltaCents).toBe(-100000)
    expect(trade.mode).toBe('backdated')
    expect(trade.executedAt).toBe(BARS[0]!.time)
  })

  it('snaps a non-trading day forward to the next trading day', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars: BARS }))
    configureForBackdated(trading)
    const trade = await trading.placeBackdatedTrade({
      symbol: 'AAPL',
      side: 'buy',
      qty: 5,
      at: Date.parse('2024-01-06T00:00:00'),
    })
    expect(trade.executedAt).toBe(BARS[4]!.time)
    expect(trade.price).toBe(120)
  })

  it('rejects a backdated trade before the game start date', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars: BARS }))
    configureForBackdated(trading, Date.parse('2024-01-03'))
    await expect(
      trading.placeBackdatedTrade({
        symbol: 'AAPL',
        side: 'buy',
        qty: 1,
        at: Date.parse('2024-01-02T00:00:00Z'),
      }),
    ).rejects.toThrow(/game start date/)
  })

  it('rejects a buy with insufficient cash as of that date', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars: BARS }))
    trading.updateConfig({ startingCashCents: 5000, startDate: BARS[0]!.time, provider: 'fake' })
    await expect(
      trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: BARS[0]!.time }),
    ).rejects.toThrow(TradingError)
  })

  it('rejects selling more shares than held as of that date', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars: BARS }))
    configureForBackdated(trading)
    await expect(
      trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 1, at: BARS[0]!.time }),
    ).rejects.toThrow(/Only 0 share/)
  })
})

describe('createTrading orders', () => {
  it('executes due orders and links the trade', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: {
          symbol: 'AAPL',
          name: 'Apple',
          price: 90,
          currency: 'USD',
          exchange: 'T',
          time: 0,
          delayMinutes: 0,
        },
      }),
    )
    const order = trading.placeOrder({
      symbol: 'AAPL',
      side: 'buy',
      qty: 2,
      executeAt: Date.now() + 5_000,
    })
    const filled = await trading.executeDueOrders(Date.now() + 10_000)
    expect(filled).toBe(1)
    const orders = trading.listOrders()
    expect(orders[0]!.id).toBe(order.id)
    expect(orders[0]!.status).toBe('filled')
    expect(orders[0]!.tradeId).not.toBeNull()
    expect(trading.heldQty('AAPL')).toBe(2)
  })

  it('does not double-fill an order under concurrent execution', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: {
          symbol: 'AAPL',
          name: 'Apple',
          price: 90,
          currency: 'USD',
          exchange: 'T',
          time: 0,
          delayMinutes: 0,
        },
      }),
    )
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 2, executeAt: Date.now() + 5_000 })
    const first = trading.executeDueOrders(Date.now() + 10_000)
    const second = trading.executeDueOrders(Date.now() + 10_000)
    const [filledFirst, filledSecond] = await Promise.all([first, second])
    expect(filledFirst + filledSecond).toBe(1)
    expect(trading.listTrades()).toHaveLength(1)
    expect(trading.listOrders().filter((order) => order.status === 'filled')).toHaveLength(1)
  })

  it('leaves a buy pending when cash is insufficient at fill time', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: {
          symbol: 'AAPL',
          name: 'Apple',
          price: 900,
          currency: 'USD',
          exchange: 'T',
          time: 0,
          delayMinutes: 0,
        },
      }),
    )
    trading.updateConfig({ startingCashCents: 1000, startDate: Date.now(), provider: 'fake' })
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 10, executeAt: Date.now() + 5_000 })
    const filled = await trading.executeDueOrders(Date.now() + 10_000)
    expect(filled).toBe(0)
    expect(trading.listOrders()[0]!.status).toBe('pending')
  })

  it('rejects an order with a past execution time', () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider())
    expect(() =>
      trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt: Date.now() - 5_000 }),
    ).toThrow(/future/)
  })
})

describe('createTrading.getHoldings', () => {
  it('computes average cost across buys and a partial sell', async () => {
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        bars: BARS,
        quote: {
          symbol: 'AAPL',
          name: 'Apple',
          price: 120,
          currency: 'USD',
          exchange: 'T',
          time: 0,
          delayMinutes: 0,
        },
      }),
    )
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: BARS[0]!.time })
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: BARS[1]!.time })
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 5, at: BARS[2]!.time })
    const holdings = await trading.getHoldings()
    expect(holdings).toHaveLength(1)
    expect(holdings[0]!.symbol).toBe('AAPL')
    expect(holdings[0]!.qty).toBe(15)
    expect(holdings[0]!.avgCostCents).toBe(10250)
    expect(holdings[0]!.unrealizedPnlCents).toBe(15 * 12000 - 15 * 10250)
  })
})
