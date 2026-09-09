export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw
  return 'info'
}

export function formatErr(err: unknown): { type: string; message: string } {
  if (err instanceof Error) return { type: err.name, message: err.message }
  return { type: 'Error', message: String(err) }
}

export function formatLog(
  service: string,
  rec: { level: LogLevel; msg: string } & Record<string, unknown>,
): string | null {
  if (RANK[rec.level] < RANK[minLevel()]) return null
  const { level, msg, ...rest } = rec
  const line: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    service,
  }
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) line[key] = value
  }
  return JSON.stringify(line)
}

export function log(
  service: string,
  rec: { level: LogLevel; msg: string } & Record<string, unknown>,
): void {
  const line = formatLog(service, rec)
  if (!line) return
  const sink = rec.level === 'warn' || rec.level === 'error' ? console.error : console.log
  sink(line)
}
