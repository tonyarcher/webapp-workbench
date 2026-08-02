export type BattingHalf = 'TOP' | 'BOTTOM';

export type RunnersOnBase = [boolean, boolean, boolean];

export type RunnerSlots = [number | null, number | null, number | null];

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
  | 'ERROR'
  | 'FIELDER_CHOICE';

export interface ScoringEvent {
  type: ScoringEventType;
  base?: number;
  fieldPos?: number;
  doublePlay?: boolean;
}

export interface EngineAtBatCell {
  count: string;
  notation: string;
  base: number;
  outNum: number | null;
  hasEndedInningLine: boolean;
  run?: boolean;
  rbiCount?: number;
  advancements?: Advancement[];
}

export function emptyAtBatCell(): EngineAtBatCell {
  return { count: '0-0', notation: '', base: 0, outNum: null, hasEndedInningLine: false, run: false, rbiCount: 0 };
}

export interface EngineScorebookRow {
  slotIdx: number;
  batterName: string;
  position: string;
  atBats: number;
  runs: number;
  hits: number;
  rbi: number;
  walks: number;
  innings: Record<string, EngineAtBatCell>;
}

export interface EngineTeamLineup {
  name: string;
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
  homeLineup: Array<{ batterName: string; position: string }>;
  awayLineup: Array<{ batterName: string; position: string }>;
  totalInnings: number;
}

import { hitBaseCount, hitNotation, inPlayOutNotation } from './notation';
import { runnerAdvancementsForHit, runnerAdvancementsForSacrifice, runnerAdvancementsForWalk } from './notation';
import type { Advancement } from './notation';

const OUT_EVENT_TYPES: ScoringEventType[] = ['GROUNDOUT', 'FLYOUT', 'LINE_OUT', 'POP_OUT', 'SACRIFICE_FLY', 'STRIKEOUT'];
const HIT_EVENT_TYPES: ScoringEventType[] = ['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN'];

