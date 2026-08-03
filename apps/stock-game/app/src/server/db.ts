import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  Bar,
  GameConfig,
  Order,
  OrderStatus,
  Side,
  Trade,
  TradeMode,
} from '@stock-game/shared'
import { gameConfigSchema } from '@stock-game/shared'
import { getEnv } from './env'

export type Db = DatabaseSync

export interface Repo {
  getConfig(): GameConfig | null
  saveConfig(config: GameConfig): void
  getBars(symbol: string, interval: string, from: number, to: number): Bar[]
  upsertBars(symbol: string, interval: string, bars: Bar[]): void
  listTrades(): Trade[]
  insertTrade(trade: {
    symbol: string
    side: Side
    qty: number
    price: number
    cashDeltaCents: number
    mode: TradeMode
    executedAt: number
    createdAt: number
  }): Trade
  listOrders(): Order[]
  insertOrder(order: {
    symbol: string
    side: Side
    qty: number
    executeAt: number
    createdAt: number
  }): Order
  getPendingOrders(now: number): Order[]
  fillOrderWithTrade(
    orderId: number,
    trade: {
      symbol: string
      side: Side
      qty: number
      price: number
      cashDeltaCents: number
      mode: TradeMode
      executedAt: number
      createdAt: number
    },
  ): Trade | null
  cancelOrder(orderId: number): void
}

interface ConfigRow {
  key: string
  value: string
}

interface TradeRow {
  id: number
  symbol: string
  side: Side
  qty: number
  price: number
  cash_delta_cents: number
  mode: TradeMode
  executed_at: number
  created_at: number
}

interface OrderRow {
  id: number
  symbol: string
  side: Side
  qty: number
  execute_at: number
  status: OrderStatus
  created_at: number
  trade_id: number | null
}

interface BarRow {
  symbol: string
  interval: string
  date: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function toTrade(row: TradeRow): Trade {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    qty: row.qty,
    price: row.price,
    cashDeltaCents: row.cash_delta_cents,
    mode: row.mode,
    executedAt: row.executed_at,
    createdAt: row.created_at,
  }
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    qty: row.qty,
    executeAt: row.execute_at,
    status: row.status,
    createdAt: row.created_at,
    tradeId: row.trade_id,
  }
}

