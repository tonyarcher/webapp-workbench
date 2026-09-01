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
  advancements?: Advancement[];
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

import { hitBaseCount, hitNotation, inPlayOutNotation } from './notation';
import {
  runnerAdvancementsForHit,
  runnerAdvancementsForSacrifice,
  runnerAdvancementsForSteal,
  runnerAdvancementsForWalk,
} from './notation';
import type { Advancement } from './notation';

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

function createTeamLineup(name: string, lineup: LineupAssignment[], pitcherName?: string): EngineTeamLineup {
  const rows = lineup.map((player, index) => ({
    slotIdx: index + 1,
    batterName: player.batterName,
    position: player.position,
    jerseyNumber: player.jerseyNumber ?? 0,
    atBats: 0,
    runs: 0,
    hits: 0,
    rbi: 0,
    walks: 0,
    innings: {},
  }));
  return { name, pitcherName: resolvePitcherName(name, lineup, pitcherName), rows };
}

function resolvePitcherName(teamName: string, lineup: LineupAssignment[], explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromOrder = lineup.find((player) => player.position === 'P');
  return fromOrder?.batterName ?? `${teamName} pitcher`;
}

export function reduceGame(game: EngineGameState, event: ScoringEvent): EngineGameState {
  if (game.over) return game;
  game = ensureRunnerInnings(game);

  if (event.type === 'SET_LINEUP') {
    return handleSetLineup(game, event);
  }

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
      result = handleWalk(game, event.type);
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
    case 'SACRIFICE_BUNT':
      result = handleSacrificeBunt(game, event.fieldPos);
      break;
    case 'ERROR':
    case 'FIELDER_CHOICE':
      result = handleReachOnError(game, event.type, event.fieldPos);
      break;
    case 'STOLEN_BASE':
      result = handleStolenBase(game, event.base);
      break;
    case 'CAUGHT_STEALING':
      result = handleCaughtStealing(game, event.base);
      break;
    case 'WILD_PITCH':
    case 'PASSED_BALL':
    case 'BALK':
      result = handleWildAdvance(game, event.type);
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
  return { ...game, runners: state.runners, runnerSlots: state.runnerSlots, runnerInnings: state.runnerInnings };
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
  opts: { run?: boolean; rbiCount?: number } = {}
): EngineAtBatCell {
  return {
    count: `${game.balls}-${game.strikes}`,
    notation,
    base,
    outNum,
    hasEndedInningLine: false,
    run: opts.run ?? false,
    rbiCount: opts.rbiCount ?? 0,
  };
}

