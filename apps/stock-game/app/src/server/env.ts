import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadDotEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url))
  const appDir = resolve(here, '..', '..', '..')
  const rootDir = resolve(appDir, '..')
  for (const dir of [appDir, rootDir]) {
    const file = join(dir, '.env')
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
      const key = match?.[1]
      const value = match?.[2] ?? ''
      if (key && process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  }
}

loadDotEnvFiles()

export interface ServerEnv {
  dbPath: string
  provider: string
  twelveDataApiKey: string | undefined
  alphaVantageApiKey: string | undefined
  quoteTtlMs: number
}

export function getEnv(): ServerEnv {
  const dbPath =
    process.env.STOCK_GAME_DB ?? resolve(process.cwd(), 'data', 'stock-game.db')
  return {
    dbPath,
    provider: process.env.PRICE_PROVIDER ?? 'yahoo',
    twelveDataApiKey: process.env.TWELVEDATA_API_KEY,
    alphaVantageApiKey: process.env.ALPHAVANTAGE_API_KEY,
    quoteTtlMs: Number(process.env.QUOTE_TTL_MS ?? 15 * 60 * 1000),
  }
}
