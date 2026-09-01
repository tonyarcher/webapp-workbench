import { nextNyseOpen } from './trading-hours'

export function asapExecuteAt(now: number, delayMinutes: number): number {
  return nextNyseOpen(now + delayMinutes * 60_000)
}