export function createGame(options: EngineInitOptions): EngineGameState {
  return {
    awayLineup: createTeamLineup(options.awayName, options.awayLineup),
    homeLineup: createTeamLineup(options.homeName, options.homeLineup),
    inning: 1,
    half: 'TOP',
    balls: 0,
    strikes: 0,
    outs: 0,
    awayScore: 0,
    homeScore: 0,
    runners: [false, false, false],
    runnerSlots: [null, null, null],
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

function createTeamLineup(
  name: string,
  lineup: Array<{ batterName: string; position: string }>
): EngineTeamLineup {
  const rows = lineup.map((player, index) => ({
    slotIdx: index + 1,
    batterName: player.batterName,
    position: player.position,
    atBats: 0,
    runs: 0,
    hits: 0,
    rbi: 0,
    walks: 0,
    innings: {},
  }));
  return { name, rows };
}

export function reduceGame(game: EngineGameState, event: ScoringEvent): EngineGameState {
  if (game.over) return game;

  const lineup = battingLineup(game);
  if (lineup.rows.length === 0) return game;

  let result: EngineGameState;
  switch (event.type) {
    case 'BALL':
      result = handleBall(game);
      break;
    case 'STRIKE':
    case 'FOUL':
      result = handleStrike(game, event.type === 'FOUL');
      break;
    case 'STRIKEOUT':
      result = handleStrikeout(game);
      break;
    case 'WALK':
    case 'HIT_BY_PITCH':
      result = handleWalk(game);
      break;
    case 'SINGLE':
    case 'DOUBLE':
    case 'TRIPLE':
    case 'HOME_RUN':
      result = handleHit(game, event.type);
      break;
    case 'GROUNDOUT':
    case 'LINE_OUT':
      result = handleInPlayOut(game, event.type, event.fieldPos, event.doublePlay);
      break;
    case 'FLYOUT':
    case 'POP_OUT':
    case 'SACRIFICE_FLY':
      result = handleInPlayOut(game, event.type, event.fieldPos);
      break;
    case 'ERROR':
    case 'FIELDER_CHOICE':
      result = handleReachOnError(game, event.type, event.fieldPos);
      break;
    default:
      return game;
  }

  return endOnWalkOff(result);
}

function battingLineup(game: EngineGameState): EngineTeamLineup {
  return game.half === 'TOP' ? game.awayLineup : game.homeLineup;
}

function batterIndex(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayBatterIdx : game.homeBatterIdx;
}

function setBatterIndex(game: EngineGameState, value: number): EngineGameState {
  if (game.half === 'TOP') return { ...game, awayBatterIdx: value };
  return { ...game, homeBatterIdx: value };
}

function updateBatterStats(
  game: EngineGameState,
  update: (row: EngineScorebookRow) => EngineScorebookRow
): EngineGameState {
  const lineup = battingLineup(game);
  const rowIndex = batterIndex(game) % lineup.rows.length;
  const rows = lineup.rows.map((row, index) => (index === rowIndex ? update(row) : row));
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

function updateRunnerState(game: EngineGameState, state: RunnerState): EngineGameState {
  return { ...game, runners: state.runners, runnerSlots: state.runnerSlots };
}

function currentBatterSlot(game: EngineGameState): number {
  const lineup = battingLineup(game);
  return (batterIndex(game) % lineup.rows.length) + 1;
}

function setCurrentBatterCell(game: EngineGameState, cell: EngineAtBatCell): EngineGameState {
  const lineup = battingLineup(game);
  const rowIndex = batterIndex(game) % lineup.rows.length;
  const inningKey = String(game.inning);
  const rows = lineup.rows.map((row, index) => {
    if (index !== rowIndex) return row;
    return { ...row, innings: { ...row.innings, [inningKey]: cell } };
  });
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

function finalCell(
  game: EngineGameState,
  notation: string,
  base: number,
  outNum: number | null,
  opts: { run?: boolean; rbiCount?: number; advancements?: Advancement[] } = {}
): EngineAtBatCell {
  return {
    count: `${game.balls}-${game.strikes}`,
    notation,
    base,
    outNum,
    hasEndedInningLine: false,
    run: opts.run ?? false,
    rbiCount: opts.rbiCount ?? 0,
    advancements: opts.advancements,
  };
}

function handleBall(game: EngineGameState): EngineGameState {
  if (game.balls === 3) return handleWalk(game);
  return { ...game, balls: game.balls + 1 };
}

function handleStrike(game: EngineGameState, isFoul: boolean): EngineGameState {
  if (isFoul && game.strikes === 2) return game;
  if (game.strikes === 2) return handleStrikeout(game);
  return { ...game, strikes: game.strikes + 1 };
}

function handleStrikeout(game: EngineGameState): EngineGameState {
  const withCell = setCurrentBatterCell(game, {
    ...finalCell(game, 'K', 0, game.outs + 1),
    hasEndedInningLine: game.outs === 2,
  });
  return recordOut(advancePlate(recordAtBat(resetCounts(withCell))));
}

function handleWalk(game: EngineGameState): EngineGameState {
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, 1);
  const runsScored = countRunsScored(game.runners, 1);
  const placed = placeBatterState(advanced, 1, batterSlot);
  const withState = updateRunnerState(game, placed);
  const scored = addRuns(withState, runsScored);
  const withCell = setCurrentBatterCell(
    scored,
    finalCell(game, 'BB', 1, null, {
      rbiCount: runsScored,
      advancements: runnerAdvancementsForWalk(game.runners),
    })
  );
  const withStats = updateBatterStats(withCell, (row) => ({
    ...row,
    atBats: row.atBats + 1,
    walks: row.walks + 1,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleHit(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  const bases = hitBaseCount(eventType);
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, bases);
  const runsScored = countRunsScored(game.runners, bases);
  const placed = bases === 4 ? advanced : placeBatterState(advanced, bases, batterSlot);
  const withState = updateRunnerState(game, placed);
  const withRunnerRuns = addRuns(withState, runsScored);
  const withBatterRun = bases === 4 ? scoreRunForBatter(withRunnerRuns) : withRunnerRuns;
  const rbiCount = runsScored + (bases === 4 ? 1 : 0);
  const withCell = setCurrentBatterCell(
    withBatterRun,
    finalCell(game, hitNotation(eventType), bases === 4 ? 0 : bases, null, {
      run: bases === 4,
      rbiCount,
      advancements: runnerAdvancementsForHit(game.runners, bases),
    })
  );
  const withStats = updateBatterStats(withCell, (row) => ({
    ...row,
    atBats: row.atBats + 1,
    hits: row.hits + 1,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleInPlayOut(
  game: EngineGameState,
  eventType: ScoringEventType,
  fieldPos?: number,
  doublePlay?: boolean
): EngineGameState {
  const sacFly = eventType === 'SACRIFICE_FLY' || eventType === 'FLYOUT';
  const forceDoublePlay = Boolean(doublePlay) && game.outs <= 1 && game.runners[0] && !sacFly;
  const outsAdded = forceDoublePlay ? 2 : 1;
  const withCell = setCurrentBatterCell(resetCounts(game), {
    ...finalCell(game, inPlayOutNotation(eventType, fieldPos, forceDoublePlay), 0, game.outs + 1, {
      rbiCount: sacFly && game.runners[2] ? 1 : 0,
      advancements: sacFly ? runnerAdvancementsForSacrifice(game.runners) : undefined,
    }),
    hasEndedInningLine: game.outs + outsAdded >= 3,
  });
  const withAtBat = recordAtBat(withCell);
  if (forceDoublePlay) {
    const withoutLeadRunner = updateRunnerState(withAtBat, clearRunnerOnFirst(game));
    return recordOut(recordOut(advancePlate(withoutLeadRunner)));
  }
  if (sacFly) {
    return recordOut(advancePlate(scoreRunnerFromThird(withAtBat)));
  }
  return recordOut(advancePlate(withAtBat));
}

function handleReachOnError(game: EngineGameState, eventType: ScoringEventType, fieldPos?: number): EngineGameState {
  const notation = (eventType === 'ERROR' ? 'E' : 'FC') + (fieldPos ? String(fieldPos) : '');
  const charged = eventType === 'ERROR' ? chargeError(game) : game;
  const withCell = setCurrentBatterCell(charged, finalCell(game, notation, 1, null));
  return advancePlate(recordAtBat(resetCounts(withCell)));
}

function chargeError(game: EngineGameState): EngineGameState {
  if (game.half === 'TOP') return { ...game, homeErrors: game.homeErrors + 1 };
  return { ...game, awayErrors: game.awayErrors + 1 };
}

interface RunnerState {
  runners: RunnersOnBase;
  runnerSlots: RunnerSlots;
}

function advanceRunnerState(runners: RunnersOnBase, runnerSlots: RunnerSlots, bases: number): RunnerState {
  const nextRunners: RunnersOnBase = [false, false, false];
  const nextSlots: RunnerSlots = [null, null, null];
  for (const base of runnersOn(runners)) {
    const destination = base + bases;
    if (destination > 3) continue;
    nextRunners[destination - 1] = true;
    nextSlots[destination - 1] = runnerSlots[base - 1] ?? null;
  }
  return { runners: nextRunners, runnerSlots: nextSlots };
}

function placeBatterState(state: RunnerState, bases: number, batterSlot: number): RunnerState {
  if (bases === 4) return state;
  const nextRunners: RunnersOnBase = [...state.runners] as RunnersOnBase;
  const nextSlots: RunnerSlots = [...state.runnerSlots] as RunnerSlots;
  nextRunners[bases - 1] = true;
  nextSlots[bases - 1] = batterSlot;
  return { runners: nextRunners, runnerSlots: nextSlots };
}

function clearRunnerOnFirst(game: EngineGameState): RunnerState {
  return {
    runners: [false, game.runners[1], game.runners[2]],
    runnerSlots: [null, game.runnerSlots[1], game.runnerSlots[2]],
  };
}

function countRunsScored(runners: RunnersOnBase, bases: number): number {
  return runnersOn(runners).filter((base) => base + bases > 3).length;
}

function runnersOn(runners: RunnersOnBase): number[] {
  return runners.reduce<number[]>((indexes, occupied, index) => {
    if (occupied) indexes.push(index + 1);
    return indexes;
  }, []);
}

function addRuns(game: EngineGameState, runsScored: number): EngineGameState {
  if (runsScored <= 0) return game;
  const withScore = setTeamScore(game, teamScore(game) + runsScored);
  return updateBatterStats(withScore, (row) => ({ ...row, rbi: row.rbi + runsScored }));
}

function scoreRunForBatter(game: EngineGameState): EngineGameState {
  const withScore = setTeamScore(game, teamScore(game) + 1);
  return updateBatterStats(withScore, (row) => ({ ...row, runs: row.runs + 1, rbi: row.rbi + 1 }));
}

function scoreRunnerFromThird(game: EngineGameState): EngineGameState {
  if (!game.runners[2]) return game;
  const advanced = updateRunnerState(game, {
    runners: [game.runners[0], game.runners[1], false],
    runnerSlots: [game.runnerSlots[0], game.runnerSlots[1], null],
  });
  return scoreRunForBatter(advanced);
}

function recordAtBat(game: EngineGameState): EngineGameState {
  return updateBatterStats(game, (row) => ({ ...row, atBats: row.atBats + 1 }));
}

function recordOut(game: EngineGameState): EngineGameState {
  if (game.outs === 2) return flipInning({ ...game, outs: 3 });
  return { ...game, outs: game.outs + 1 };
}

function resetCounts(game: EngineGameState): EngineGameState {
  return { ...game, balls: 0, strikes: 0 };
}

function advancePlate(game: EngineGameState): EngineGameState {
  const lineup = battingLineup(game);
  const nextIndex = (batterIndex(game) + 1) % lineup.rows.length;
  return setBatterIndex(game, nextIndex);
}

function flipInning(game: EngineGameState): EngineGameState {
  const completedHalf = game.half;
  const completedInning = game.inning;
  const flipped: EngineGameState = {
    ...game,
    outs: 0,
    runners: [false, false, false],
    runnerSlots: [null, null, null],
    balls: 0,
    strikes: 0,
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    half: game.half === 'TOP' ? 'BOTTOM' : 'TOP',
    inning: game.half === 'BOTTOM' ? game.inning + 1 : game.inning,
  };
  if (isGameOverAfter(flipped, completedHalf, completedInning)) return { ...flipped, over: true };
  return flipped;
}

function isGameOverAfter(game: EngineGameState, completedHalf: BattingHalf, completedInning: number): boolean {
  if (completedInning < game.totalInnings) return false;
  if (completedHalf === 'TOP') return game.homeScore > game.awayScore;
  return game.homeScore !== game.awayScore;
}

function endOnWalkOff(game: EngineGameState): EngineGameState {
  if (game.over) return game;
  if (game.half !== 'BOTTOM') return game;
  if (game.inning < game.totalInnings) return game;
  if (game.homeScore <= game.awayScore) return game;
  return { ...game, over: true };
}

function teamScore(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayScore : game.homeScore;
}

function setTeamScore(game: EngineGameState, value: number): EngineGameState {
  const delta = value - teamScore(game);
  if (delta <= 0) return game;
  if (game.half === 'TOP') {
    const awayRunsByInning = [...game.awayRunsByInning];
    awayRunsByInning[game.inning - 1] = (awayRunsByInning[game.inning - 1] ?? 0) + delta;
    return { ...game, awayScore: value, awayRunsByInning };
  }
  const homeRunsByInning = [...game.homeRunsByInning];
  homeRunsByInning[game.inning - 1] = (homeRunsByInning[game.inning - 1] ?? 0) + delta;
  return { ...game, homeScore: value, homeRunsByInning };
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
