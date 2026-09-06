import { createGame, reduceGame } from '../local-game/rule-engine';
import type { EngineGameState, ScoringEvent, ScoringEventType } from '../local-game/rule-engine';
import { matchupFromGame } from './matchup';
import { mixSeed, mulberry32 } from './rng';
import { nextPlay } from './resolve-play';
import type { ResolvedPlay, SimRoster } from './types';

const MAX_PLAYS = 5000;

export function rngForEngine(seed: number, engine: EngineGameState, eventCount: number): () => number {
  return mulberry32(
    mixSeed(
      seed,
      eventCount,
      engine.inning,
      engine.half === 'TOP' ? 1 : 2,
      engine.outs,
      engine.balls,
      engine.strikes,
      engine.awayScore,
      engine.homeScore,
      engine.awayBatterIdx,
      engine.homeBatterIdx,
      engine.runners[0] ? 1 : 0,
      engine.runners[1] ? 1 : 0,
      engine.runners[2] ? 1 : 0
    )
  );
}

export function toScoringEvent(play: ResolvedPlay): ScoringEvent {
  const event: ScoringEvent = { type: play.type as ScoringEventType };
  const fieldPos = Number(play.detail.fieldPos);
  const base = Number(play.detail.base);
  if (Number.isFinite(fieldPos) && fieldPos >= 1 && fieldPos <= 9) event.fieldPos = fieldPos;
  if (Number.isFinite(base) && base >= 1 && base <= 4) event.base = base;
  if (play.detail.doublePlay === true) event.doublePlay = true;
  return event;
}

export function simulateGame(options: {
  home: SimRoster;
  away: SimRoster;
  seed: number;
  innings?: number;
}): { engine: EngineGameState; plays: ResolvedPlay[] } {
  let engine = createGame({
    homeName: options.home.teamName,
    awayName: options.away.teamName,
    homeLineup: options.home.lineup,
    awayLineup: options.away.lineup,
    totalInnings: options.innings ?? 9,
    homePitcherName: options.home.pitcher.name,
    awayPitcherName: options.away.pitcher.name,
  });
  const plays: ResolvedPlay[] = [];
  while (!engine.over && plays.length < MAX_PLAYS) {
    const play = nextPlay(engine, matchupFromGame(engine, options.home, options.away), rngForEngine(options.seed, engine, plays.length));
    engine = reduceGame(engine, toScoringEvent(play));
    plays.push(play);
  }
  return { engine, plays };
}
