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
import { expiresAtForOrder, isNyseOpen } from './trading-hours'
import { fillPriceForBar, shouldFillQuote } from './trading-fills'

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

function getConfigImpl(repo: Repo): GameConfig {
  const existing = repo.getConfig()
  if (existing) return existing
  const config: GameConfig = {
    startingCashCents: DEFAULT_STARTING_CASH_CENTS,
    startDate: Date.now(),
    provider: getEnv().provider,
  }
  repo.saveConfig(config)
  return config
}

function updateConfigImpl(repo: Repo, current: GameConfig, input: UpdateConfigRequest): GameConfig {
  const config: GameConfig = {
    startingCashCents: input.startingCashCents,
    startDate: input.startDate,
    provider: input.provider ?? current.provider,
  }
  repo.saveConfig(config)
  return config
}

function cashNowImpl(repo: Repo): number {
  return cashUpTo(getConfigImpl(repo), repo.listTrades(), Date.now())
}

export function signedQty(side: Side, qty: number): number {
  if (side === 'buy' || side === 'cover') return qty
  return -qty
}

export function cashDelta(side: Side, qty: number, price: number): number {
  const amount = Math.round(qty * price * 100)
  if (side === 'buy' || side === 'cover') return -amount
  return amount
}

function heldQtyImpl(repo: Repo, symbol: string): number {
  let qty = 0
  for (const trade of repo.listTrades()) {
    if (trade.symbol !== symbol) continue
    qty += signedQty(trade.side, trade.qty)
  }
  return qty
}

async function findBarForBackdated(provider: PriceProvider, symbol: string, at: number) {
  const from = at - 10 * DAY_MS
  const to = at + 45 * DAY_MS
  const bars = await provider.getBars(symbol, '1d', from, to)
  const candidates = bars.filter((bar) => bar.time >= at).sort((a, b) => a.time - b.time)
  return candidates[0]
}

async function placeBackdatedImpl(repo: Repo, provider: PriceProvider, input: PlaceTradeRequest): Promise<Trade> {
  const config = getConfigImpl(repo)
  if (input.at < config.startDate) throw new TradingError(`Backdated trades before the game start date (${new Date(config.startDate).toISOString()}) are not allowed`)
  const bar = await findBarForBackdated(provider, input.symbol, input.at)
  if (!bar) throw new TradingError(`No trading day found on or after ${new Date(input.at).toISOString()} for ${input.symbol}`)
  const orderType = input.orderType ?? 'market'
  const maybePrice = fillPriceForBar(bar, input.side, orderType, input.limitPrice ?? null, input.stopPrice ?? null)
  if (maybePrice === null) throw new TradingError('Order did not fill')
  const price = round2(maybePrice)
  validateAvailable(config, repo.listTrades(), input.symbol, input.side, input.qty, price, bar.time)
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
}

function placeOrderImpl(repo: Repo, input: PlaceOrderRequest): Order {
  if (input.executeAt <= Date.now()) throw new TradingError('Scheduled execution time must be in the future')
  const orderType = input.orderType ?? 'market'
  const tif = input.tif ?? 'GTC'
  const expiresAt = tif === 'DAY' ? expiresAtForOrder(input.executeAt) : null
  return repo.insertOrder({
    symbol: input.symbol,
    side: input.side,
    qty: input.qty,
    executeAt: input.executeAt,
    createdAt: Date.now(),
    orderType,
    tif,
    limitPrice: input.limitPrice ?? null,
    stopPrice: input.stopPrice ?? null,
    expiresAt,
  })
}

function canBuyCash(repo: Repo, delta: number): boolean {
  return cashNowImpl(repo) + delta >= 0
}

function canSellShares(repo: Repo, symbol: string, qty: number): boolean {
  const held = heldQtyImpl(repo, symbol)
  return held >= qty
}

function canCover(repo: Repo, symbol: string, qty: number, delta: number): boolean {
  const held = heldQtyImpl(repo, symbol)
  const shortQty = Math.max(0, -held)
  if (shortQty < qty) return false
  return cashNowImpl(repo) + delta >= 0
}

async function processDueOrder(repo: Repo, provider: PriceProvider, order: Order, now: number): Promise<boolean> {
  try {
    const quote = await provider.getQuote(order.symbol)
    const should = shouldFillQuote(quote.price, order.side, order.orderType, order.limitPrice, order.stopPrice)
    if (!should) return false
    return await tryFillDue(repo, order, quote.price, now)
  } catch {
    return false
  }
}

