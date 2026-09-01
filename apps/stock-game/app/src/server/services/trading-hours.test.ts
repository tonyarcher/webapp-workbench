import { describe, expect, it } from 'vitest'
import { isNyseOpen, nextNyseOpen } from './trading-hours'

function wallParts(ms: number): { hour: number; minute: number; weekday: number } {
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

describe('nextNyseOpen', () => {
  it('open time returns now', () => {
    const now = Date.parse('2024-01-03T15:00:00Z')
    expect(nextNyseOpen(now)).toBe(now)
  })

  it('pre-open returns same day 09:30 ET', () => {
    const now = Date.parse('2024-01-03T13:00:00Z')
    const next = nextNyseOpen(now)
    const wall = wallParts(next)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(3)
    expect(next).not.toBe(now)
    expect(next).toBeGreaterThan(now)
  })

  it('after close returns next day 09:30 ET', () => {
    const now = Date.parse('2024-01-03T21:30:00Z')
    const next = nextNyseOpen(now)
    const wall = wallParts(next)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(4)
  })

  it('Friday after close returns Monday 09:30 ET', () => {
    const now = Date.parse('2024-01-05T21:30:00Z')
    const next = nextNyseOpen(now)
    const wall = wallParts(next)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(1)
    const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date(next))
    const y = date.find((p) => p.type === 'year')?.value
    const m = date.find((p) => p.type === 'month')?.value
    const d = date.find((p) => p.type === 'day')?.value
    expect(`${y}-${m}-${d}`).toBe('2024-1-8')
  })

  it('Saturday returns Monday 09:30 ET', () => {
    const now = Date.parse('2024-01-06T18:00:00Z')
    const next = nextNyseOpen(now)
    const wall = wallParts(next)
    expect(wall.hour).toBe(9)
    expect(wall.minute).toBe(30)
    expect(wall.weekday).toBe(1)
  })

  it('isNyseOpen true at 15:00Z Jan3 and false at 21:30 and Saturday', () => {
    expect(isNyseOpen(Date.parse('2024-01-03T15:00:00Z'))).toBe(true)
    expect(isNyseOpen(Date.parse('2024-01-03T21:30:00Z'))).toBe(false)
    expect(isNyseOpen(Date.parse('2024-01-06T18:00:00Z'))).toBe(false)
  })
})
