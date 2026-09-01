export type BattingHalf = 'TOP' | 'BOTTOM';

export type RunnersOnBase = [boolean, boolean, boolean];

export type RunnerSlots = [number | null, number | null, number | null];

export type RunnerInnings = [number | null, number | null, number | null];

export type ScoringEventType =
  | 'BALL'
  | 'STRIKE'
  | 'FOUL'
  | 'STRIKEOUT'
  | 'WALK'
  | 'HIT_BY_PITCH'
  | 'SINGLE'
  | 'DOUBLE'
  | 'TRIPLE'
  | 'HOME_RUN'
  | 'GROUNDOUT'
  | 'FLYOUT'
  | 'LINE_OUT'
  | 'POP_OUT'
  | 'SACRIFICE_FLY'
  | 'SACRIFICE_BUNT'
  | 'ERROR'
  | 'FIELDER_CHOICE'
  | 'STOLEN_BASE'
  | 'CAUGHT_STEALING'
  | 'WILD_PITCH'
  | 'PASSED_BALL'
  | 'BALK'
  | 'SET_LINEUP';

export interface LineupAssignment {
  batterName: string;
  position: string;
  jerseyNumber?: number;
}

export interface ScoringEvent {
  type: ScoringEventType;
  base?: number;
  fieldPos?: number;
  doublePlay?: boolean;
  homeLineup?: LineupAssignment[];
  awayLineup?: LineupAssignment[];
  homePitcherName?: string;
  awayPitcherName?: string;
}

export interface EngineAtBatCell {
  count: string;
  notation: string;
  base: number;
  outNum: number | null;
  hasEndedInningLine: boolean;
  run?: boolean;
  rbiCount?: number;
  advancements?: import('./notation').Advancement[];
}

export function emptyAtBatCell(): EngineAtBatCell {
  return { count: '0-0', notation: '', base: 0, outNum: null, hasEndedInningLine: false, run: false, rbiCount: 0 };
}

export interface EngineScorebookRow {
  slotIdx: number;
  batterName: string;
  position: string;
  jerseyNumber: number;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
  innings: Record<string, EngineAtBatCell>;
}

export interface EngineTeamLineup {
  name: string;
  pitcherName: string;
  rows: EngineScorebookRow[];
}

export interface EngineGameState {
  awayLineup: EngineTeamLineup;
  homeLineup: EngineTeamLineup;
  inning: number;
  half: BattingHalf;
  balls: number;
  strikes: number;
  outs: number;
  awayScore: number;
  homeScore: number;
  runners: RunnersOnBase;
  runnerSlots: RunnerSlots;
  runnerInnings: RunnerInnings;
  awayBatterIdx: number;
  homeBatterIdx: number;
  awayRunsByInning: number[];
  homeRunsByInning: number[];
  awayErrors: number;
  homeErrors: number;
  totalInnings: number;
  over: boolean;
}

export interface EngineInitOptions {
  homeName: string;
  awayName: string;
  homeLineup: LineupAssignment[];
  awayLineup: LineupAssignment[];
  totalInnings: number;
  homePitcherName?: string;
  awayPitcherName?: string;
}

import { createTeamLineup } from './rule-engine-helpers';
import { battingLineup, endOnWalkOff, ensureRunnerInnings } from './rule-engine-helpers';
import {
  handleBall,
  handleCaughtStealing,
  handleHit,
  handleInPlayOut,
  handleReachOnError,
  handleSacrificeBunt,
  handleSetLineup,
  handleStolenBase,
  handleStrike,
  handleStrikeout,
  handleWalk,
  handleWildAdvance,
} from './rule-engine-plays';

const OUT_EVENT_TYPES: ScoringEventType[] = [
  'GROUNDOUT',
  'FLYOUT',
  'LINE_OUT',
  'POP_OUT',
  'SACRIFICE_FLY',
  'SACRIFICE_BUNT',
  'STRIKEOUT',
  'CAUGHT_STEALING',
];
const HIT_EVENT_TYPES: ScoringEventType[] = ['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN'];