export function openRepo(path = getEnv().dbPath): Repo {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  migrate(db)

  const insertTradeStmt = db.prepare(`
    INSERT INTO trades (symbol, side, qty, price, cash_delta_cents, mode, executed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (symbol, side, qty, execute_at, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `)
  const upsertBarStmt = db.prepare(`
    INSERT OR REPLACE INTO price_cache (symbol, interval, date, open, high, low, close, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const getBarsStmt = db.prepare(`
    SELECT date, open, high, low, close, volume
    FROM price_cache
    WHERE symbol = ? AND interval = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `)
  const setOrderFilledStmt = db.prepare(
    `UPDATE orders SET status = 'filled', trade_id = ? WHERE id = ? AND status = 'pending'`,
  )
  const cancelOrderStmt = db.prepare(
    `UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`,
  )
  const getOrderStatusStmt = db.prepare(`SELECT status FROM orders WHERE id = ?`)

  return {
    getConfig(): GameConfig | null {
      const row = db
        .prepare(`SELECT value FROM game_config WHERE key = 'game'`)
        .get() as ConfigRow | undefined
      if (!row) return null
      const parsed = gameConfigSchema.safeParse(JSON.parse(row.value) as unknown)
      return parsed.success ? parsed.data : null
    },

    saveConfig(config: GameConfig): void {
      db.prepare(`INSERT OR REPLACE INTO game_config (key, value) VALUES ('game', ?)`).run(
        JSON.stringify(config),
      )
    },

    getBars(symbol, interval, from, to) {
      const rows = getBarsStmt.all(symbol, interval, from - DAY_MS, to + DAY_MS) as Array<
        Pick<BarRow, 'date' | 'open' | 'high' | 'low' | 'close' | 'volume'>
      >
      return rows
        .filter((row) => row.date >= from && row.date <= to)
        .map((row) => ({
          time: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
        }))
    },

    upsertBars(symbol, interval, bars) {
      db.exec('BEGIN IMMEDIATE')
      try {
        for (const bar of bars) {
          upsertBarStmt.run(
            symbol,
            interval,
            bar.time,
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
          )
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },

    listTrades() {
      const rows = db
        .prepare(`SELECT * FROM trades ORDER BY executed_at ASC, id ASC`)
        .all() as unknown as TradeRow[]
      return rows.map(toTrade)
    },

    insertTrade(trade) {
      const result = insertTradeStmt.run(
        trade.symbol,
        trade.side,
        trade.qty,
        trade.price,
        trade.cashDeltaCents,
        trade.mode,
        trade.executedAt,
        trade.createdAt,
      )
      const id = Number(result.lastInsertRowid)
      return toTrade({
        id,
        symbol: trade.symbol,
        side: trade.side,
        qty: trade.qty,
        price: trade.price,
        cash_delta_cents: trade.cashDeltaCents,
        mode: trade.mode,
        executed_at: trade.executedAt,
        created_at: trade.createdAt,
      })
    },

    listOrders() {
      const rows = db
        .prepare(`SELECT * FROM orders ORDER BY execute_at ASC, id ASC`)
        .all() as unknown as OrderRow[]
      return rows.map(toOrder)
    },

    insertOrder(order) {
      const result = insertOrderStmt.run(
        order.symbol,
        order.side,
        order.qty,
        order.executeAt,
        order.createdAt,
      )
      const id = Number(result.lastInsertRowid)
      return toOrder({
        id,
        symbol: order.symbol,
        side: order.side,
        qty: order.qty,
        execute_at: order.executeAt,
        status: 'pending',
        created_at: order.createdAt,
        trade_id: null,
      })
    },

    getPendingOrders(now) {
      const rows = db
        .prepare(
          `SELECT * FROM orders WHERE status = 'pending' AND execute_at <= ? ORDER BY execute_at ASC`,
        )
        .all(now) as unknown as OrderRow[]
      return rows.map(toOrder)
    },

    fillOrderWithTrade(orderId, trade) {
      const before = getOrderStatusStmt.get(orderId) as { status: OrderStatus } | undefined
      if (before === undefined || before.status !== 'pending') return null
      db.exec('BEGIN IMMEDIATE')
      try {
        const current = getOrderStatusStmt.get(orderId) as { status: OrderStatus } | undefined
        if (current === undefined || current.status !== 'pending') {
          db.exec('ROLLBACK')
          return null
        }
        const result = insertTradeStmt.run(
          trade.symbol,
          trade.side,
          trade.qty,
          trade.price,
          trade.cashDeltaCents,
          trade.mode,
          trade.executedAt,
          trade.createdAt,
        )
        const tradeId = Number(result.lastInsertRowid)
        const update = setOrderFilledStmt.run(tradeId, orderId)
        if (update.changes === 0) {
          db.exec('ROLLBACK')
          return null
        }
        db.exec('COMMIT')
        return toTrade({
          id: tradeId,
          symbol: trade.symbol,
          side: trade.side,
          qty: trade.qty,
          price: trade.price,
          cash_delta_cents: trade.cashDeltaCents,
          mode: trade.mode,
          executed_at: trade.executedAt,
          created_at: trade.createdAt,
        })
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },

    cancelOrder(orderId) {
      cancelOrderStmt.run(orderId)
    },
  }
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_cache (
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      date INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume INTEGER NOT NULL,
      PRIMARY KEY (symbol, interval, date)
    );
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      qty INTEGER NOT NULL CHECK (qty > 0),
      price REAL NOT NULL,
      cash_delta_cents INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('backdated', 'scheduled')),
      executed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      qty INTEGER NOT NULL CHECK (qty > 0),
      execute_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'filled', 'cancelled')),
      created_at INTEGER NOT NULL,
      trade_id INTEGER UNIQUE REFERENCES trades(id)
    );
    CREATE INDEX IF NOT EXISTS idx_price_cache_lookup ON price_cache (symbol, interval);
    CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades (executed_at);
    CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders (status, execute_at);
  `)
}
