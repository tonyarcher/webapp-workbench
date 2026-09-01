export function isNyseOpen(now: number): boolean {
  const ny = getNyWall(now)
  if (ny.weekday === 0 || ny.weekday === 6) return false
  const minutes = ny.hour * 60 + ny.minute
  return minutes >= 570 && minutes < 960
}

export function expiresAtForOrder(executeAt: number): number {
  const ymd = getNyDateParts(executeAt)
  return nyWallToUtc(ymd.year, ymd.month, ymd.day, 16, 0)
}

function getNyWall(now: number): { weekday: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(now))
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '0'
  return { weekday: weekdayToNum(wd), hour: Number(h), minute: Number(m) }
}

function weekdayToNum(day: string): number {
  if (day === 'Sun') return 0
  if (day === 'Mon') return 1
  if (day === 'Tue') return 2
  if (day === 'Wed') return 3
  if (day === 'Thu') return 4
  if (day === 'Fri') return 5
  return 6
}

function getNyDateParts(ms: number): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = fmt.formatToParts(new Date(ms))
  const y = Number(getPart(parts, 'year') ?? '1970')
  const mo = Number(getPart(parts, 'month') ?? '1')
  const d = Number(getPart(parts, 'day') ?? '1')
  return { year: y, month: mo, day: d }
}

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string | undefined {
  return parts.find((p) => p.type === type)?.value
}

function nyWallToUtc(year: number, month: number, day: number, hour: number, minute: number): number {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  for (let i = 0; i < 3; i++) {
    const wall = getNyWallForUtc(guess)
    const diffMinutes = (wall.hour - hour) * 60 + (wall.minute - minute) + (wall.day - day) * 1440
    if (diffMinutes === 0 && wall.year === year && wall.month === month) break
    guess -= diffMinutes * 60 * 1000
  }
  return guess
}

function getNyWallForUtc(ms: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(ms))
  return {
    year: Number(getPart(parts, 'year') ?? '1970'),
    month: Number(getPart(parts, 'month') ?? '1'),
    day: Number(getPart(parts, 'day') ?? '1'),
    hour: Number(getPart(parts, 'hour') ?? '0'),
    minute: Number(getPart(parts, 'minute') ?? '0'),
  }
}
