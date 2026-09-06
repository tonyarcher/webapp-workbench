import { describe, expect, it } from 'vitest';
import { generateMatchup } from './generate-roster';
import { mulberry32 } from './rng';
import { simulateGame } from './simulate-game';

describe('simulateGame', () => {
  it('reaches a final state and is deterministic for a seed', () => {
    const matchup = generateMatchup(mulberry32(21));
    const first = simulateGame({ home: matchup.home, away: matchup.away, seed: 21 });
    const second = simulateGame({ home: matchup.home, away: matchup.away, seed: 21 });
    expect(first.engine.over).toBe(true);
    expect(first.plays.map((play) => play.type)).toEqual(second.plays.map((play) => play.type));
    expect(first.engine.awayScore).toBe(second.engine.awayScore);
    expect(first.engine.homeScore).toBe(second.engine.homeScore);
    const awayAb = first.engine.awayLineup.rows.reduce((sum, row) => sum + row.atBats, 0);
    expect(awayAb).toBeGreaterThan(0);
  });

  it('produces stolen bases and sacrifices across a handful of seeds', () => {
    const types = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const matchup = generateMatchup(mulberry32(seed * 17));
      const result = simulateGame({ home: matchup.home, away: matchup.away, seed, innings: 9 });
      expect(result.engine.over, `seed ${seed}`).toBe(true);
      for (const play of result.plays) types.add(play.type);
    }
    expect(types.has('STOLEN_BASE') || types.has('CAUGHT_STEALING')).toBe(true);
    expect(types.has('SACRIFICE_BUNT') || types.has('SACRIFICE_FLY')).toBe(true);
  });
});