export function createGame(options: EngineInitOptions): EngineGameState {
  return {
    awayLineup: createTeamLineup(options.awayName, options.awayLineup, options.awayPitcherName),
    homeLineup: createTeamLineup(options.homeName, options.homeLineup, options.homePitcherName),
    inning: 1,
    half: 'TOP',
    balls: 0,
    strikes: 0,
    outs: 0,
    awayScore: 0,
    homeScore: 0,
    runners: [false, false, false],
    runnerSlots: [null, null, null],
    runnerInnings: [null, null, null],
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    awayRunsByInning: [],
    homeRunsByInning: [],
    awayErrors: 0,
    homeErrors: 0,
    totalInnings: options.totalInnings,
    over: false,
  };
}

type PlayHandler = (game: EngineGameState, event: ScoringEvent) => EngineGameState;

const PLAY_HANDLERS: Record<string, PlayHandler> = {
  BALL: (game) => handleBall(game),
  STRIKE: (game) => handleStrike(game, false),
  FOUL: (game) => handleStrike(game, true),
  STRIKEOUT: (game) => handleStrikeout(game),
  WALK: (game) => handleWalk(game, 'WALK'),
  HIT_BY_PITCH: (game) => handleWalk(game, 'HIT_BY_PITCH'),
  SINGLE: (game) => handleHit(game, 'SINGLE'),
  DOUBLE: (game) => handleHit(game, 'DOUBLE'),
  TRIPLE: (game) => handleHit(game, 'TRIPLE'),
  HOME_RUN: (game) => handleHit(game, 'HOME_RUN'),
  GROUNDOUT: (game, event) => handleInPlayOut(game, event.type, event.fieldPos, event.doublePlay),
  LINE_OUT: (game, event) => handleInPlayOut(game, event.type, event.fieldPos, event.doublePlay),
  FLYOUT: (game, event) => handleInPlayOut(game, event.type, event.fieldPos),
  POP_OUT: (game, event) => handleInPlayOut(game, event.type, event.fieldPos),
  SACRIFICE_FLY: (game, event) => handleInPlayOut(game, event.type, event.fieldPos),
  SACRIFICE_BUNT: (game, event) => handleSacrificeBunt(game, event.fieldPos),
  ERROR: (game, event) => handleReachOnError(game, event.type, event.fieldPos),
  FIELDER_CHOICE: (game, event) => handleReachOnError(game, event.type, event.fieldPos),
  STOLEN_BASE: (game, event) => handleStolenBase(game, event.base),
  CAUGHT_STEALING: (game, event) => handleCaughtStealing(game, event.base),
  WILD_PITCH: (game, event) => handleWildAdvance(game, event.type),
  PASSED_BALL: (game, event) => handleWildAdvance(game, event.type),
  BALK: (game, event) => handleWildAdvance(game, event.type),
};

export function reduceGame(game: EngineGameState, event: ScoringEvent): EngineGameState {
  if (game.over) return game;
  game = ensureRunnerInnings(game);
  if (event.type === 'SET_LINEUP') return handleSetLineup(game, event);
  if (battingLineup(game).rows.length === 0) return game;
  const handler = PLAY_HANDLERS[event.type];
  if (!handler) return game;
  return endOnWalkOff(handler(game, event));
}

export function isHitEventType(eventType: string): boolean {
  return HIT_EVENT_TYPES.includes(eventType as ScoringEventType);
}

export function isOutEventType(eventType: string): boolean {
  return OUT_EVENT_TYPES.includes(eventType as ScoringEventType);
}

export function isGameOver(game: EngineGameState): boolean {
  return game.over;
}

export function isBattingHalfTop(game: EngineGameState): boolean {
  return game.half === 'TOP';
}