function handleBall(game: EngineGameState): EngineGameState {
  if (game.balls === 3) return handleWalk(game, 'WALK');
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

function handleWalk(game: EngineGameState, eventType: 'WALK' | 'HIT_BY_PITCH'): EngineGameState {
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, 1);
  const runsScored = countRunsScored(game.runners, 1);
  const placed = placeBatterState(advanced, 1, batterSlot, game.inning);
  const withState = updateRunnerState(game, placed);
  const scored = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, 1, 0);
  const withArcs = applyRunnerAdvancements(
    scored,
    runnerAdvancementsForWalk(game.runners),
    game.runnerSlots,
    game.runnerInnings
  );
  const notation = eventType === 'HIT_BY_PITCH' ? 'HBP' : 'BB';
  const withCell = setCurrentBatterCell(withArcs, finalCell(game, notation, 1, null, { rbiCount: runsScored }));
  const withStats = updateBatterStats(withCell, (row) => ({
    ...row,
    walks: eventType === 'WALK' ? row.walks + 1 : row.walks,
    rbi: row.rbi + runsScored,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleHit(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  const bases = hitBaseCount(eventType);
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, bases);
  const runsScored = countRunsScored(game.runners, bases);
  const placed = bases === 4 ? advanced : placeBatterState(advanced, bases, batterSlot, game.inning);
  const withState = updateRunnerState(game, placed);
  const batterRun = bases === 4 ? 1 : 0;
  const withRunnerRuns = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, bases, batterRun);
  const withBatterRun = batterRun ? creditRunToSlot(withRunnerRuns, batterSlot) : withRunnerRuns;
  const withArcs = applyRunnerAdvancements(
    withBatterRun,
    runnerAdvancementsForHit(game.runners, bases),
    game.runnerSlots,
    game.runnerInnings
  );
  const rbiCount = runsScored + batterRun;
  const withCell = setCurrentBatterCell(
    withArcs,
    finalCell(game, hitNotation(eventType), bases === 4 ? 0 : bases, null, {
      run: bases === 4,
      rbiCount,
    })
  );
  const withStats = updateBatterStats(withCell, (row) => ({
    ...row,
    atBats: row.atBats + 1,
    hits: row.hits + 1,
    rbi: row.rbi + rbiCount,
  }));
  return advancePlate(resetCounts(withStats));
}

function handleInPlayOut(
  game: EngineGameState,
  eventType: ScoringEventType,
  fieldPos?: number,
  doublePlay?: boolean
): EngineGameState {
  const sacFly = eventType === 'SACRIFICE_FLY';
  const forceDoublePlay = Boolean(doublePlay) && game.outs <= 1 && game.runners[0] && !sacFly;
  const outsAdded = forceDoublePlay ? 2 : 1;
  const withCell = setCurrentBatterCell(resetCounts(game), {
    ...finalCell(game, inPlayOutNotation(eventType, fieldPos, forceDoublePlay), 0, game.outs + 1, {
      rbiCount: sacFly && game.runners[2] ? 1 : 0,
    }),
    hasEndedInningLine: game.outs + outsAdded >= 3,
  });
  const withAtBat = sacFly ? withCell : recordAtBat(withCell);
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
  const batterSlot = currentBatterSlot(charged);
  if (eventType === 'FIELDER_CHOICE') {
    // The fielder retires the forced runner on first; the batter is safe at first.
    const cleared = updateRunnerState(charged, clearRunnerOnFirst(charged));
    const placed = placeBatterState(
      { runners: cleared.runners, runnerSlots: cleared.runnerSlots, runnerInnings: cleared.runnerInnings },
      1,
      batterSlot,
      cleared.inning
    );
    const withState = updateRunnerState(cleared, placed);
    const withCell = setCurrentBatterCell(withState, finalCell(game, notation, 1, null));
    return advancePlate(recordAtBat(resetCounts(withCell)));
  }
  // Error: every runner advances safely, like a walk.
  const advanced = advanceRunnerState(charged.runners, charged.runnerSlots, charged.runnerInnings, 1);
  const runsScored = countRunsScored(charged.runners, 1);
  const placed = placeBatterState(advanced, 1, batterSlot, charged.inning);
  const withState = updateRunnerState(charged, placed);
  const withRuns = creditPlateAppearanceRuns(withState, charged.runners, charged.runnerSlots, 1, 0);
  const withRbi = updateBatterStats(withRuns, (row) => ({ ...row, rbi: row.rbi + runsScored }));
  const withArcs = applyRunnerAdvancements(
    withRbi,
    runnerAdvancementsForWalk(charged.runners),
    charged.runnerSlots,
    charged.runnerInnings
  );
  const withCell = setCurrentBatterCell(withArcs, finalCell(game, notation, 1, null, { rbiCount: runsScored }));
  return advancePlate(recordAtBat(resetCounts(withCell)));
}

function handleSetLineup(game: EngineGameState, event: ScoringEvent): EngineGameState {
  return {
    ...game,
    homeLineup: overlayLineup(game.homeLineup, event.homeLineup, event.homePitcherName),
    awayLineup: overlayLineup(game.awayLineup, event.awayLineup, event.awayPitcherName),
  };
}

function overlayLineup(
  lineup: EngineTeamLineup,
  incoming: LineupAssignment[] | undefined,
  pitcherName?: string
): EngineTeamLineup {
  if (!incoming || incoming.length === 0) {
    const nextPitcher = pitcherName?.trim();
    return nextPitcher ? { ...lineup, pitcherName: nextPitcher } : lineup;
  }
  const rows = lineup.rows.map((row, index) => {
    const src = incoming[index];
    if (!src) return row;
    return {
      ...row,
      batterName: src.batterName.trim() || row.batterName,
      position: src.position.trim() || row.position,
      jerseyNumber: src.jerseyNumber ?? row.jerseyNumber ?? 0,
    };
  });
  return {
    ...lineup,
    rows,
    pitcherName: resolvePitcherName(lineup.name, incoming, pitcherName ?? lineup.pitcherName),
  };
}

function handleSacrificeBunt(game: EngineGameState, fieldPos?: number): EngineGameState {
  const notation = inPlayOutNotation('SACRIFICE_BUNT', fieldPos);
  const endsInning = game.outs >= 2;
  const withCell = setCurrentBatterCell(game, {
    ...finalCell(game, notation, 0, game.outs + 1, {
      rbiCount: !endsInning && game.runners[2] ? 1 : 0,
    }),
    hasEndedInningLine: endsInning,
  });
  if (endsInning) {
    return recordOut(advancePlate(resetCounts(withCell)));
  }
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, 1);
  const runsScored = countRunsScored(game.runners, 1);
  const withState = updateRunnerState(withCell, advanced);
  const withRuns = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, 1, 0);
  const withRbi = updateBatterStats(withRuns, (row) => ({ ...row, rbi: row.rbi + runsScored }));
  const withArcs = applyRunnerAdvancements(
    withRbi,
    runnerAdvancementsForWalk(game.runners),
    game.runnerSlots,
    game.runnerInnings
  );
  return recordOut(advancePlate(resetCounts(withArcs)));
}

