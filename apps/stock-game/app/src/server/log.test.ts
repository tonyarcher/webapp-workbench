import { describe, expect, it } from 'vitest'
import { formatErr, formatLog } from './log'

describe('log', () => {
  it('emits json with service and extra keys', () => {
    const prev = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'info'
    const line = formatLog('stock-game', { level: 'info', msg: 'listening', port: 3000 })
    expect(line).toBeTruthy()
    const parsed = JSON.parse(line!) as { service: string; msg: string; port: number }
    expect(parsed.service).toBe('stock-game')
    expect(parsed.msg).toBe('listening')
    expect(parsed.port).toBe(3000)
    if (prev === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = prev
  })

  it('drops debug when LOG_LEVEL is error', () => {
    const prev = process.env.LOG_LEVEL
    process.env.LOG_LEVEL = 'error'
    expect(formatLog('stock-game', { level: 'debug', msg: 'quiet' })).toBeNull()
    if (prev === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = prev
  })

  it('formats errors', () => {
    expect(formatErr(new TypeError('boom'))).toEqual({ type: 'TypeError', message: 'boom' })
  })
})
