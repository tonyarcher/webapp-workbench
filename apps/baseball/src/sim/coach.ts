import type { EngineGameState } from '../local-game/rule-engine';
import { chance } from './rng';
import { runnerSpeed } from './matchup';
import type { SimMatchup } from './types';

export type CoachIntent =
  | { kind: 'swing' }
  | { kind: 'bunt' }
  | { kind: 'steal'; base: 2 | 3 | 4 };

export function decideIntent(engine: EngineGameState, matchup: SimMatchup, random: () => number): CoachIntent {
  const stealBase = stealDestination(engine);
  if (stealBase != null && shouldSteal(engine, matchup, stealBase, random)) {
    return { kind: 'steal', base: stealBase };
  }
  if (canSacrificeBunt(engine, matchup) && chance(random, buntChance(matchup))) {
    return { kind: 'bunt' };
  }
  return { kind: 'swing' };
}

export function stealDestination(engine: EngineGameState): 2 | 3 | 4 | null {
  if (engine.runners[0] && !engine.runners[1]) return 2;
  if (engine.runners[1] && !engine.runners[2]) return 3;
  return null;
}

export function canSacrificeBunt(engine: EngineGameState, matchup: SimMatchup): boolean {
  if (engine.outs !== 0) return false;
  if (engine.inning < Math.max(1, engine.totalInnings - 2)) return false;
  if (scoreMargin(engine) > 1) return false;
  if (engine.runners[2]) return false;
  if (!engine.runners[0]) return false;
  const { contact, bunt, power } = matchup.batter.ratings;
  if (power >= 70 && contact >= 60) return false;
  return contact < 55 || bunt >= 58;
}

function shouldSteal(
  engine: EngineGameState,
  matchup: SimMatchup,
  destination: 2 | 3 | 4,
  random: () => number
): boolean {
  if (engine.balls === 3 && engine.strikes === 2) return false;
  if (scoreMargin(engine) > 3) return false;
  const fromIndex = destination - 2;
  const speed = runnerSpeed(engine, matchup.offense, fromIndex);
  if (speed < 58) return false;
  if (destination === 3 && speed < 72) return false;
  let probability = 0.07 + (speed - 58) * 0.006;
  if (engine.outs === 2) probability *= 0.45;
  if (destination === 3) probability *= 0.4;
  if (engine.strikes === 2) probability *= 0.7;
  return chance(random, probability);
}

function buntChance(matchup: SimMatchup): number {
  const { bunt, contact } = matchup.batter.ratings;
  return clamp01(0.28 + (bunt - 50) * 0.008 - (contact - 45) * 0.004);
}

export function scoreMargin(engine: EngineGameState): number {
  return Math.abs(engine.homeScore - engine.awayScore);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
