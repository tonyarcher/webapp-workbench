import type { GameConfig, PortfolioSeries, Trade } from '@stock-game/shared'
import type { PriceProvider } from '../providers/types'
import { getProvider } from './marketData'
import { getConfig, listTrades } from './trading'

const DAY_MS = 24 * 60 * 60 * 1000

export interface PortfolioService {
  getSeries(config: GameConfig, trades: Trade[]): Promise<PortfolioSeries>
}

async function loadBarsBySymbol(
  provider: PriceProvider,
  symbols: string[],
  startDate: number,
  now: number,
): Promise<Map<string, Array<{ time: number; close: number }>>> {
  const barsBySymbol = new Map<string, Array<{ time: number; close: number }>>()
  for (const symbol of symbols) {
    const from = startDate - DAY_MS
    const to = now + DAY_MS
    const bars = await provider.getBars(symbol, '1d', from, to)
    barsBySymbol.set(
      symbol,
      bars.map((bar) => ({ time: bar.time, close: bar.close })),
    )
  }
  return barsBySymbol
}

function collectDays(
  startDate: number,
  now: number,
  orderedTrades: Trade[],
  barsBySymbol: Map<string, Array<{ time: number; close: number }>>,
): number[] {
  const daySet = new Set<number>([dayOf(startDate), dayOf(now)])
  for (const trade of orderedTrades) daySet.add(dayOf(trade.executedAt))
  for (const bars of barsBySymbol.values()) for (const bar of bars) daySet.add(dayOf(bar.time))
  return [...daySet].sort((a, b) => a - b)
}

function signedQtyForPortfolio(side: string, qty: number): number {
  if (side === 'buy' || side === 'cover') return qty
  return -qty
}

function advanceTrades(
  orderedTrades: Trade[],
  tradeIndex: { value: number },
  endOfDay: number,
  positions: Map<string, { qty: number; barIndex: number; lastClose: number }>,
  cashRef: { value: number },
): void {
  while (tradeIndex.value < orderedTrades.length) {
    const trade = orderedTrades[tradeIndex.value]
    if (trade === undefined || trade.executedAt > endOfDay) break
    cashRef.value += trade.cashDeltaCents
    const position = positions.get(trade.symbol) ?? { qty: 0, barIndex: 0, lastClose: 0 }
    position.qty += signedQtyForPortfolio(trade.side, trade.qty)
    positions.set(trade.symbol, position)
    tradeIndex.value++
  }
}

function holdingsForDay(
  positions: Map<string, { qty: number; barIndex: number; lastClose: number }>,
  barsBySymbol: Map<string, Array<{ time: number; close: number }>>,
  endOfDay: number,
): number {
  let holdingsCents = 0
  for (const [symbol, position] of positions) {
    if (position.qty === 0) continue
    const bars = barsBySymbol.get(symbol)
    if (!bars) continue
    while (position.barIndex < bars.length) {
      const bar = bars[position.barIndex]
      if (bar === undefined || bar.time > endOfDay) break
      position.lastClose = bar.close
      position.barIndex++
    }
    holdingsCents += Math.round(position.qty * position.lastClose * 100)
  }
  return holdingsCents
}

function buildPoints(
  days: number[],
  orderedTrades: Trade[],
  barsBySymbol: Map<string, Array<{ time: number; close: number }>>,
  startingCash: number,
): PortfolioSeries['points'] {
  const points: PortfolioSeries['points'] = []
  const positions = new Map<string, { qty: number; barIndex: number; lastClose: number }>()
  let cash = startingCash
  const tradeIndex = { value: 0 }
  const cashRef = { value: cash }
  for (const day of days) {
    const endOfDay = day + DAY_MS - 1
    advanceTrades(orderedTrades, tradeIndex, endOfDay, positions, cashRef)
    cash = cashRef.value
    const holdingsCents = holdingsForDay(positions, barsBySymbol, endOfDay)
    const totalCents = cash + holdingsCents
    const gainCents = totalCents - startingCash
    points.push({ time: day, cashCents: cash, holdingsCents, totalCents, gainCents })
  }
  return points
}

async function buildSeries(
  provider: PriceProvider,
  config: GameConfig,
  trades: Trade[],
): Promise<PortfolioSeries> {
  const now = Date.now()
  const startDate = Math.min(config.startDate, now)
  const orderedTrades = [...trades].sort((a, b) => a.executedAt - b.executedAt)
  const symbols = [...new Set(orderedTrades.map((trade) => trade.symbol))]
  const barsBySymbol = await loadBarsBySymbol(provider, symbols, startDate, now)
  const days = collectDays(startDate, now, orderedTrades, barsBySymbol)
  const points = buildPoints(days, orderedTrades, barsBySymbol, config.startingCashCents)
  const last = points.at(-1)
  const totalReturnPct = computeReturn(last, config.startingCashCents)
  return {
    startingCashCents: config.startingCashCents,
    startDate: days[0] ?? startDate,
    endDate: last?.time ?? now,
    totalReturnPct: round2(totalReturnPct),
    points,
    totalGainCents: last?.gainCents ?? 0,
  }
}

function computeReturn(last: PortfolioSeries['points'][number] | undefined, startingCash: number): number {
  if (last === undefined || startingCash <= 0) return 0
  return ((last.totalCents - startingCash) / startingCash) * 100
}

export function createPortfolio(provider: PriceProvider): PortfolioService {
  return { getSeries: (config, trades) => buildSeries(provider, config, trades) }
}

let portfolio: PortfolioService | undefined

export function getPortfolio(): PortfolioService {
  if (portfolio === undefined) portfolio = createPortfolio(getProvider())
  return portfolio
}

export async function getSeries(): Promise<PortfolioSeries> {
  return getPortfolio().getSeries(getConfig(), listTrades())
}

function dayOf(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
