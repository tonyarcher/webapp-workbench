import type { EngineGameState, EngineScorebookRow, EngineTeamLineup, LineupAssignment, RunnerSlots, RunnersOnBase, RunnerInnings } from './rule-engine';
import type { Advancement } from './notation';

export interface RunnerState {
  runners: RunnersOnBase;
  runnerSlots: RunnerSlots;
  runnerInnings: RunnerInnings;
}

export function createTeamLineup(name: string, lineup: LineupAssignment[], pitcherName?: string): EngineTeamLineup {
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

export function resolvePitcherName(teamName: string, lineup: LineupAssignment[], explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromOrder = lineup.find((player) => player.position === 'P');
  return fromOrder?.batterName ?? `${teamName} pitcher`;
}

export function battingLineup(game: EngineGameState): EngineTeamLineup {
  return game.half === 'TOP' ? game.awayLineup : game.homeLineup;
}

export function batterIndex(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayBatterIdx : game.homeBatterIdx;
}

export function setBatterIndex(game: EngineGameState, value: number): EngineGameState {
  if (game.half === 'TOP') return { ...game, awayBatterIdx: value };
  return { ...game, homeBatterIdx: value };
}

export function updateBatterStats(
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

export function updateRunnerState(game: EngineGameState, state: RunnerState): EngineGameState {
  return { ...game, runners: state.runners, runnerSlots: state.runnerSlots, runnerInnings: state.runnerInnings };
}

export function currentBatterSlot(game: EngineGameState): number {
  const lineup = battingLineup(game);
  return (batterIndex(game) % lineup.rows.length) + 1;
}

export function setCurrentBatterCell(game: EngineGameState, cell: import('./rule-engine').EngineAtBatCell): EngineGameState {
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

export function finalCell(
  game: EngineGameState,
  notation: string,
  base: number,
  outNum: number | null,
  opts: { run?: boolean; rbiCount?: number } = {}
): import('./rule-engine').EngineAtBatCell {
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

export function ensureRunnerInnings(game: EngineGameState): EngineGameState {
  if (game.runnerInnings) return game;
  const runnerInnings: RunnerInnings = [null, null, null];
  for (const base of runnersOn(game.runners)) {
    runnerInnings[base - 1] = game.inning;
  }
  return { ...game, runnerInnings };
}

export function advanceRunnerState(
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

export function placeBatterState(state: RunnerState, bases: number, batterSlot: number, inning: number): RunnerState {
  if (bases === 4) return state;
  const nextRunners: RunnersOnBase = [...state.runners] as RunnersOnBase;
  const nextSlots: RunnerSlots = [...state.runnerSlots] as RunnerSlots;
  const nextInnings: RunnerInnings = [...state.runnerInnings] as RunnerInnings;
  nextRunners[bases - 1] = true;
  nextSlots[bases - 1] = batterSlot;
  nextInnings[bases - 1] = inning;
  return { runners: nextRunners, runnerSlots: nextSlots, runnerInnings: nextInnings };
}

export function clearRunnerOnFirst(game: EngineGameState): RunnerState {
  return {
    runners: [false, game.runners[1], game.runners[2]],
    runnerSlots: [null, game.runnerSlots[1], game.runnerSlots[2]],
    runnerInnings: [null, game.runnerInnings[1], game.runnerInnings[2]],
  };
}

export function applyRunnerAdvancements(
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

export function appendAdvancement(game: EngineGameState, slot: number, inning: number, advancement: Advancement): EngineGameState {
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

export function countRunsScored(runners: RunnersOnBase, bases: number): number {
  return runnersOn(runners).filter((base) => base + bases > 3).length;
}

export function runnersOn(runners: RunnersOnBase): number[] {
  return runners.reduce<number[]>((indexes, occupied, index) => {
    if (occupied) indexes.push(index + 1);
    return indexes;
  }, []);
}

export function addTeamScore(game: EngineGameState, runsScored: number): EngineGameState {
  if (runsScored <= 0) return game;
  return setTeamScore(game, teamScore(game) + runsScored);
}

export function creditRunToSlot(game: EngineGameState, slot: number | null): EngineGameState {
  if (slot == null) return game;
  const lineup = battingLineup(game);
  const rows = lineup.rows.map((row) => (row.slotIdx === slot ? { ...row, runs: row.runs + 1 } : row));
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

export function creditPlateAppearanceRuns(
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

export function scoreRunnerFromThird(game: EngineGameState): EngineGameState {
  if (!game.runners[2]) return game;
  const slot = game.runnerSlots[2];
  const advanced = updateRunnerState(game, {
    runners: [game.runners[0], game.runners[1], false],
    runnerSlots: [game.runnerSlots[0], game.runnerSlots[1], null],
    runnerInnings: [game.runnerInnings[0], game.runnerInnings[1], null],
  });
  const withArc = applyRunnerAdvancements(
    advanced,
    [{ from: 3, to: 4, scored: true }],
    game.runnerSlots,
    game.runnerInnings
  );
  const withScore = addTeamScore(withArc, 1);
  const withRunner = creditRunToSlot(withScore, slot);
  return updateBatterStats(withRunner, (row) => ({ ...row, rbi: row.rbi + 1 }));
}

export function recordAtBat(game: EngineGameState): EngineGameState {
  return updateBatterStats(game, (row) => ({ ...row, atBats: row.atBats + 1 }));
}

export function recordOut(game: EngineGameState): EngineGameState {
  if (game.outs === 2) return flipInning({ ...game, outs: 3 });
  return { ...game, outs: game.outs + 1 };
}

export function resetCounts(game: EngineGameState): EngineGameState {
  return { ...game, balls: 0, strikes: 0 };
}

export function advancePlate(game: EngineGameState): EngineGameState {
  const lineup = battingLineup(game);
  const nextIndex = (batterIndex(game) + 1) % lineup.rows.length;
  return setBatterIndex(game, nextIndex);
}

export function flipInning(game: EngineGameState): EngineGameState {
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

function isGameOverAfter(game: EngineGameState, completedHalf: import('./rule-engine').BattingHalf, completedInning: number): boolean {
  if (completedInning < game.totalInnings) return false;
  if (completedHalf === 'TOP') return game.homeScore > game.awayScore;
  return game.homeScore !== game.awayScore;
}

export function endOnWalkOff(game: EngineGameState): EngineGameState {
  if (game.over) return game;
  if (game.half !== 'BOTTOM') return game;
  if (game.inning < game.totalInnings) return game;
  if (game.homeScore <= game.awayScore) return game;
  return { ...game, over: true };
}

export function teamScore(game: EngineGameState): number {
  return game.half === 'TOP' ? game.awayScore : game.homeScore;
}

export function setTeamScore(game: EngineGameState, value: number): EngineGameState {
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

export function clearBase(game: EngineGameState, base: number): EngineGameState {
  const runners = [...game.runners] as RunnersOnBase;
  const runnerSlots = [...game.runnerSlots] as RunnerSlots;
  const runnerInnings = [...game.runnerInnings] as RunnerInnings;
  runners[base - 1] = false;
  runnerSlots[base - 1] = null;
  runnerInnings[base - 1] = null;
  return updateRunnerState(game, { runners, runnerSlots, runnerInnings });
}

export function occupyBase(
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

export function applyStealArc(
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

function runnerAdvancementsForSteal(from: number, to: number) {
  if (from < 1 || from > 3) return [];
  const destination = to > 3 ? 4 : to;
  return [{ from, to: destination, scored: destination === 4 }];
}

export function chargeError(game: EngineGameState): EngineGameState {
  if (game.half === 'TOP') return { ...game, homeErrors: game.homeErrors + 1 };
  return { ...game, awayErrors: game.awayErrors + 1 };
}

export function stealFromBase(toBase: number | undefined): number | null {
  if (toBase === 2 || toBase === 3) return toBase - 1;
  if (toBase === 4) return 3;
  return null;
}
