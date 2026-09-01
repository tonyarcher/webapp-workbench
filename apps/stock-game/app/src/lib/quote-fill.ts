import type { FillPriceSource } from '@stock-game/shared'

export function quoteFillPriceClient(quote: { price: number; bid?: number | undefined; ask?: number | undefined }, source: FillPriceSource): number {
  if (source === 'last') return quote.price
  if (source === 'bid') return resolveBidClient(quote)
  if (source === 'ask') return resolveAskClient(quote)
  return resolveMidClient(quote)
}

function isValid(value: number | undefined): boolean {
  return value !== undefined && Number.isFinite(value) && value > 0
}

function resolveBidClient(quote: { price: number; bid?: number | undefined }): number {
  if (isValid(quote.bid)) return quote.bid as number
  return quote.price
}

function resolveAskClient(quote: { price: number; ask?: number | undefined }): number {
  if (isValid(quote.ask)) return quote.ask as number
  return quote.price
}

function resolveMidClient(quote: { price: number; bid?: number | undefined; ask?: number | undefined }): number {
  if (isValid(quote.bid) && isValid(quote.ask)) return ((quote.bid as number) + (quote.ask as number)) / 2
  return quote.price
}
