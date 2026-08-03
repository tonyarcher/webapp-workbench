import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  intervalSchema,
  symbolSchema,
  type Bar,
  type Interval,
  type Quote,
  type SymbolSearchResult,
} from '@stock-game/shared'
import { getBars, getQuote, searchSymbols } from '../services/marketData'

export const getQuoteFn = createServerFn({ method: 'GET' })
  .validator((data: unknown): string => symbolSchema.parse(data))
  .handler(async ({ data }): Promise<Quote> => {
    return getQuote(data)
  })

const barsRequestSchema = z.object({
  symbol: symbolSchema,
  interval: intervalSchema,
  from: z.number().int(),
  to: z.number().int(),
})

export const getBarsFn = createServerFn({ method: 'GET' })
  .validator((data: unknown) => barsRequestSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<Bar[]> => {
      const input: { symbol: string; interval: Interval; from: number; to: number } = data
      return getBars(input.symbol, input.interval, input.from, input.to)
    },
  )

export const searchSymbolsFn = createServerFn({ method: 'GET' })
  .validator((data: unknown): string => symbolSchema.parse(data))
  .handler(async ({ data }): Promise<SymbolSearchResult[]> => {
    return searchSymbols(data)
  })
