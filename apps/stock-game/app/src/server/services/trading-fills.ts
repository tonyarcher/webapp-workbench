import type { Bar, FillPriceSource, OrderType, Quote, Side } from '@stock-game/shared'

export function fillPriceForBar(
  bar: Bar,
  side: Side,
  orderType: OrderType,
  limitPrice?: number | null,
  stopPrice?: number | null,
): number | null {
  if (orderType === 'market') return bar.close
  if (orderType === 'limit') return fillLimit(bar, side, limitPrice)
  if (orderType === 'stop') return fillStop(bar, side, stopPrice)
  return fillStopLimit(bar, side, limitPrice, stopPrice)
}

function fillLimit(bar: Bar, side: Side, limit: number | null | undefined): number | null {
  if (limit === undefined || limit === null) return null
  if (side === 'buy' || side === 'cover') {
    if (bar.low <= limit) return Math.min(bar.close, limit)
    return null
  }
  if (bar.high >= limit) return Math.max(bar.close, limit)
  return null
}

function fillStop(bar: Bar, side: Side, stop: number | null | undefined): number | null {
  if (stop === undefined || stop === null) return null
  if (side === 'sell' || side === 'short') {
    if (bar.low <= stop) return bar.close
    return null
  }
  if (bar.high >= stop) return bar.close
  return null
}

function fillStopLimit(
  bar: Bar,
  side: Side,
  limit: number | null | undefined,
  stop: number | null | undefined,
): number | null {
  if (limit === undefined || limit === null || stop === undefined || stop === null) return null
  if (side === 'sell' || side === 'short') return fillStopLimitSell(bar, limit, stop)
  return fillStopLimitBuy(bar, limit, stop)
}

function fillStopLimitSell(bar: Bar, limit: number, stop: number): number | null {
  if (bar.low <= stop && bar.high >= limit) return Math.max(bar.close, limit)
  return null
}

function fillStopLimitBuy(bar: Bar, limit: number, stop: number): number | null {
  if (bar.high >= stop && bar.low <= limit) return Math.min(bar.close, limit)
  return null
}

export function shouldFillQuote(
  quote: number,
  side: Side,
  orderType: OrderType,
  limitPrice?: number | null,
  stopPrice?: number | null,
): boolean {
  if (orderType === 'market') return true
  if (orderType === 'limit') return shouldLimit(quote, side, limitPrice)
  if (orderType === 'stop') return shouldStop(quote, side, stopPrice)
  return shouldStopLimit(quote, side, limitPrice, stopPrice)
}

function shouldLimit(quote: number, side: Side, limit: number | null | undefined): boolean {
  if (limit === undefined || limit === null) return false
  if (side === 'buy' || side === 'cover') return quote <= limit
  return quote >= limit
}

function shouldStop(quote: number, side: Side, stop: number | null | undefined): boolean {
  if (stop === undefined || stop === null) return false
  if (side === 'sell' || side === 'short') return quote <= stop
  return quote >= stop
}

function shouldStopLimit(
  quote: number,
  side: Side,
  limit: number | null | undefined,
  stop: number | null | undefined,
): boolean {
  if (limit === undefined || limit === null || stop === undefined || stop === null) return false
  if (side === 'sell' || side === 'short') return quote <= stop && quote >= limit
  return quote >= stop && quote <= limit
}

export function quoteFillPrice(quote: Quote, source: FillPriceSource): number {
  if (source === 'last') return quote.price
  if (source === 'bid') return resolveBid(quote)
  if (source === 'ask') return resolveAsk(quote)
  return resolveMid(quote)
}

function isValidPrice(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0
}

function resolveBid(quote: Quote): number {
  if (isValidPrice(quote.bid)) return quote.bid as number
  return quote.price
}

function resolveAsk(quote: Quote): number {
  if (isValidPrice(quote.ask)) return quote.ask as number
  return quote.price
}

function resolveMid(quote: Quote): number {
  if (isValidPrice(quote.bid) && isValidPrice(quote.ask)) return ((quote.bid as number) + (quote.ask as number)) / 2
  return quote.price
}
