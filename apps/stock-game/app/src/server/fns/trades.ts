import { createServerFn } from '@tanstack/react-start'
import { placeTradeRequestSchema, type Trade } from '@stock-game/shared'
import { ensureSchedulerStarted } from '../services/scheduler'
import { listTrades, placeBackdatedTrade } from '../services/trading'

export const placeTradeFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => placeTradeRequestSchema.parse(data))
  .handler(async ({ data }): Promise<Trade> => {
    return placeBackdatedTrade(data)
  })

export const listTradesFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Trade[]> => {
  ensureSchedulerStarted()
  return listTrades()
})
