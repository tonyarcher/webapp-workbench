import { describe, expect, it } from 'vitest';
import { quoteFillPriceClient } from './quote-fill';

describe('quoteFillPriceClient', () => {
    const quote = { price: 100 };

    it('uses the last trade when that is the requested source', () => {
        expect(quoteFillPriceClient({ price: 100, bid: 99, ask: 101 }, 'last')).toBe(100);
    });

    it('uses the bid when one is usable', () => {
        expect(quoteFillPriceClient({ price: 100, bid: 99 }, 'bid')).toBe(99);
    });

    it('uses the ask when one is usable', () => {
        expect(quoteFillPriceClient({ price: 100, ask: 101 }, 'ask')).toBe(101);
    });

    it('averages a usable bid and ask for the mid', () => {
        expect(quoteFillPriceClient({ price: 100, bid: 99, ask: 103 }, 'mid')).toBe(101);
    });

    it.each([
        ['missing', undefined],
        ['zero', 0],
        ['negative', -5],
        ['not a number', Number.NaN],
        ['infinite', Number.POSITIVE_INFINITY],
    ])('falls back to the last price when the bid is %s', (_label, bid) => {
        expect(quoteFillPriceClient({ price: 100, bid: bid as number | undefined }, 'bid')).toBe(100);
    });

    it.each([
        ['missing', undefined],
        ['zero', 0],
        ['negative', -5],
        ['not a number', Number.NaN],
        ['infinite', Number.POSITIVE_INFINITY],
    ])('falls back to the last price when the ask is %s', (_label, ask) => {
        expect(quoteFillPriceClient({ price: 100, ask: ask as number | undefined }, 'ask')).toBe(100);
    });

    it('does not average a mid from only one side', () => {
        expect(quoteFillPriceClient({ price: 100, bid: 99 }, 'mid')).toBe(100);
        expect(quoteFillPriceClient({ price: 100, ask: 101 }, 'mid')).toBe(100);
    });

    it('does not average a mid from an unusable side', () => {
        expect(quoteFillPriceClient({ price: 100, bid: 99, ask: 0 }, 'mid')).toBe(100);
        expect(quoteFillPriceClient({ price: 100, bid: 0, ask: 101 }, 'mid')).toBe(100);
    });

    it('falls back to the last price when the mid has neither side', () => {
        expect(quoteFillPriceClient(quote, 'mid')).toBe(100);
    });
});
