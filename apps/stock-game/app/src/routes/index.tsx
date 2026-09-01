import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getConfigFn } from '../server/fns/config'
import { getHoldingsFn, getPortfolioSeriesFn } from '../server/fns/portfolio'
import { fmtMoney, fmtPct } from '../lib/format'
import '../components/sg-portfolio-chart'
import '../components/sg-holdings-table'
import type { GameConfig, PortfolioSeries } from '@stock-game/shared'

export const Route = createFileRoute('/')({ component: Dashboard })

function DashboardError({ error }: { error: unknown }): React.JSX.Element {
  return <div className="card"><div className="error">{String(error)}</div></div>
}

function DashboardLoading(): React.JSX.Element {
  return <div className="card"><p className="muted">Loading…</p></div>
}

function StatCard({ label, value, extraClass }: { label: string; value: string; extraClass?: string }): React.JSX.Element {
  return <div className="card stat"><div className="label">{label}</div><div className={`value ${extraClass ?? ''}`}>{value}</div></div>
}

function StatsRow({ totalCents, cashCents, holdingsCents, totalReturnPct }: { totalCents: number; cashCents: number; holdingsCents: number; totalReturnPct: number }): React.JSX.Element {
  const cls = totalReturnPct >= 0 ? 'positive' : 'negative'
  return <div className="row"><StatCard label="Total value" value={fmtMoney(totalCents)} /><StatCard label="Cash" value={fmtMoney(cashCents)} /><StatCard label="Holdings" value={fmtMoney(holdingsCents)} /><StatCard label="Total return" value={fmtPct(totalReturnPct)} extraClass={cls} /></div>
}

function toPoints(series: PortfolioSeries) {
  return series.points.map((point) => ({ time: point.time, value: point.totalCents / 100 }))
}

function DashboardContent({ config, series, holdings }: { config: GameConfig; series: PortfolioSeries; holdings: unknown }): React.JSX.Element {
  const last = series.points.at(-1)
  const totalCents = last?.totalCents ?? config.startingCashCents
  const cash = last?.cashCents ?? config.startingCashCents
  const holdingsCents = last?.holdingsCents ?? 0
  const points = toPoints(series)
  return <><h1>Dashboard</h1><StatsRow totalCents={totalCents} cashCents={cash} holdingsCents={holdingsCents} totalReturnPct={series.totalReturnPct} /><div className="card"><h2>Portfolio value over time</h2><sg-portfolio-chart points={points} /></div><div className="card"><h2>Holdings</h2><sg-holdings-table holdings={holdings as never} /></div></>
}

function hasError(a: { isError: boolean }, b: { isError: boolean }, c: { isError: boolean }): boolean {
  return a.isError || b.isError || c.isError
}

function isLoading(a: { isPending: boolean }, b: { isPending: boolean }, cfg: unknown, ser: unknown): boolean {
  return a.isPending || b.isPending || cfg === undefined || ser === undefined
}

function Dashboard(): React.JSX.Element {
  const configQ = useQuery({ queryKey: ['config'], queryFn: () => getConfigFn() })
  const seriesQ = useQuery({ queryKey: ['portfolio', 'series'], queryFn: () => getPortfolioSeriesFn() })
  const holdingsQ = useQuery({ queryKey: ['holdings'], queryFn: () => getHoldingsFn() })
  if (hasError(seriesQ, configQ, holdingsQ)) return <DashboardError error={seriesQ.error ?? configQ.error ?? holdingsQ.error} />
  if (isLoading(seriesQ, configQ, configQ.data, seriesQ.data)) return <DashboardLoading />
  return <DashboardContent config={configQ.data as GameConfig} series={seriesQ.data as PortfolioSeries} holdings={holdingsQ.data ?? []} />
}
