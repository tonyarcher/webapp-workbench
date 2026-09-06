import { describe, expect, it } from 'vitest';
import { generateMatchup, generateRoster, lineupFromRoster, rosterFromLineup } from './generate-roster';
import { mulberry32 } from './rng';

describe('generateRoster', () => {
  it('builds nine batters plus a pitcher with ratings in range', () => {
    const roster = generateRoster(mulberry32(7), 'Toledo Mud Hens');
    expect(roster.teamName).toBe('Toledo Mud Hens');
    expect(roster.lineup).toHaveLength(9);
    expect(roster.pitcher.name.length).toBeGreaterThan(0);
    expect(roster.pitcher.ratings.arsenal).toContain('Fastball');
    expect(roster.pitcher.ratings.arsenal.length).toBeGreaterThanOrEqual(3);
    const positions = roster.lineup.map((player) => player.position);
    expect(new Set(positions).size).toBe(9);
    for (const player of roster.lineup) {
      expect(player.ratings.contact).toBeGreaterThanOrEqual(25);
      expect(player.ratings.contact).toBeLessThanOrEqual(99);
      expect(player.bats === 'L' || player.bats === 'R').toBe(true);
    }
  });

  it('generates two different team names for a matchup', () => {
    const matchup = generateMatchup(mulberry32(99));
    expect(matchup.home.teamName).not.toBe(matchup.away.teamName);
    expect(matchup.home.lineup[0].batterName).not.toBe(matchup.away.lineup[0].batterName);
  });

  it('wraps an existing lineup with generated ratings', () => {
    const roster = rosterFromLineup(mulberry32(3), 'Cubs', [{ batterName: 'Nico Hoerner', position: '2B', jerseyNumber: 2 }], 'Shota Imanaga');
    expect(roster.lineup[0].batterName).toBe('Nico Hoerner');
    expect(roster.pitcher.name).toBe('Shota Imanaga');
    expect(lineupFromRoster(roster)[0]).toEqual({ batterName: 'Nico Hoerner', position: '2B', jerseyNumber: 2 });
  });
});
