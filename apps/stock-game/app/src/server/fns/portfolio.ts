import { createServerFn } from '@tanstack/react-start'
import type { HoldingsEntry, PortfolioSeries } from '@stock-game/shared'
import { ensureSchedulerStarted } from '../services/scheduler'
import { getSeries } from '../services/portfolio'
import { cashNowCents, getHoldings } from '../services/trading'

export const getPortfolioSeriesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PortfolioSeries> => {
    ensureSchedulerStarted()
    return getSeries()
  },
)

export const getHoldingsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HoldingsEntry[]> => {
    ensureSchedulerStarted()
    return getHoldings()
  },
)

export const getCashFn = createServerFn({ method: 'GET' }).handler(async (): Promise<number> => {
  ensureSchedulerStarted()
  return cashNowCents()
})
