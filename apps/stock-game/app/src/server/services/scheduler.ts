import { executeDueOrders } from './trading'

let started = false

export function ensureSchedulerStarted(): void {
  if (started) return
  started = true
  const tick = (): void => {
    executeDueOrders().catch((err: unknown) => {
      console.error('stock-game scheduler tick failed', err)
    })
  }
  setTimeout(tick, 5_000)
  setInterval(tick, 30_000)
}
