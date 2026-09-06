import type { EngineGameState } from '../local-game/rule-engine';
import { chance, pickItem } from './rng';
import type { PitchLocation, PitchType, ResolvedPlay, SimMatchup, SimPlayer, SimPitcher } from './types';

const HIT_LOCATIONS = ['Left Field', 'Center Field', 'Right Field', 'Gap', 'Down the Line', 'Infield'] as const;

export const INFIELD_POS = [
  { location: 'Pitcher (1)', fieldPos: 1 },
  { location: 'Catcher (2)', fieldPos: 2 },
  { location: '1st Base (3)', fieldPos: 3 },
  { location: '2nd Base (4)', fieldPos: 4 },
  { location: '3rd Base (5)', fieldPos: 5 },
  { location: 'Shortstop (6)', fieldPos: 6 },
] as const;

export const OUTFIELD_POS = [
  { location: 'Left Field (7)', fieldPos: 7 },
  { location: 'Center Field (8)', fieldPos: 8 },
  { location: 'Right Field (9)', fieldPos: 9 },
] as const;

export interface PlayContext {
  batter: SimPlayer;
  pitcher: SimPitcher;
  pitchType: PitchType;
  location: PitchLocation;
}

export function resolveInPlay(
  engine: EngineGameState,
  matchup: SimMatchup,
  context: PlayContext,
  random: () => number
): ResolvedPlay {
  const quality = contactQuality(matchup, random);
  return resolveHitQuality(quality, matchup, context, random) ?? resolveInPlayOut(engine, matchup, context, random, quality);
}

export function pitchPlay(type: string, context: PlayContext, extra: Record<string, unknown> = {}): ResolvedPlay {
  return {
    type,
    detail: {
      pitchType: context.pitchType,
      pitchLocation: context.location,
      bats: context.batter.bats,
      throws: context.pitcher.throws,
      ...extra,
    },
  };
}

export function inPlayPlay(
  type: string,
  context: PlayContext,
  extra: { location?: string; fieldPos?: number; doublePlay?: boolean }
): ResolvedPlay {
  return pitchPlay(type, context, extra);
}

function contactQuality(matchup: SimMatchup, random: () => number): number {
  return (
    matchup.batter.ratings.contact * 0.55 +
    matchup.batter.ratings.power * 0.45 -
    matchup.pitcher.ratings.stuff * 0.35 +
    random() * 25
  );
}

function resolveHitQuality(
  quality: number,
  matchup: SimMatchup,
  context: PlayContext,
  random: () => number
): ResolvedPlay | null {
  if (quality > 78 && chance(random, 0.22 + matchup.batter.ratings.power * 0.004)) {
    return inPlayPlay('HOME_RUN', context, outfieldHit(random));
  }
  if (quality > 70 && chance(random, 0.12 + matchup.batter.ratings.speed * 0.002)) {
    return inPlayPlay('TRIPLE', context, outfieldHit(random));
  }
  if (quality > 62 && chance(random, 0.35)) {
    return inPlayPlay('DOUBLE', context, outfieldHit(random));
  }
  if (quality > 52) {
    return inPlayPlay('SINGLE', context, { location: pickItem(random, HIT_LOCATIONS), fieldPos: pickItem(random, [7, 8, 9, 4, 6]) });
  }
  return null;
}

function resolveInPlayOut(
  engine: EngineGameState,
  matchup: SimMatchup,
  context: PlayContext,
  random: () => number,
  quality: number
): ResolvedPlay {
  return resolveRareReach(engine, context, random) ?? resolveSacFly(engine, context, random, quality) ?? resolvePlainOut(engine, matchup, context, random);
}

function resolveRareReach(engine: EngineGameState, context: PlayContext, random: () => number): ResolvedPlay | null {
  if (chance(random, 0.06)) {
    return inPlayPlay('ERROR', context, pickItem(random, [...INFIELD_POS, ...OUTFIELD_POS]));
  }
  if (engine.runners[0] && chance(random, 0.08)) {
    return inPlayPlay('FIELDER_CHOICE', context, pickItem(random, INFIELD_POS));
  }
  return null;
}

function resolveSacFly(engine: EngineGameState, context: PlayContext, random: () => number, quality: number): ResolvedPlay | null {
  if (engine.runners[2] && engine.outs < 2 && quality > 40 && chance(random, 0.4)) {
    return inPlayPlay('SACRIFICE_FLY', context, pickItem(random, OUTFIELD_POS));
  }
  return null;
}

function resolvePlainOut(
  engine: EngineGameState,
  matchup: SimMatchup,
  context: PlayContext,
  random: () => number
): ResolvedPlay {
  const gb = matchup.pitcher.ratings.gbTendency;
  if (chance(random, 0.22 + gb * 0.004)) {
    const doublePlay = Boolean(engine.runners[0] && engine.outs < 2 && chance(random, 0.28 - matchup.batter.ratings.speed * 0.002));
    return inPlayPlay('GROUNDOUT', context, { ...pickItem(random, INFIELD_POS), doublePlay });
  }
  if (chance(random, 0.35)) return inPlayPlay('FLYOUT', context, pickItem(random, OUTFIELD_POS));
  if (chance(random, 0.5)) return inPlayPlay('LINE_OUT', context, pickItem(random, [...INFIELD_POS, ...OUTFIELD_POS]));
  return inPlayPlay('POP_OUT', context, pickItem(random, INFIELD_POS));
}

function outfieldHit(random: () => number): { location: string; fieldPos: number } {
  const fieldPos = pickItem(random, [7, 8, 9]);
  return { location: pickItem(random, HIT_LOCATIONS), fieldPos };
}