function stealFromBase(toBase: number | undefined): number | null {
  if (toBase === 2 || toBase === 3) return toBase - 1;
  if (toBase === 4) return 3;
  return null;
}

function handleStolenBase(game: EngineGameState, toBase?: number): EngineGameState {
  const from = stealFromBase(toBase);
  if (from == null) return game;
  if (!game.runners[from - 1]) return game;
  const destination = toBase === 4 ? 4 : (toBase as number);
  if (destination <= 3 && game.runners[destination - 1]) return game;
  const slot = game.runnerSlots[from - 1];
  const originInning = game.runnerInnings[from - 1];
  const next = clearBase(game, from);
  if (destination === 4) {
    const scored = addTeamScore(next, 1);
    const withRunner = creditRunToSlot(scored, slot);
    return applyStealArc(withRunner, slot, originInning, from, 4);
  }
  const occupied = occupyBase(next, destination, slot, originInning);
  return applyStealArc(occupied, slot, originInning, from, destination);
}

function handleCaughtStealing(game: EngineGameState, toBase?: number): EngineGameState {
  const from = stealFromBase(toBase);
  if (from == null) return game;
  if (!game.runners[from - 1]) return game;
  const destination = toBase === 4 ? 4 : (toBase as number);
  const slot = game.runnerSlots[from - 1];
  const originInning = game.runnerInnings[from - 1];
  const marked = markCaughtStealingCell(game, slot, originInning, from, destination);
  const cleared = clearBase(marked, from);
  return recordOut(cleared);
}

function markCaughtStealingCell(
  game: EngineGameState,
  slot: number | null,
  originInning: number | null,
  from: number,
  to: number
): EngineGameState {
  if (slot == null || originInning == null) return game;
  const destination = to > 3 ? 4 : to;
  const withArc = appendAdvancement(game, slot, originInning, { from, to: destination, scored: false });
  const lineup = battingLineup(withArc);
  const key = String(originInning);
  const rows = lineup.rows.map((row) => {
    if (row.slotIdx !== slot) return row;
    const cell = row.innings[key];
    if (!cell) return row;
    const notation = cell.notation.endsWith(' CS') ? cell.notation : `${cell.notation} CS`.trim();
    return {
      ...row,
      innings: {
        ...row.innings,
        [key]: {
          ...cell,
          notation,
          outNum: game.outs + 1,
          hasEndedInningLine: game.outs >= 2,
        },
      },
    };
  });
  const updatedLineup = { ...lineup, rows };
  if (withArc.half === 'TOP') return { ...withArc, awayLineup: updatedLineup };
  return { ...withArc, homeLineup: updatedLineup };
}

