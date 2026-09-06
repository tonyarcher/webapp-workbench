import type { EngineGameState } from '../local-game/rule-engine';
import type { SimMatchup, SimPlayer, SimRoster } from './types';

export function matchupFromGame(engine: EngineGameState, home: SimRoster, away: SimRoster): SimMatchup {
  const offense = engine.half === 'TOP' ? away : home;
  const defense = engine.half === 'TOP' ? home : away;
  const batterIndex = engine.half === 'TOP' ? engine.awayBatterIdx : engine.homeBatterIdx;
  const batter = offense.lineup[batterIndex % offense.lineup.length] ?? offense.lineup[0];
  return { batter, pitcher: defense.pitcher, offense, defense };
}

export function playerBySlot(roster: SimRoster, slot: number | null): SimPlayer | undefined {
  if (slot == null || slot < 1) return undefined;
  return roster.lineup[slot - 1];
}

export function runnerSpeed(engine: EngineGameState, offense: SimRoster, baseIndex: number): number {
  const slot = engine.runnerSlots[baseIndex];
  return playerBySlot(offense, slot)?.ratings.speed ?? 50;
}
