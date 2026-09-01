import { describe, expect, it } from 'vitest'
import { asapExecuteAt } from './trading-delay'
import { isNyseOpen, nextNyseOpen } from './trading-hours'

function wallHourMinute(ms: number): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(ms))
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? '0'),
    weekday: map[wd] ?? 1,
  }
}

describe('asapExecuteAt', () => {
  it('open session plus 15 minutes stays in session', () => {
    const now = Date.parse('2024-01-03T15:00:00Z')
    const at = asapExecuteAt(now, 15)
    expect(at).toBe(now + 15 * 60_000)
    expect(isNyseOpen(at)).toBe(true)
  })

  it('after close plus delay jumps to next weekday 09:30 ET', () => {
    const now = Date.parse('2024-01-03T21:30:00Z')
    const at = asapExecuteAt(now, 15)
    const wall = wallHourMinute(at)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(4)
    expect(at).toBe(nextNyseOpen(now + 15 * 60_000))
  })

  it('weekend plus delay is Monday 09:30 ET', () => {
    const now = Date.parse('2024-01-06T18:00:00Z')
    const at = asapExecuteAt(now, 15)
    const wall = wallHourMinute(at)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(1)
  })

  it('zero delay during open equals now', () => {
    const now = Date.parse('2024-01-03T15:00:00Z')
    expect(asapExecuteAt(now, 0)).toBe(now)
  })
})