function handleWildAdvance(game: EngineGameState, eventType: 'WILD_PITCH' | 'PASSED_BALL' | 'BALK'): EngineGameState {
  void eventType;
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, 1);
  const withState = updateRunnerState(game, advanced);
  const withRuns = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, 1, 0);
  return applyRunnerAdvancements(
    withRuns,
    runnerAdvancementsForWalk(game.runners),
    game.runnerSlots,
    game.runnerInnings
  );
}

function clearBase(game: EngineGameState, base: number): EngineGameState {
  const runners = [...game.runners] as RunnersOnBase;
  const runnerSlots = [...game.runnerSlots] as RunnerSlots;
  const runnerInnings = [...game.runnerInnings] as RunnerInnings;
  runners[base - 1] = false;
  runnerSlots[base - 1] = null;
  runnerInnings[base - 1] = null;
  return updateRunnerState(game, { runners, runnerSlots, runnerInnings });
}

function occupyBase(
  game: EngineGameState,
  base: number,
  slot: number | null,
  originInning: number | null
): EngineGameState {
  const runners = [...game.runners] as RunnersOnBase;
  const runnerSlots = [...game.runnerSlots] as RunnerSlots;
  const runnerInnings = [...game.runnerInnings] as RunnerInnings;
  runners[base - 1] = true;
  runnerSlots[base - 1] = slot;
  runnerInnings[base - 1] = originInning;
  return updateRunnerState(game, { runners, runnerSlots, runnerInnings });
}

function applyStealArc(
  game: EngineGameState,
  slot: number | null,
  originInning: number | null,
  from: number,
  to: number
): EngineGameState {
  if (slot == null || originInning == null) return game;
  const [advancement] = runnerAdvancementsForSteal(from, to);
  if (!advancement) return game;
  return appendAdvancement(game, slot, originInning, advancement);
}

function chargeError(game: EngineGameState): EngineGameState {
  if (game.half === 'TOP') return { ...game, homeErrors: game.homeErrors + 1 };
  return { ...game, awayErrors: game.awayErrors + 1 };
}

interface RunnerState {
  runners: RunnersOnBase;
  runnerSlots: RunnerSlots;
  runnerInnings: RunnerInnings;
}

function ensureRunnerInnings(game: EngineGameState): EngineGameState {
  if (game.runnerInnings) return game;
  // Old saves predate runnerInnings. Any runner on base must have reached it
  // this inning (inning flips clear the bases), so their origin inning is the
  // current one.
  const runnerInnings: RunnerInnings = [null, null, null];
  for (const base of runnersOn(game.runners)) {
    runnerInnings[base - 1] = game.inning;
  }
  return { ...game, runnerInnings };
}

function advanceRunnerState(
  runners: RunnersOnBase,
  runnerSlots: RunnerSlots,
  runnerInnings: RunnerInnings,
  bases: number
): RunnerState {
  const nextRunners: RunnersOnBase = [false, false, false];
  const nextSlots: RunnerSlots = [null, null, null];
  const nextInnings: RunnerInnings = [null, null, null];
  for (const base of runnersOn(runners)) {
    const destination = base + bases;
    if (destination > 3) continue;
    nextRunners[destination - 1] = true;
    nextSlots[destination - 1] = runnerSlots[base - 1] ?? null;
    nextInnings[destination - 1] = runnerInnings[base - 1] ?? null;
  }
  return { runners: nextRunners, runnerSlots: nextSlots, runnerInnings: nextInnings };
}

