import { createServerFn } from '@tanstack/react-start'
import type { HoldingsEntry, PortfolioSeries } from '@stock-game/shared'
import { ensureSchedulerStarted } from '../services/scheduler'
import { getSeries } from '../services/portfolio'
import { getHoldings } from '../services/trading'

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
