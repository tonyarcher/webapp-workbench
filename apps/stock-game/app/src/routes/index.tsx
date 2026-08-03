import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getConfigFn } from '../server/fns/config'
import { getHoldingsFn, getPortfolioSeriesFn } from '../server/fns/portfolio'
import { fmtMoney, fmtPct } from '../lib/format'
import '../components/sg-portfolio-chart'
import '../components/sg-holdings-table'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => getConfigFn() })
  const seriesQ = useQuery({
    queryKey: ['portfolio', 'series'],
    queryFn: () => getPortfolioSeriesFn(),
  })
  const holdingsQ = useQuery({ queryKey: ['holdings'], queryFn: () => getHoldingsFn() })

  const config = configQ.data
  const series = seriesQ.data

  if (seriesQ.isError || configQ.isError || holdingsQ.isError) {
    const error = seriesQ.error ?? configQ.error ?? holdingsQ.error
    return (
      <div className="card">
        <div className="error">{String(error)}</div>
      </div>
    )
  }
  if (seriesQ.isPending || configQ.isPending || series === undefined || config === undefined) {
    return (
      <div className="card">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  const last = series.points.at(-1)
  const totalCents = last?.totalCents ?? config.startingCashCents
  const points = series.points.map((point) => ({
    time: point.time,
    value: point.totalCents / 100,
  }))

  return (
    <>
      <h1>Dashboard</h1>
      <div className="row">
        <div className="card stat">
          <div className="label">Total value</div>
          <div className="value">{fmtMoney(totalCents)}</div>
        </div>
        <div className="card stat">
          <div className="label">Cash</div>
          <div className="value">{fmtMoney(last?.cashCents ?? config.startingCashCents)}</div>
        </div>
        <div className="card stat">
          <div className="label">Holdings</div>
          <div className="value">{fmtMoney(last?.holdingsCents ?? 0)}</div>
        </div>
        <div className="card stat">
          <div className="label">Total return</div>
          <div className={`value ${series.totalReturnPct >= 0 ? 'positive' : 'negative'}`}>
            {fmtPct(series.totalReturnPct)}
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Portfolio value over time</h2>
        <sg-portfolio-chart points={points} />
      </div>
      <div className="card">
        <h2>Holdings</h2>
        <sg-holdings-table holdings={holdingsQ.data ?? []} />
      </div>
    </>
  )
}
