import type { Side } from '@stock-game/shared'

const PRICE_FUDGE = 1.005

export function maxAffordableQty(cashCents: number, price: number, commissionCents: number): number {
  if (!(price > 0)) return 0
  const paddedCents = Math.ceil(price * 100 * PRICE_FUDGE)
  const budget = cashCents - commissionCents
  if (paddedCents <= 0 || budget < paddedCents) return 0
  return Math.floor(budget / paddedCents)
}

export function maxLongQty(heldQty: number): number {
  return Math.max(0, heldQty)
}

export function maxShortQty(heldQty: number): number {
  return Math.max(0, -heldQty)
}

export function maxQtyForSide(side: Side, cashCents: number, price: number, commissionCents: number, heldQty: number): number {
  if (side === 'buy' || side === 'short') return maxAffordableQty(cashCents, price, commissionCents)
  if (side === 'sell') return maxLongQty(heldQty)
  return Math.min(maxShortQty(heldQty), maxAffordableQty(cashCents, price, commissionCents))
}
