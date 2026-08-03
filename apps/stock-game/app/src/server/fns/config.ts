import { createServerFn } from '@tanstack/react-start'
import {
  updateConfigRequestSchema,
  type GameConfig,
  type UpdateConfigRequest,
} from '@stock-game/shared'
import { ensureSchedulerStarted } from '../services/scheduler'
import { getConfig, updateConfig } from '../services/trading'

export const getConfigFn = createServerFn({ method: 'GET' }).handler(async (): Promise<GameConfig> => {
  ensureSchedulerStarted()
  return getConfig()
})

export const updateConfigFn = createServerFn({ method: 'POST' })
  .validator((data: unknown): UpdateConfigRequest =>
    updateConfigRequestSchema.parse(data),
  )
  .handler(async ({ data }): Promise<GameConfig> => {
    return updateConfig(data)
  })