async function tryFillDue(repo: Repo, order: Order, quotePrice: number, now: number): Promise<boolean> {
  const price = round2(quotePrice)
  const delta = cashDelta(order.side, order.qty, price)
  if (order.side === 'buy') {
    if (!canBuyCash(repo, delta)) return false
  } else if (order.side === 'sell') {
    if (!canSellShares(repo, order.symbol, order.qty)) { repo.cancelOrder(order.id); return false }
  } else if (order.side === 'cover') {
    if (!canCover(repo, order.symbol, order.qty, delta)) {
      const held = heldQtyImpl(repo, order.symbol)
      if (Math.max(0, -held) < order.qty) repo.cancelOrder(order.id)
      return false
    }
  } else {
    void 0
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
  return trade !== null
}

function cancelExpiredDayOrders(repo: Repo, now: number): void {
  const orders = repo.listOrders()
  for (const order of orders) {
    if (order.status !== 'pending') continue
    if (order.tif !== 'DAY') continue
    if (order.expiresAt !== null && order.expiresAt <= now) repo.cancelOrder(order.id)
  }
}

async function executeDueImpl(repo: Repo, provider: PriceProvider, now: number): Promise<number> {
  cancelExpiredDayOrders(repo, now)
  const due = repo.getPendingOrders(now)
  let filled = 0
  for (const order of due) {
    if (order.status !== 'pending') continue
    if (order.expiresAt !== null && order.expiresAt <= now) continue
    if (!isNyseOpen(now)) continue
    const ok = await processDueOrder(repo, provider, order, now)
    if (ok) filled++
  }
  return filled
}

export function accumulatePositions(trades: Trade[]): Map<string, { qty: number; totalCostCents: number }> {
  const stateBySymbol = new Map<string, { qty: number; totalCostCents: number }>()
  for (const trade of trades) stateBySymbol.set(trade.symbol, updatePosition(stateBySymbol.get(trade.symbol), trade))
  return stateBySymbol
}

function updatePosition(prev: { qty: number; totalCostCents: number } | undefined, trade: Trade): { qty: number; totalCostCents: number } {
  const state = prev ?? { qty: 0, totalCostCents: 0 }
  const signed = signedQty(trade.side, trade.qty)
  const nextQty = state.qty + signed
  if (state.qty === 0) return openingPosition(trade, nextQty)
  if (Math.sign(nextQty) === Math.sign(state.qty) && Math.abs(nextQty) > Math.abs(state.qty)) return increasingPosition(state, trade, nextQty)
  if (nextQty === 0) return { qty: 0, totalCostCents: 0 }
  return reducingPosition(state, trade, nextQty)
}

function openingPosition(trade: Trade, nextQty: number): { qty: number; totalCostCents: number } {
  const cost = Math.round(trade.qty * trade.price * 100)
  void nextQty
  return { qty: signedQty(trade.side, trade.qty), totalCostCents: cost }
}

function increasingPosition(state: { qty: number; totalCostCents: number }, trade: Trade, nextQty: number): { qty: number; totalCostCents: number } {
  const added = Math.round(trade.qty * trade.price * 100)
  return { qty: nextQty, totalCostCents: state.totalCostCents + added }
}

function reducingPosition(state: { qty: number; totalCostCents: number }, trade: Trade, nextQty: number): { qty: number; totalCostCents: number } {
  const absPrev = Math.abs(state.qty)
  const closingQty = Math.min(trade.qty, absPrev)
  const avg = state.totalCostCents / absPrev
  void trade
  const remaining = absPrev - closingQty
  return { qty: nextQty, totalCostCents: Math.round(avg * remaining) }
}

async function buildHoldingEntries(
  provider: PriceProvider,
  stateBySymbol: Map<string, { qty: number; totalCostCents: number }>,
): Promise<HoldingsEntry[]> {
  const entries: HoldingsEntry[] = []
  for (const [symbol, state] of stateBySymbol) {
    if (state.qty === 0) continue
    const avgCostCents = Math.round(state.totalCostCents / Math.abs(state.qty))
    const holding = await buildSingleHolding(provider, symbol, state, avgCostCents)
    entries.push(holding)
  }
  entries.sort((a, b) => b.marketValueCents - a.marketValueCents)
  return entries
}

async function resolveHoldingQuote(provider: PriceProvider, symbol: string, avgCostCents: number): Promise<{ price: number; name: string }> {
  try {
    const quote = await provider.getQuote(symbol)
    return { price: quote.price, name: quote.name }
  } catch {
    return { price: avgCostCents / 100, name: symbol }
  }
}

function holdingMetrics(qty: number, avgCostCents: number, currentPrice: number) {
  const marketValueCents = Math.round(qty * currentPrice * 100)
  const costBasisCents = Math.abs(qty) * avgCostCents
  const isShort = qty < 0
  const unrealizedPnlCents = isShort ? costBasisCents - Math.abs(marketValueCents) : marketValueCents - costBasisCents
  const signedMarket = isShort ? -Math.abs(marketValueCents) : marketValueCents
  void signedMarket
  const pct = costBasisCents > 0 ? (unrealizedPnlCents / costBasisCents) * 100 : 0
  return { marketValueCents, costBasisCents, unrealizedPnlCents, unrealizedPnlPct: round2(pct) }
}

async function buildSingleHolding(provider: PriceProvider, symbol: string, state: { qty: number; totalCostCents: number }, avgCostCents: number): Promise<HoldingsEntry> {
  const { price: currentPrice, name } = await resolveHoldingQuote(provider, symbol, avgCostCents)
  const m = holdingMetrics(state.qty, avgCostCents, currentPrice)
  return { symbol, name, qty: state.qty, avgCostCents, costBasisCents: m.costBasisCents, currentPrice, marketValueCents: m.marketValueCents, unrealizedPnlCents: m.unrealizedPnlCents, unrealizedPnlPct: m.unrealizedPnlPct }
}

async function getHoldingsImpl(repo: Repo, provider: PriceProvider): Promise<HoldingsEntry[]> {
  const stateBySymbol = accumulatePositions(repo.listTrades())
  return buildHoldingEntries(provider, stateBySymbol)
}

export function createTrading(repo: Repo, provider: PriceProvider): TradingService {
  return {
    getConfig: () => getConfigImpl(repo),
    updateConfig: (input) => updateConfigImpl(repo, getConfigImpl(repo), input),
    listTrades: () => repo.listTrades(),
    cashNowCents: () => cashNowImpl(repo),
    placeBackdatedTrade: (input) => placeBackdatedImpl(repo, provider, input),
    placeOrder: (input) => placeOrderImpl(repo, input),
    listOrders: () => repo.listOrders(),
    cancelOrder: (orderId) => repo.cancelOrder(orderId),
    executeDueOrders: (now) => executeDueImpl(repo, provider, now ?? Date.now()),
    getHoldings: () => getHoldingsImpl(repo, provider),
    heldQty: (symbol) => heldQtyImpl(repo, symbol),
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
  if (side === 'buy') validateBuy(config, trades, at, qty, price)
  else if (side === 'sell') validateSell(trades, symbol, at, qty)
  else if (side === 'cover') validateCover(config, trades, symbol, at, qty, price)
  else validateShort()
}

function validateBuy(config: GameConfig, trades: Trade[], at: number, qty: number, price: number): void {
  const delta = cashDelta('buy', qty, price)
  if (cashUpTo(config, trades, at) + delta < 0) throw new TradingError('Insufficient cash for this buy based on cash as of that date')
}

function validateSell(trades: Trade[], symbol: string, at: number, qty: number): void {
  const held = heldQtyUpTo(trades, symbol, at)
  const longQty = Math.max(0, held)
  if (longQty < qty) throw new TradingError(`Only ${longQty} share(s) of ${symbol} held as of that date`)
}

function validateCover(config: GameConfig, trades: Trade[], symbol: string, at: number, qty: number, price: number): void {
  const held = heldQtyUpTo(trades, symbol, at)
  const shortQty = Math.max(0, -held)
  if (shortQty < qty) throw new TradingError(`Only ${shortQty} share(s) short of ${symbol} held as of that date`)
  const delta = cashDelta('cover', qty, price)
  if (cashUpTo(config, trades, at) + delta < 0) throw new TradingError('Insufficient cash to cover this short')
}

function validateShort(): void {
  return
}

function heldQtyUpTo(trades: Trade[], symbol: string, at: number): number {
  let qty = 0
  for (const trade of trades) {
    if (trade.symbol !== symbol || trade.executedAt > at) continue
    qty += signedQty(trade.side, trade.qty)
  }
  return qty
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
