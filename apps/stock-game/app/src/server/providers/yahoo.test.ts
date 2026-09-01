import { describe, expect, it } from 'vitest'
import type { Bar } from '@stock-game/shared'
import { parseBars, parseChartBlock, parseQuoteBook } from './yahoo'

const fixture = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'AAPL',
          currency: 'USD',
          fullExchangeName: 'NasdaqGS',
          shortName: 'Apple Inc.',
        },
        timestamp: [1704067200, 1704153600],
        indicators: {
          quote: [
            {
              open: [100, 101],
              high: [102, 103],
              low: [99, 100],
              close: [101, 102],
              volume: [1000, 1100],
            },
          ],
        },
      },
    ],
  },
}

describe('yahoo parseBars', () => {
  it('zips timestamps with quote data into bars', () => {
    const block = parseChartBlock(fixture)
    const bars: Bar[] = parseBars(block)
    expect(bars).toEqual([
      { time: 1704067200000, open: 100, high: 102, low: 99, close: 101, volume: 1000 },
      { time: 1704153600000, open: 101, high: 103, low: 100, close: 102, volume: 1100 },
    ])
  })

  it('skips null timestamps and null closes', () => {
    const block = parseChartBlock({
      chart: {
        result: [
          {
            timestamp: [1704067200, null, 1704153600],
            indicators: {
              quote: [
                {
                  open: [100, 101, 102],
                  high: [102, 103, 104],
                  low: [99, 100, 101],
                  close: [null, 101, 103],
                  volume: [1000, 1100, 1200],
                },
              ],
            },
          },
        ],
      },
    })
    const bars = parseBars(block)
    expect(bars).toHaveLength(1)
    expect(bars[0]!.time).toBe(1704153600000)
    expect(bars[0]!.close).toBe(103)
  })

  it('throws on an empty result set', () => {
    expect(() => parseChartBlock({ chart: { result: [] } })).toThrow()
  })
})

describe('yahoo parseQuoteBook', () => {
  it('parses bid and ask from quoteResponse', () => {
    const json = { quoteResponse: { result: [{ bid: 99, ask: 101 }] } }
    expect(parseQuoteBook(json)).toEqual({ bid: 99, ask: 101 })
  })

  it('returns null when bid and ask missing or invalid', () => {
    expect(parseQuoteBook({ quoteResponse: { result: [{ bid: 0, ask: -1 }] } })).toBeNull()
    expect(parseQuoteBook({ quoteResponse: { result: [] } })).toBeNull()
    expect(parseQuoteBook({})).toBeNull()
  })
})
