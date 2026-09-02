import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { placeOrderRequestSchema, type Order } from '@stock-game/shared'
import { ensureSchedulerStarted } from '../services/scheduler'
import {
  cancelOrder,
  executeDueOrders,
  listOrders,
  placeOrder,
} from '../services/trading'

const cancelOrderRequestSchema = z.object({
  id: z.number().int(),
})

export const placeOrderFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => placeOrderRequestSchema.parse(data))
  .handler(async ({ data }): Promise<Order> => {
    ensureSchedulerStarted()
    return placeOrder(data)
  })

export const listOrdersFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Order[]> => {
  ensureSchedulerStarted()
  await executeDueOrders()
  return listOrders()
})

export const cancelOrderFn = createServerFn({ method: 'POST' })
  .validator((data: unknown) => cancelOrderRequestSchema.parse(data))
  .handler(async ({ data }): Promise<void> => {
    cancelOrder(data.id)
  })
