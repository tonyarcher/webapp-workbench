import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCustomEvents } from '../lib/useCustomEvents'
import { getHoldingsFn } from '../server/fns/portfolio'
import { listTradesFn } from '../server/fns/trades'
import '../components/sg-holdings-table'
import '../components/sg-trades-table'

export const Route = createFileRoute('/portfolio')({
  component: Portfolio,
})

function Portfolio() {
  const navigate = useNavigate()
  const holdingsQ = useQuery({ queryKey: ['holdings'], queryFn: () => getHoldingsFn() })
  const tradesQ = useQuery({ queryKey: ['trades'], queryFn: () => listTradesFn() })

  const ref = useCustomEvents({
    'sg-trade-symbol': (detail) => {
      const symbol = (detail as { symbol: string }).symbol
      void navigate({ to: '/trade', search: { symbol } })
    },
  })

  return (
    <>
      <h1>Portfolio</h1>
      <div className="card">
        <h2>Holdings</h2>
        <p className="muted">Click a row to trade that symbol.</p>
        <sg-holdings-table ref={ref} holdings={holdingsQ.data ?? []} />
      </div>
      <div className="card">
        <h2>Trade history</h2>
        <sg-trades-table trades={tradesQ.data ?? []} />
      </div>
    </>
  )
}
