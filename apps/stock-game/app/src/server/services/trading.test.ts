import { describe, expect, it, vi } from 'vitest'
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
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
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
    vi.useRealTimers()
  })

  it('does not double-fill an order under concurrent execution', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
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
    vi.useRealTimers()
  })

  it('leaves a buy pending when cash is insufficient at fill time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
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
    vi.useRealTimers()
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

describe('play the game', () => {
  it('long winner: buy 10 @100 Jan2, sell 10 @110 Jan4', async () => {
    const bars = [dayBar('2024-01-02', 100), dayBar('2024-01-04', 110)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: Date.parse('2024-01-02') })
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 10, at: Date.parse('2024-01-04') })
    expect(trading.cashNowCents()).toBe(10_000_000 + 10000)
    expect(trading.heldQty('AAPL')).toBe(0)
  })

  it('long loser: buy 10 @120 Jan8 sell 10 @90 Jan9', async () => {
    const bars = [dayBar('2024-01-08', 120), dayBar('2024-01-09', 90)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: Date.parse('2024-01-08') })
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 10, at: Date.parse('2024-01-09') })
    expect(trading.cashNowCents()).toBe(10_000_000 - 30000)
  })

  it('short winner: short 10 @110 Jan4 cover 10 @90 Jan9', async () => {
    const bars = [dayBar('2024-01-04', 110), dayBar('2024-01-09', 90)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'short', qty: 10, at: Date.parse('2024-01-04') })
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'cover', qty: 10, at: Date.parse('2024-01-09') })
    expect(trading.cashNowCents()).toBe(10_000_000 + 20000)
    expect(trading.heldQty('AAPL')).toBe(0)
  })

  it('cannot sell more than long; cannot cover more than short', async () => {
    const bars = [dayBar('2024-01-02', 100), dayBar('2024-01-03', 100)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 5, at: Date.parse('2024-01-02') })
    await expect(trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 10, at: Date.parse('2024-01-03') })).rejects.toThrow(/Only/)
    await expect(trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'cover', qty: 1, at: Date.parse('2024-01-03') })).rejects.toThrow(/Only/)
  })

  it('limit buy at 100 does not fill on bar low=105', async () => {
    const bars = [dayBar('2024-01-02', 110, { low: 105, high: 115 })]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await expect(
      trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 1, at: Date.parse('2024-01-02'), orderType: 'limit', limitPrice: 100 }),
    ).rejects.toThrow(/did not fill/)
  })

  it('limit buy at 100 fills when low=99 close=101', async () => {
    const bars = [dayBar('2024-01-02', 101, { low: 99, high: 110 })]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    const trade = await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: Date.parse('2024-01-02'), orderType: 'limit', limitPrice: 100 })
    expect(trade.price).toBe(100)
  })

  it('stop sell fills when bar low triggers stop', async () => {
    const bars = [dayBar('2024-01-02', 105, { low: 100, high: 115 }), dayBar('2024-01-03', 102, { low: 100, high: 110 })]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'buy', qty: 10, at: Date.parse('2024-01-02') })
    const trade = await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'sell', qty: 10, at: Date.parse('2024-01-03'), orderType: 'stop', stopPrice: 102 })
    expect(trade.price).toBe(102)
  })

  it('scheduled market: past rejected, future fills', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ quote: { symbol: 'AAPL', name: 'AAPL', price: 50, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 } }))
    expect(() => trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt: Date.now() - 1000 })).toThrow(/future/)
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 2, executeAt: Date.now() + 5000 })
    const filled = await trading.executeDueOrders(Date.now() + 10000)
    expect(filled).toBe(1)
    vi.useRealTimers()
  })

  it('DAY expiry cancels without fill', async () => {
    vi.useFakeTimers()
    const executeAt = Date.parse('2024-01-03T14:00:00Z')
    vi.setSystemTime(Date.parse('2024-01-03T12:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ quote: { symbol: 'AAPL', name: 'AAPL', price: 50, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 } }))
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt, orderType: 'market', tif: 'DAY' })
    const afterClose = Date.parse('2024-01-03T21:30:00Z')
    const filled = await trading.executeDueOrders(afterClose)
    expect(filled).toBe(0)
    expect(trading.listOrders()[0]!.status).toBe('cancelled')
    vi.useRealTimers()
  })

  it('GTC limit buy stays pending if quote above limit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ quote: { symbol: 'AAPL', name: 'AAPL', price: 150, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 } }))
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt: Date.now() + 5000, orderType: 'limit', limitPrice: 100, tif: 'GTC' })
    const filled = await trading.executeDueOrders(Date.now() + 10000)
    expect(filled).toBe(0)
    expect(trading.listOrders()[0]!.status).toBe('pending')
    vi.useRealTimers()
  })

  it('short then cover updates heldQty to 0', async () => {
    const bars = [dayBar('2024-01-02', 100), dayBar('2024-01-03', 90)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    configureForBackdated(trading)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'short', qty: 5, at: Date.parse('2024-01-02') })
    expect(trading.heldQty('AAPL')).toBe(-5)
    await trading.placeBackdatedTrade({ symbol: 'AAPL', side: 'cover', qty: 5, at: Date.parse('2024-01-03') })
    expect(trading.heldQty('AAPL')).toBe(0)
  })

  it('does not fill GTC limits while the NYSE is closed', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-06T18:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ quote: { symbol: 'AAPL', name: 'AAPL', price: 50, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 } }))
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt: Date.now() + 1000, orderType: 'limit', limitPrice: 100, tif: 'GTC' })
    const filled = await trading.executeDueOrders(Date.now() + 5000)
    expect(filled).toBe(0)
    expect(trading.listOrders()[0]!.status).toBe('pending')
    vi.useRealTimers()
  })

  it('ASAP waits the configured quote delay during NYSE hours', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: { symbol: 'AAPL', name: 'AAPL', price: 50, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 },
      }),
    )
    const order = trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1 })
    expect(order.executeAt).toBe(Date.now() + 15 * 60_000)
    expect(await trading.executeDueOrders(Date.now())).toBe(0)
    expect(await trading.executeDueOrders(Date.now() + 15 * 60_000)).toBe(1)
    vi.useRealTimers()
  })

  it('backdated fill subtracts commission from cash', async () => {
    const bars = [dayBar('2024-01-02', 100)]
    const repo = openRepo(':memory:')
    const trading = createTrading(repo, fakeProvider({ bars }))
    trading.updateConfig({
      startingCashCents: 10_000_000,
      startDate: EARLY_START,
      provider: 'fake',
      commissionCentsPerTrade: 100,
    })
    const trade = await trading.placeBackdatedTrade({
      symbol: 'AAPL',
      side: 'buy',
      qty: 10,
      at: Date.parse('2024-01-02'),
    })
    expect(trade.cashDeltaCents).toBe(-100_100)
    expect(trading.cashNowCents()).toBe(10_000_000 - 100_100)
  })

  it('scheduled fill subtracts commission from cash', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: { symbol: 'AAPL', name: 'AAPL', price: 50, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 },
      }),
    )
    trading.updateConfig({
      startingCashCents: 10_000_000,
      startDate: Date.now(),
      provider: 'fake',
      quoteDelayMinutes: 0,
      commissionCentsPerTrade: 100,
    })
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 2, executeAt: Date.now() + 5_000 })
    expect(await trading.executeDueOrders(Date.now() + 10_000)).toBe(1)
    expect(trading.listTrades()[0]!.cashDeltaCents).toBe(-10_100)
    vi.useRealTimers()
  })

  it('buy that covers price but not commission stays pending', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2024-01-03T15:00:00Z'))
    const repo = openRepo(':memory:')
    const trading = createTrading(
      repo,
      fakeProvider({
        quote: { symbol: 'AAPL', name: 'AAPL', price: 100, currency: 'USD', exchange: 'T', time: 0, delayMinutes: 0 },
      }),
    )
    trading.updateConfig({
      startingCashCents: 10_000,
      startDate: Date.now(),
      provider: 'fake',
      quoteDelayMinutes: 0,
      commissionCentsPerTrade: 100,
    })
    trading.placeOrder({ symbol: 'AAPL', side: 'buy', qty: 1, executeAt: Date.now() + 5_000 })
    expect(await trading.executeDueOrders(Date.now() + 10_000)).toBe(0)
    expect(trading.listOrders()[0]!.status).toBe('pending')
    vi.useRealTimers()
  })
})
