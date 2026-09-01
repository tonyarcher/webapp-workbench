import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { openRepo } from './db'

const LEGACY_SQL = `
  CREATE TABLE trades (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, side TEXT NOT NULL CHECK (side IN ('buy', 'sell')), qty INTEGER NOT NULL, price REAL NOT NULL, cash_delta_cents INTEGER NOT NULL, mode TEXT NOT NULL, executed_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, side TEXT NOT NULL CHECK (side IN ('buy', 'sell')), qty INTEGER NOT NULL, execute_at INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, trade_id INTEGER UNIQUE REFERENCES trades(id));
`

function seedLegacyFilled(path: string): void {
  const db = new DatabaseSync(path)
  db.exec(LEGACY_SQL)
  db.exec(`INSERT INTO trades VALUES (1,'AAPL','buy',1,100,-10000,'backdated',1,1)`)
  db.exec(`INSERT INTO orders VALUES (1,'AAPL','buy',1,1,'filled',1,1)`)
  db.close()
}

describe('openRepo migration', () => {
  it('upgrades a legacy database that already has a filled order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sg-mig-'))
    const path = join(dir, 'game.db')
    seedLegacyFilled(path)
    const repo = openRepo(path)
    expect(repo.listTrades()).toHaveLength(1)
    expect(repo.listOrders()[0]?.status).toBe('filled')
  })
})
