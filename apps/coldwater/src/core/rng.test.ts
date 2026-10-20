import { describe, expect, it } from 'vitest';
import { randomAt, randomIndex, shuffle } from './rng';

describe('seeded random', () => {
    it('returns the same value for the same seed and step', () => {
        expect(randomAt(1234, 7)).toBe(randomAt(1234, 7));
        expect(randomAt(1234, 7)).not.toBe(randomAt(1234, 8));
    });

    it('stays in the unit interval', () => {
        for (let step = 0; step < 50; step += 1) {
            const value = randomAt(0, step);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it('handles empty and single-item selections', () => {
        expect(randomIndex(1, 2, 0)).toBe(0);
        expect(randomIndex(1, 2, -3)).toBe(0);
        expect(randomIndex(1, 2, 1)).toBe(0);
        expect(randomIndex(1, 2, 4)).toBeGreaterThanOrEqual(0);
        expect(randomIndex(1, 2, 4)).toBeLessThan(4);
    });

    it('shuffles without losing or duplicating items', () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        const shuffled = shuffle(items, 0);
        expect(shuffled).toHaveLength(items.length);
        expect([...shuffled].sort()).toEqual([...items].sort());
        expect(shuffled).not.toEqual(items);
        expect(shuffle(items, 0)).toEqual(shuffled);
        expect(shuffle([], 9)).toEqual([]);
        expect(shuffle(['only'], 9)).toEqual(['only']);
    });
});
