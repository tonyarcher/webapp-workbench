import {describe, expect, it} from 'vitest';
import {between, chance, clamp, mixSeed, mulberry32, pickIndex} from './rng';

describe('rng', () => {
    it('is deterministic', () => {
        expect(mulberry32(1)()).toBe(mulberry32(1)());
        expect(mixSeed(1, 2)).toBe(mixSeed(1, 2));
        expect(clamp(3, 0, 2)).toBe(2);
        expect(clamp(-1, 0, 2)).toBe(0);
        const random = mulberry32(5);
        expect(pickIndex(random, 0)).toBe(0);
        expect(between(random, 2, 2)).toBe(2);
        expect(typeof chance(random, 0.5)).toBe('boolean');
    });
});
