import { describe, expect, it } from 'vitest';
import { createGame } from '../local-game/rule-engine';
import type { EngineGameState } from '../local-game/rule-engine';
import { canSacrificeBunt, decideIntent, stealDestination } from './coach';
import { generateRoster } from './generate-roster';
import { mulberry32 } from './rng';
import type { SimMatchup, SimRoster } from './types';

function baseGame(): EngineGameState {
  const home = generateRoster(mulberry32(1), 'Home');
  const away = generateRoster(mulberry32(2), 'Away');
  return createGame({
    homeName: home.teamName,
    awayName: away.teamName,
    homeLineup: home.lineup,
    awayLineup: away.lineup,
    totalInnings: 9,
    homePitcherName: home.pitcher.name,
    awayPitcherName: away.pitcher.name,
  });
}

function matchupWith(offense: SimRoster, batterIndex: number): SimMatchup {
  const defense = generateRoster(mulberry32(4), 'Defense');
  return {
    batter: offense.lineup[batterIndex],
    pitcher: defense.pitcher,
    offense,
    defense,
  };
}

describe('coach', () => {
  it('bunts in a late close game with a weak hitter and a runner on first', () => {
    const offense = generateRoster(mulberry32(8), 'Offense');
    offense.lineup[8] = {
      ...offense.lineup[8],
      ratings: { ...offense.lineup[8].ratings, contact: 40, bunt: 70, power: 30, speed: 35 },
    };
    const engine = {
      ...baseGame(),
      inning: 8,
      outs: 0,
      runners: [true, false, false] as EngineGameState['runners'],
      runnerSlots: [9, null, null] as EngineGameState['runnerSlots'],
      awayScore: 2,
      homeScore: 2,
    };
    const matchup = matchupWith(offense, 8);
    expect(canSacrificeBunt(engine, matchup)).toBe(true);
    expect(decideIntent(engine, matchup, () => 0).kind).toBe('bunt');
  });

  it('does not bunt with two outs or in a blowout', () => {
    const offense = generateRoster(mulberry32(8), 'Offense');
    offense.lineup[8] = {
      ...offense.lineup[8],
      ratings: { ...offense.lineup[8].ratings, contact: 40, bunt: 80, power: 30 },
    };
    const matchup = matchupWith(offense, 8);
    const twoOuts = {
      ...baseGame(),
      inning: 8,
      outs: 2,
      runners: [true, false, false] as EngineGameState['runners'],
      awayScore: 2,
      homeScore: 2,
    };
    const blowout = {
      ...baseGame(),
      inning: 8,
      outs: 0,
      runners: [true, false, false] as EngineGameState['runners'],
      awayScore: 8,
      homeScore: 1,
    };
    expect(canSacrificeBunt(twoOuts, matchup)).toBe(false);
    expect(canSacrificeBunt(blowout, matchup)).toBe(false);
    expect(decideIntent(twoOuts, matchup, () => 0).kind).toBe('swing');
  });

  it('steals second when a fast runner is on first and second is open', () => {
    const offense = generateRoster(mulberry32(11), 'Offense');
    offense.lineup[0] = { ...offense.lineup[0], ratings: { ...offense.lineup[0].ratings, speed: 88 } };
    const engine = {
      ...baseGame(),
      runners: [true, false, false] as EngineGameState['runners'],
      runnerSlots: [1, null, null] as EngineGameState['runnerSlots'],
      outs: 0,
      balls: 1,
      strikes: 0,
      awayScore: 3,
      homeScore: 3,
    };
    expect(stealDestination(engine)).toBe(2);
    const intent = decideIntent(engine, matchupWith(offense, 1), () => 0);
    expect(intent).toEqual({ kind: 'steal', base: 2 });
  });

  it('does not steal with a slow runner or the bases loaded', () => {
    const offense = generateRoster(mulberry32(11), 'Offense');
    offense.lineup[0] = { ...offense.lineup[0], ratings: { ...offense.lineup[0].ratings, speed: 40 } };
    const slow = {
      ...baseGame(),
      runners: [true, false, false] as EngineGameState['runners'],
      runnerSlots: [1, null, null] as EngineGameState['runnerSlots'],
    };
    const loaded = {
      ...baseGame(),
      runners: [true, true, true] as EngineGameState['runners'],
      runnerSlots: [1, 2, 3] as EngineGameState['runnerSlots'],
    };
    expect(decideIntent(slow, matchupWith(offense, 1), () => 0).kind).toBe('swing');
    expect(stealDestination(loaded)).toBeNull();
    expect(decideIntent(loaded, matchupWith(offense, 1), () => 0).kind).toBe('swing');
  });
});
