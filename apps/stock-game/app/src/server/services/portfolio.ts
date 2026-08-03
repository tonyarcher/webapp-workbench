import type { GameConfig, PortfolioSeries, Trade } from '@stock-game/shared'
import type { PriceProvider } from '../providers/types'
import { getProvider } from './marketData'
import { getConfig, listTrades } from './trading'

const DAY_MS = 24 * 60 * 60 * 1000

export interface PortfolioService {
  getSeries(config: GameConfig, trades: Trade[]): Promise<PortfolioSeries>
}

export function createPortfolio(provider: PriceProvider): PortfolioService {
  return {
    async getSeries(config, trades): Promise<PortfolioSeries> {
      const now = Date.now()
      const startDate = Math.min(config.startDate, now)
      const orderedTrades = [...trades].sort((a, b) => a.executedAt - b.executedAt)

      const symbols = [...new Set(orderedTrades.map((trade) => trade.symbol))]
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

      const daySet = new Set<number>([dayOf(startDate), dayOf(now)])
      for (const trade of orderedTrades) daySet.add(dayOf(trade.executedAt))
      for (const bars of barsBySymbol.values()) {
        for (const bar of bars) daySet.add(dayOf(bar.time))
      }
      const days = [...daySet].sort((a, b) => a - b)

      const points: PortfolioSeries['points'] = []
      const positions = new Map<
        string,
        { qty: number; barIndex: number; lastClose: number }
      >()
      let cash = config.startingCashCents
      let tradeIndex = 0

      for (const day of days) {
        const endOfDay = day + DAY_MS - 1
        while (tradeIndex < orderedTrades.length) {
          const trade = orderedTrades[tradeIndex]
          if (trade === undefined || trade.executedAt > endOfDay) break
          cash += trade.cashDeltaCents
          const position = positions.get(trade.symbol) ?? { qty: 0, barIndex: 0, lastClose: 0 }
          position.qty += trade.side === 'buy' ? trade.qty : -trade.qty
          positions.set(trade.symbol, position)
          tradeIndex++
        }

        let holdingsCents = 0
        for (const [symbol, position] of positions) {
          if (position.qty <= 0) continue
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

        points.push({
          time: day,
          cashCents: cash,
          holdingsCents,
          totalCents: cash + holdingsCents,
        })
      }

      const last = points.at(-1)
      const totalReturnPct =
        last !== undefined && config.startingCashCents > 0
          ? ((last.totalCents - config.startingCashCents) / config.startingCashCents) * 100
          : 0

      return {
        startingCashCents: config.startingCashCents,
        startDate: days[0] ?? startDate,
        endDate: last?.time ?? now,
        totalReturnPct: round2(totalReturnPct),
        points,
      }
    },
  }
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
