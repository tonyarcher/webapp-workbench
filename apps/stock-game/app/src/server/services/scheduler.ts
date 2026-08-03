import { executeDueOrders } from './trading'

let started = false

export function ensureSchedulerStarted(): void {
  if (started) return
  started = true
  const tick = (): void => {
    executeDueOrders().catch(() => {})
  }
  setTimeout(tick, 5_000)
  setInterval(tick, 30_000)
}
