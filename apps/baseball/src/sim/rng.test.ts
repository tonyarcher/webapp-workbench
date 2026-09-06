import { describe, expect, it } from 'vitest';
import { chance, clamp, mixSeed, mulberry32, pickItem } from './rng';

describe('rng', () => {
  it('returns a deterministic stream for a seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('mixes seeds into a stable unsigned value', () => {
    expect(mixSeed(1, 2, 3)).toBe(mixSeed(1, 2, 3));
    expect(mixSeed(1, 2, 3)).not.toBe(mixSeed(1, 2, 4));
  });

  it('clamps and picks from a list', () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-2, 0, 5)).toBe(0);
    expect(pickItem(() => 0, ['a', 'b'])).toBe('a');
    expect(chance(() => 0, 0.5)).toBe(true);
    expect(chance(() => 0.9, 0.5)).toBe(false);
  });
});
