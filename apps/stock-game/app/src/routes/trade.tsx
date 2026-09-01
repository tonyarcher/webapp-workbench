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

const tradeSearchSchema = z.object({ symbol: symbolSchema.optional() })
export const Route = createFileRoute('/trade')({ validateSearch: tradeSearchSchema, component: Trade })
type SubmitDetail = { mode: 'backdated'; data: PlaceTradeRequest } | { mode: 'scheduled'; data: PlaceOrderRequest }

function useTradeQueries(query: string, symbol: string | undefined) {
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => getConfigFn() })
  const holdingsQ = useQuery({ queryKey: ['holdings'], queryFn: () => getHoldingsFn() })
  const tradesQ = useQuery({ queryKey: ['trades'], queryFn: () => listTradesFn() })
  const searchQ = useQuery({ queryKey: ['search', query], queryFn: () => searchSymbolsFn({ data: query }), enabled: query.trim().length > 0 })
  const quoteQ = useQuery({ queryKey: ['quote', symbol], queryFn: () => { if (symbol === undefined) throw new Error('No symbol selected'); return getQuoteFn({ data: symbol }) }, enabled: symbol !== undefined })
  return { configQ, holdingsQ, tradesQ, searchQ, quoteQ }
}

function useTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (detail: SubmitDetail): Promise<unknown> => { if (detail.mode === 'backdated') return placeTradeFn({ data: detail.data }); return placeOrderFn({ data: detail.data }) },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['trades'] }); void queryClient.invalidateQueries({ queryKey: ['orders'] }); void queryClient.invalidateQueries({ queryKey: ['holdings'] }); void queryClient.invalidateQueries({ queryKey: ['portfolio'] }) },
  })
}

function MutationStatus({ mutation }: { mutation: ReturnType<typeof useTradeMutation> }): React.JSX.Element {
  if (mutation.isError) return <div className="error">{String(mutation.error)}</div>
  if (mutation.isSuccess) return <div className="positive">Order placed.</div>
  return <></>
}

function TradeFormCard({ refCb, symbol, query, searchQ, quoteQ, configQ, holdingsQ, mutation }: { refCb: ReturnType<typeof useCustomEvents>; symbol: string | undefined; query: string; searchQ: ReturnType<typeof useTradeQueries>['searchQ']; quoteQ: ReturnType<typeof useTradeQueries>['quoteQ']; configQ: ReturnType<typeof useTradeQueries>['configQ']; holdingsQ: ReturnType<typeof useTradeQueries>['holdingsQ']; mutation: ReturnType<typeof useTradeMutation> }): React.JSX.Element {
  return <div className="card"><sg-trade-form ref={refCb} symbol={symbol ?? ''} results={searchQ.data ?? []} query={query} searching={searchQ.isFetching} searchError={searchQ.isError ? String(searchQ.error) : null} quote={quoteQ.data ?? null} quoteLoading={quoteQ.isFetching} quoteError={quoteQ.isError ? String(quoteQ.error) : null} cashCents={configQ.data?.startingCashCents ?? 0} holdings={holdingsQ.data ?? []} busy={mutation.isPending} /><MutationStatus mutation={mutation} /></div>
}

function TradesCard({ tradesQ }: { tradesQ: ReturnType<typeof useTradeQueries>['tradesQ'] }): React.JSX.Element {
  return <div className="card"><h2>Recent trades</h2>{tradesQ.isError ? <div className="error">Failed to load trades: {String(tradesQ.error)}</div> : <sg-trades-table trades={tradesQ.data ?? []} />}</div>
}

function Trade(): React.JSX.Element {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [symbol, setSymbol] = useState<string | undefined>(search.symbol)
  const qs = useTradeQueries(query, symbol)
  const mutation = useTradeMutation()
  const ref = useCustomEvents({ 'sg-symbol-search-input': (detail) => setQuery((detail as { query: string }).query), 'sg-symbol-select': (detail) => { const r = detail as SymbolSearchResult; setSymbol(r.symbol); void navigate({ to: '/trade', search: { symbol: r.symbol } }) }, 'sg-trade-submit': (detail) => mutation.mutate(detail as SubmitDetail) })
  return <><h1>Trade</h1><TradeFormCard refCb={ref} symbol={search.symbol} query={query} searchQ={qs.searchQ} quoteQ={qs.quoteQ} configQ={qs.configQ} holdingsQ={qs.holdingsQ} mutation={mutation} /><TradesCard tradesQ={qs.tradesQ} /></>
}
