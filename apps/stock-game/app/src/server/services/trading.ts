import type {
  GameConfig,
  HoldingsEntry,
  Order,
  PlaceOrderRequest,
  PlaceTradeRequest,
  Side,
  Trade,
  UpdateConfigRequest,
} from '@stock-game/shared'
import type { Repo } from '../db'
import type { PriceProvider } from '../providers/types'
import { getEnv } from '../env'
import { getProvider, getRepo } from './marketData'

export class TradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TradingError'
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_STARTING_CASH_CENTS = 10_000_000

export interface TradingService {
  getConfig(): GameConfig
  updateConfig(input: UpdateConfigRequest): GameConfig
  listTrades(): Trade[]
  cashNowCents(): number
  placeBackdatedTrade(input: PlaceTradeRequest): Promise<Trade>
  placeOrder(input: PlaceOrderRequest): Order
  listOrders(): Order[]
  cancelOrder(orderId: number): void
  executeDueOrders(now?: number): Promise<number>
  getHoldings(): Promise<HoldingsEntry[]>
  heldQty(symbol: string): number
}

export function createTrading(repo: Repo, provider: PriceProvider): TradingService {
  return {
    getConfig(): GameConfig {
      const existing = repo.getConfig()
      if (existing) return existing
      const config: GameConfig = {
        startingCashCents: DEFAULT_STARTING_CASH_CENTS,
        startDate: Date.now(),
        provider: getEnv().provider,
      }
      repo.saveConfig(config)
      return config
    },

    updateConfig(input: UpdateConfigRequest): GameConfig {
      const current = this.getConfig()
      const config: GameConfig = {
        startingCashCents: input.startingCashCents,
        startDate: input.startDate,
        provider: input.provider ?? current.provider,
      }
      repo.saveConfig(config)
      return config
    },

    listTrades(): Trade[] {
      return repo.listTrades()
    },

    cashNowCents(): number {
      return cashUpTo(this.getConfig(), this.listTrades(), Date.now())
    },

    async placeBackdatedTrade(input: PlaceTradeRequest): Promise<Trade> {
      const config = this.getConfig()
      if (input.at < config.startDate) {
        throw new TradingError(
          `Backdated trades before the game start date (${new Date(config.startDate).toISOString()}) are not allowed`,
        )
      }
      const from = input.at - 10 * DAY_MS
      const to = input.at + 45 * DAY_MS
      const bars = await provider.getBars(input.symbol, '1d', from, to)
      const candidates = bars
        .filter((bar) => bar.time >= input.at)
        .sort((a, b) => a.time - b.time)
      const bar = candidates[0]
      if (!bar) {
        throw new TradingError(
          `No trading day found on or after ${new Date(input.at).toISOString()} for ${input.symbol}`,
        )
      }
      const price = round2(bar.close)
      validateAvailable(config, this.listTrades(), input.symbol, input.side, input.qty, price, bar.time)
      return repo.insertTrade({
        symbol: input.symbol,
        side: input.side,
        qty: input.qty,
        price,
        cashDeltaCents: cashDelta(input.side, input.qty, price),
        mode: 'backdated',
        executedAt: bar.time,
        createdAt: Date.now(),
      })
    },

    placeOrder(input: PlaceOrderRequest): Order {
      if (input.executeAt <= Date.now()) {
        throw new TradingError('Scheduled execution time must be in the future')
      }
      return repo.insertOrder({
        symbol: input.symbol,
        side: input.side,
        qty: input.qty,
        executeAt: input.executeAt,
        createdAt: Date.now(),
      })
    },

    listOrders(): Order[] {
      return repo.listOrders()
    },

    cancelOrder(orderId: number): void {
      repo.cancelOrder(orderId)
    },

    async executeDueOrders(now = Date.now()): Promise<number> {
      const due = repo.getPendingOrders(now)
      let filled = 0
      for (const order of due) {
        try {
          const quote = await provider.getQuote(order.symbol)
          const price = round2(quote.price)
          const delta = cashDelta(order.side, order.qty, price)
          if (order.side === 'buy') {
            if (this.cashNowCents() + delta < 0) continue
          } else {
            if (this.heldQty(order.symbol) < order.qty) {
              repo.cancelOrder(order.id)
              continue
            }
          }
          const trade = repo.fillOrderWithTrade(order.id, {
            symbol: order.symbol,
            side: order.side,
            qty: order.qty,
            price,
            cashDeltaCents: delta,
            mode: 'scheduled',
            executedAt: now,
            createdAt: Date.now(),
          })
          if (trade !== null) filled++
        } catch {
          // Transient provider error — leave the order pending for the next tick.
        }
      }
      return filled
    },

    async getHoldings(): Promise<HoldingsEntry[]> {
      const stateBySymbol = new Map<string, { qty: number; totalCostCents: number }>()
      for (const trade of this.listTrades()) {
        const state = stateBySymbol.get(trade.symbol) ?? { qty: 0, totalCostCents: 0 }
        if (trade.side === 'buy') {
          state.qty += trade.qty
          state.totalCostCents += Math.round(trade.qty * trade.price * 100)
        } else if (state.qty > 0) {
          const avg = state.totalCostCents / state.qty
          state.totalCostCents = Math.round(avg * (state.qty - trade.qty))
          state.qty = Math.max(0, state.qty - trade.qty)
        }
        if (state.qty <= 0) state.totalCostCents = 0
        stateBySymbol.set(trade.symbol, state)
      }

      const entries: HoldingsEntry[] = []
      for (const [symbol, state] of stateBySymbol) {
        if (state.qty <= 0) continue
        const avgCostCents = Math.round(state.totalCostCents / state.qty)
        let currentPrice: number
        let name: string
        try {
          const quote = await provider.getQuote(symbol)
          currentPrice = quote.price
          name = quote.name
        } catch {
          currentPrice = avgCostCents / 100
          name = symbol
        }
        const marketValueCents = Math.round(state.qty * currentPrice * 100)
        const costBasisCents = state.qty * avgCostCents
        const unrealizedPnlCents = marketValueCents - costBasisCents
        const unrealizedPnlPct =
          costBasisCents > 0 ? (unrealizedPnlCents / costBasisCents) * 100 : 0
        entries.push({
          symbol,
          name,
          qty: state.qty,
          avgCostCents,
          costBasisCents,
          currentPrice,
          marketValueCents,
          unrealizedPnlCents,
          unrealizedPnlPct: round2(unrealizedPnlPct),
        })
      }
      entries.sort((a, b) => b.marketValueCents - a.marketValueCents)
      return entries
    },

    heldQty(symbol: string): number {
      let qty = 0
      for (const trade of this.listTrades()) {
        if (trade.symbol !== symbol) continue
        qty += trade.side === 'buy' ? trade.qty : -trade.qty
      }
      return qty
    },
  }
}

