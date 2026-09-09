import { executeDueOrders } from './trading'
import { formatErr, log } from '../log'

let started = false

export function ensureSchedulerStarted(): void {
  if (started) return
  started = true
  const tick = (): void => {
    executeDueOrders().catch((err: unknown) => {
      log('stock-game', { level: 'error', msg: 'scheduler tick', err: formatErr(err) })
    })
  }
  setTimeout(tick, 5_000)
  setInterval(tick, 30_000)
}
