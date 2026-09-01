import { describe, expect, it } from 'vitest'
import { maxAffordableQty, maxLongQty, maxShortQty } from './max-qty'

describe('max-qty', () => {
  it('floors with 0.5% fudge', () => {
    expect(maxAffordableQty(1_000_000, 100, 0)).toBe(99)
  })
  it('accounts for commission', () => {
    expect(maxAffordableQty(1_000_000, 100, 100)).toBe(99)
  })
  it('returns 0 when cash too small', () => {
    expect(maxAffordableQty(50, 100, 0)).toBe(0)
  })
  it('returns 0 for non-positive price', () => {
    expect(maxAffordableQty(1_000_000, 0, 0)).toBe(0)
    expect(maxAffordableQty(1_000_000, -5, 0)).toBe(0)
  })
  it('maxLongQty', () => {
    expect(maxLongQty(10)).toBe(10)
    expect(maxLongQty(-3)).toBe(0)
  })
  it('maxShortQty', () => {
    expect(maxShortQty(-5)).toBe(5)
    expect(maxShortQty(3)).toBe(0)
  })
})