let trading: TradingService | undefined
let executionInFlight = false

export function getTrading(): TradingService {
  if (trading === undefined) trading = createTrading(getRepo(), getProvider())
  return trading
}

export function getConfig(): GameConfig {
  return getTrading().getConfig()
}

export function updateConfig(input: UpdateConfigRequest): GameConfig {
  return getTrading().updateConfig(input)
}

export function listTrades(): Trade[] {
  return getTrading().listTrades()
}

export function cashNowCents(): number {
  return getTrading().cashNowCents()
}

export function placeBackdatedTrade(input: PlaceTradeRequest): Promise<Trade> {
  return getTrading().placeBackdatedTrade(input)
}

export function placeOrder(input: PlaceOrderRequest): Order {
  return getTrading().placeOrder(input)
}

export function listOrders(): Order[] {
  return getTrading().listOrders()
}

export function cancelOrder(orderId: number): void {
  getTrading().cancelOrder(orderId)
}

export function executeDueOrders(now = Date.now()): Promise<number> {
  if (executionInFlight) return Promise.resolve(0)
  executionInFlight = true
  try {
    return getTrading().executeDueOrders(now).finally(() => {
      executionInFlight = false
    })
  } catch (error) {
    executionInFlight = false
    throw error
  }
}

export function getHoldings(): Promise<HoldingsEntry[]> {
  return getTrading().getHoldings()
}

export function heldQty(symbol: string): number {
  return getTrading().heldQty(symbol)
}

function cashUpTo(config: GameConfig, trades: Trade[], at: number): number {
  let cash = config.startingCashCents
  for (const trade of trades) {
    if (trade.executedAt > at) continue
    cash += trade.cashDeltaCents
  }
  return cash
}

function validateAvailable(
  config: GameConfig,
  trades: Trade[],
  symbol: string,
  side: Side,
  qty: number,
  price: number,
  at: number,
): void {
  const delta = cashDelta(side, qty, price)
  if (side === 'buy') {
    if (cashUpTo(config, trades, at) + delta < 0) {
      throw new TradingError('Insufficient cash for this buy based on cash as of that date')
    }
    return
  }
  const held = heldQtyUpTo(trades, symbol, at)
  if (held < qty) {
    throw new TradingError(`Only ${held} share(s) of ${symbol} held as of that date`)
  }
}

function heldQtyUpTo(trades: Trade[], symbol: string, at: number): number {
  let qty = 0
  for (const trade of trades) {
    if (trade.symbol !== symbol || trade.executedAt > at) continue
    qty += trade.side === 'buy' ? trade.qty : -trade.qty
  }
  return qty
}

function cashDelta(side: Side, qty: number, price: number): number {
  const amount = Math.round(qty * price * 100)
  return side === 'buy' ? -amount : amount
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