function placeBatterState(state: RunnerState, bases: number, batterSlot: number, inning: number): RunnerState {
  if (bases === 4) return state;
  const nextRunners: RunnersOnBase = [...state.runners] as RunnersOnBase;
  const nextSlots: RunnerSlots = [...state.runnerSlots] as RunnerSlots;
  const nextInnings: RunnerInnings = [...state.runnerInnings] as RunnerInnings;
  nextRunners[bases - 1] = true;
  nextSlots[bases - 1] = batterSlot;
  nextInnings[bases - 1] = inning;
  return { runners: nextRunners, runnerSlots: nextSlots, runnerInnings: nextInnings };
}

function clearRunnerOnFirst(game: EngineGameState): RunnerState {
  return {
    runners: [false, game.runners[1], game.runners[2]],
    runnerSlots: [null, game.runnerSlots[1], game.runnerSlots[2]],
    runnerInnings: [null, game.runnerInnings[1], game.runnerInnings[2]],
  };
}

function applyRunnerAdvancements(
  game: EngineGameState,
  advancements: Advancement[],
  runnerSlots: RunnerSlots,
  runnerInnings: RunnerInnings
): EngineGameState {
  let result = game;
  for (const advancement of advancements) {
    const slot = runnerSlots[advancement.from - 1];
    const inning = runnerInnings[advancement.from - 1];
    if (slot == null || inning == null) continue;
    result = appendAdvancement(result, slot, inning, advancement);
  }
  return result;
}

function appendAdvancement(game: EngineGameState, slot: number, inning: number, advancement: Advancement): EngineGameState {
  const lineup = battingLineup(game);
  const rowIndex = lineup.rows.findIndex((row) => row.slotIdx === slot);
  if (rowIndex < 0) return game;
  const key = String(inning);
  const rows = lineup.rows.map((row, index) => {
    if (index !== rowIndex) return row;
    const cell = row.innings[key];
    if (!cell) return row;
    return {
      ...row,
      innings: {
        ...row.innings,
        [key]: { ...cell, advancements: [...(cell.advancements ?? []), advancement] },
      },
    };
  });
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
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

function addTeamScore(game: EngineGameState, runsScored: number): EngineGameState {
  if (runsScored <= 0) return game;
  return setTeamScore(game, teamScore(game) + runsScored);
}

function creditRunToSlot(game: EngineGameState, slot: number | null): EngineGameState {
  if (slot == null) return game;
  const lineup = battingLineup(game);
  const rows = lineup.rows.map((row) => (row.slotIdx === slot ? { ...row, runs: row.runs + 1 } : row));
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

function creditPlateAppearanceRuns(
  game: EngineGameState,
  runners: RunnersOnBase,
  runnerSlots: RunnerSlots,
  bases: number,
  extraRuns: number
): EngineGameState {
  let result = addTeamScore(game, countRunsScored(runners, bases) + extraRuns);
  for (const base of runnersOn(runners)) {
    if (base + bases > 3) {
      result = creditRunToSlot(result, runnerSlots[base - 1]);
    }
  }
  return result;
}

function scoreRunnerFromThird(game: EngineGameState): EngineGameState {
  if (!game.runners[2]) return game;
  const slot = game.runnerSlots[2];
  const advanced = updateRunnerState(game, {
    runners: [game.runners[0], game.runners[1], false],
    runnerSlots: [game.runnerSlots[0], game.runnerSlots[1], null],
    runnerInnings: [game.runnerInnings[0], game.runnerInnings[1], null],
  });
  const withArc = applyRunnerAdvancements(
    advanced,
    runnerAdvancementsForSacrifice(game.runners),
    game.runnerSlots,
    game.runnerInnings
  );
  const withScore = addTeamScore(withArc, 1);
  const withRunner = creditRunToSlot(withScore, slot);
  return updateBatterStats(withRunner, (row) => ({ ...row, rbi: row.rbi + 1 }));
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
    runnerInnings: [null, null, null],
    balls: 0,
    strikes: 0,
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
