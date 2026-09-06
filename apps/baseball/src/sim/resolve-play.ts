import type { EngineGameState } from '../local-game/rule-engine';
import { decideIntent } from './coach';
import { runnerSpeed } from './matchup';
import { chance, pickItem } from './rng';
import {
  INFIELD_POS,
  inPlayPlay,
  pitchPlay,
  resolveInPlay,
  type PlayContext,
} from './resolve-in-play';
import type { PitchLocation, PitchType, ResolvedPlay, SimMatchup } from './types';

export function nextPlay(engine: EngineGameState, matchup: SimMatchup, random: () => number): ResolvedPlay {
  const intent = decideIntent(engine, matchup, random);
  if (intent.kind === 'steal') return resolveSteal(engine, matchup, intent.base, random);
  const context = playContext(matchup, choosePitch(matchup.pitcher, random), chooseZone(matchup.pitcher, random));
  if (intent.kind === 'bunt') return resolveBunt(engine, context, random);
  return resolvePitch(engine, matchup, context, random);
}

function resolveSteal(
  engine: EngineGameState,
  matchup: SimMatchup,
  base: 2 | 3 | 4,
  random: () => number
): ResolvedPlay {
  const speed = runnerSpeed(engine, matchup.offense, base - 2);
  const type = chance(random, 0.52 + (speed - 50) * 0.006) ? 'STOLEN_BASE' : 'CAUGHT_STEALING';
  return { type, detail: { base, bats: matchup.batter.bats, throws: matchup.pitcher.throws } };
}

function resolveBunt(engine: EngineGameState, context: PlayContext, random: () => number): ResolvedPlay {
  const bunt = context.batter.ratings.bunt;
  if (chance(random, 0.08 + bunt * 0.001)) {
    return inPlayPlay('SINGLE', context, { location: 'Infield', fieldPos: 1 });
  }
  if (chance(random, 0.12 - bunt * 0.0008)) {
    return pitchPlay('STRIKEOUT', context, { strikeKind: 'swinging' });
  }
  if (engine.outs < 2 && engine.runners[0] && chance(random, 0.78 + bunt * 0.002)) {
    return inPlayPlay('SACRIFICE_BUNT', context, pickItem(random, INFIELD_POS));
  }
  return inPlayPlay('GROUNDOUT', context, pickItem(random, INFIELD_POS));
}

function resolvePitch(
  engine: EngineGameState,
  matchup: SimMatchup,
  context: PlayContext,
  random: () => number
): ResolvedPlay {
  const misc = resolveMiscAdvance(engine, context, random);
  if (misc) return misc;
  if (chance(random, inPlayChance(matchup))) return resolveInPlay(engine, matchup, context, random);
  return resolveTakenPitch(matchup, context, random);
}

function resolveMiscAdvance(engine: EngineGameState, context: PlayContext, random: () => number): ResolvedPlay | null {
  if (engine.runners.some(Boolean) && chance(random, 0.012)) {
    return pitchPlay(pickItem(random, ['WILD_PITCH', 'PASSED_BALL', 'BALK'] as const), context);
  }
  if (chance(random, 0.008)) return pitchPlay('HIT_BY_PITCH', context);
  return null;
}

function inPlayChance(matchup: SimMatchup): number {
  const platoon = matchup.batter.bats === matchup.pitcher.throws ? 0.94 : 1.06;
  const contact = matchup.batter.ratings.contact * platoon;
  return clamp01(0.17 + (contact - matchup.pitcher.ratings.stuff) * 0.0014);
}

function resolveTakenPitch(matchup: SimMatchup, context: PlayContext, random: () => number): ResolvedPlay {
  const ballP = clamp01(0.36 + (matchup.batter.ratings.discipline - matchup.pitcher.ratings.control) * 0.0013);
  if (chance(random, ballP)) return pitchPlay('BALL', context);
  return resolveSwingOrLook(matchup, context, random);
}

function resolveSwingOrLook(matchup: SimMatchup, context: PlayContext, random: () => number): ResolvedPlay {
  const inZone = context.location.zone >= 4 && context.location.zone <= 6;
  const chase = !inZone && chance(random, 0.55 - matchup.batter.ratings.discipline * 0.003);
  if (inZone && chance(random, 0.42)) return pitchPlay('FOUL', context, { strikeKind: 'swinging' });
  if (chase) return pitchPlay(chance(random, 0.45) ? 'FOUL' : 'STRIKE', context, { strikeKind: 'swinging' });
  return pitchPlay('STRIKE', context, { strikeKind: inZone ? 'looking' : 'swinging' });
}

function playContext(matchup: SimMatchup, pitchType: PitchType, location: PitchLocation): PlayContext {
  return { batter: matchup.batter, pitcher: matchup.pitcher, pitchType, location };
}

function choosePitch(pitcher: SimMatchup['pitcher'], random: () => number): PitchType {
  const arsenal: readonly PitchType[] = pitcher.ratings.arsenal.length > 0 ? pitcher.ratings.arsenal : ['Fastball'];
  return pickItem(random, arsenal);
}

function chooseZone(pitcher: SimMatchup['pitcher'], random: () => number): PitchLocation {
  if (chance(random, 0.35 + pitcher.ratings.control * 0.003)) {
    return { zone: 4 + pickIndexSafe(random, 3) };
  }
  return { zone: 1 + pickIndexSafe(random, 9) };
}

function pickIndexSafe(random: () => number, length: number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

function clamp01(value: number): number {
  return Math.min(0.85, Math.max(0.05, value));
}
