import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { symbolSchema } from '@stock-game/shared'
import type { PlaceOrderRequest, PlaceTradeRequest, SymbolSearchResult } from '@stock-game/shared'
import { useCustomEvents } from '../lib/useCustomEvents'
import { getQuoteFn, searchSymbolsFn } from '../server/fns/marketData'
import { listTradesFn, placeTradeFn } from '../server/fns/trades'
import { placeOrderFn } from '../server/fns/orders'
import { getConfigFn } from '../server/fns/config'
import { getHoldingsFn } from '../server/fns/portfolio'
import '../components/sg-trade-form'
import '../components/sg-trades-table'

const tradeSearchSchema = z.object({
  symbol: symbolSchema.optional(),
})

export const Route = createFileRoute('/trade')({
  validateSearch: tradeSearchSchema,
  component: Trade,
})

type SubmitDetail =
  | { mode: 'backdated'; data: PlaceTradeRequest }
  | { mode: 'scheduled'; data: PlaceOrderRequest }

function Trade() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState<string | undefined>(search.symbol)

  const configQ = useQuery({ queryKey: ['config'], queryFn: () => getConfigFn() })
  const holdingsQ = useQuery({ queryKey: ['holdings'], queryFn: () => getHoldingsFn() })
  const tradesQ = useQuery({ queryKey: ['trades'], queryFn: () => listTradesFn() })
  const searchQ = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchSymbolsFn({ data: query }),
    enabled: query.trim().length > 0,
  })
  const quoteQ = useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => {
      if (symbol === undefined) throw new Error('No symbol selected')
      return getQuoteFn({ data: symbol })
    },
    enabled: symbol !== undefined,
  })

  const mutation = useMutation({
    mutationFn: async (detail: SubmitDetail): Promise<unknown> => {
      if (detail.mode === 'backdated') return placeTradeFn({ data: detail.data })
      return placeOrderFn({ data: detail.data })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trades'] })
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['holdings'] })
      void queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })

  const ref = useCustomEvents({
    'sg-symbol-search-input': (detail) => {
      setQuery((detail as { query: string }).query)
    },
    'sg-symbol-select': (detail) => {
      const result = detail as SymbolSearchResult
      setSymbol(result.symbol)
      void navigate({ to: '/trade', search: { symbol: result.symbol } })
    },
    'sg-trade-submit': (detail) => {
      mutation.mutate(detail as SubmitDetail)
    },
  })

  return (
    <>
      <h1>Trade</h1>
      <div className="card">
        <sg-trade-form
          ref={ref}
          symbol={search.symbol ?? ''}
          results={searchQ.data ?? []}
          quote={quoteQ.data ?? null}
          cashCents={configQ.data?.startingCashCents ?? 0}
          holdings={holdingsQ.data ?? []}
          busy={mutation.isPending}
        />
        {mutation.isError ? <div className="error">{String(mutation.error)}</div> : ''}
        {mutation.isSuccess ? <div className="positive">Order placed.</div> : ''}
      </div>
      <div className="card">
        <h2>Recent trades</h2>
        <sg-trades-table trades={tradesQ.data ?? []} />
      </div>
    </>
  )
}
