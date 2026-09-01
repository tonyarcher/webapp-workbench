import type { EngineGameState, ScoringEvent, ScoringEventType } from './rule-engine';
import { hitBaseCount, hitNotation, inPlayOutNotation } from './notation';
import {
  runnerAdvancementsForHit,
  runnerAdvancementsForWalk,
} from './notation';
import {
  addTeamScore,
  advanceRunnerState,
  applyRunnerAdvancements,
  applyStealArc,
  appendAdvancement,
  battingLineup,
  chargeError,
  clearBase,
  clearRunnerOnFirst,
  countRunsScored,
  creditPlateAppearanceRuns,
  creditRunToSlot,
  currentBatterSlot,
  finalCell,
  occupyBase,
  placeBatterState,
  recordAtBat,
  recordOut,
  resetCounts,
  resolvePitcherName,
  advancePlate,
  scoreRunnerFromThird,
  setCurrentBatterCell,
  stealFromBase,
  updateBatterStats,
  updateRunnerState,
} from './rule-engine-helpers';

export function handleBall(game: EngineGameState): EngineGameState {
  if (game.balls === 3) return handleWalk(game, 'WALK');
  return { ...game, balls: game.balls + 1 };
}

export function handleStrike(game: EngineGameState, isFoul: boolean): EngineGameState {
  if (isFoul && game.strikes === 2) return game;
  if (game.strikes === 2) return handleStrikeout(game);
  return { ...game, strikes: game.strikes + 1 };
}

export function handleStrikeout(game: EngineGameState): EngineGameState {
  const withCell = setCurrentBatterCell(game, {
    ...finalCell(game, 'K', 0, game.outs + 1),
    hasEndedInningLine: game.outs === 2,
  });
  return recordOut(advancePlate(recordAtBat(resetCounts(withCell))));
}

export function handleWalk(game: EngineGameState, eventType: 'WALK' | 'HIT_BY_PITCH'): EngineGameState {
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, 1);
  const runsScored = countRunsScored(game.runners, 1);
  const placed = placeBatterState(advanced, 1, batterSlot, game.inning);
  const withState = updateRunnerState(game, placed);
  const scored = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, 1, 0);
  const withArcs = applyRunnerAdvancements(scored, runnerAdvancementsForWalk(game.runners), game.runnerSlots, game.runnerInnings);
  const notation = eventType === 'HIT_BY_PITCH' ? 'HBP' : 'BB';
  const withCell = setCurrentBatterCell(withArcs, finalCell(game, notation, 1, null, { rbiCount: runsScored }));
  const withStats = updateBatterStats(withCell, (row) => ({
    ...row,
    walks: eventType === 'WALK' ? row.walks + 1 : row.walks,
    rbi: row.rbi + runsScored,
  }));
  return advancePlate(resetCounts(withStats));
}

function recordHitStats(
  result: EngineGameState,
  pre: EngineGameState,
  eventType: ScoringEventType,
  bases: number,
  rbiCount: number
): EngineGameState {
  const withArcs = applyRunnerAdvancements(result, runnerAdvancementsForHit(pre.runners, bases), pre.runnerSlots, pre.runnerInnings);
  const cell = finalCell(pre, hitNotation(eventType), bases === 4 ? 0 : bases, null, { run: bases === 4, rbiCount });
  const withStats = updateBatterStats(setCurrentBatterCell(withArcs, cell), (row) => ({
    ...row,
    atBats: row.atBats + 1,
    hits: row.hits + 1,
    rbi: row.rbi + rbiCount,
  }));
  return advancePlate(resetCounts(withStats));
}

export function handleHit(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  const bases = hitBaseCount(eventType);
  const batterSlot = currentBatterSlot(game);
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, bases);
  const placed = bases === 4 ? advanced : placeBatterState(advanced, bases, batterSlot, game.inning);
  const batterRun = bases === 4 ? 1 : 0;
  const withState = updateRunnerState(game, placed);
  const withRunnerRuns = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, bases, batterRun);
  const withBatterRun = batterRun ? creditRunToSlot(withRunnerRuns, batterSlot) : withRunnerRuns;
  return recordHitStats(withBatterRun, game, eventType, bases, countRunsScored(game.runners, bases) + batterRun);
}

export function handleInPlayOut(
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
  if (forceDoublePlay) return handleForceDoublePlay(withAtBat, game);
  if (sacFly) return recordOut(advancePlate(scoreRunnerFromThird(withAtBat)));
  return recordOut(advancePlate(withAtBat));
}

function handleForceDoublePlay(withAtBat: EngineGameState, pre: EngineGameState): EngineGameState {
  const withoutLeadRunner = updateRunnerState(withAtBat, clearRunnerOnFirst(pre));
  return recordOut(recordOut(advancePlate(withoutLeadRunner)));
}

export function handleReachOnError(game: EngineGameState, eventType: ScoringEventType, fieldPos?: number): EngineGameState {
  const notation = (eventType === 'ERROR' ? 'E' : 'FC') + (fieldPos ? String(fieldPos) : '');
  if (eventType === 'FIELDER_CHOICE') return handleFielderChoice(game, notation);
  return handleErrorReach(game, notation);
}

function handleErrorReach(game: EngineGameState, notation: string): EngineGameState {
  const charged = chargeError(game);
  const batterSlot = currentBatterSlot(charged);
  const advanced = advanceRunnerState(charged.runners, charged.runnerSlots, charged.runnerInnings, 1);
  const runsScored = countRunsScored(charged.runners, 1);
  const placed = placeBatterState(advanced, 1, batterSlot, charged.inning);
  const withState = updateRunnerState(charged, placed);
  const withRuns = creditPlateAppearanceRuns(withState, charged.runners, charged.runnerSlots, 1, 0);
  const withRbi = updateBatterStats(withRuns, (row) => ({ ...row, rbi: row.rbi + runsScored }));
  const withArcs = applyRunnerAdvancements(withRbi, runnerAdvancementsForWalk(charged.runners), charged.runnerSlots, charged.runnerInnings);
  const withCell = setCurrentBatterCell(withArcs, finalCell(game, notation, 1, null, { rbiCount: runsScored }));
  return advancePlate(recordAtBat(resetCounts(withCell)));
}

function handleFielderChoice(game: EngineGameState, notation: string): EngineGameState {
  const batterSlot = currentBatterSlot(game);
  const cleared = updateRunnerState(game, clearRunnerOnFirst(game));
  const placed = placeBatterState(
    { runners: cleared.runners, runnerSlots: cleared.runnerSlots, runnerInnings: cleared.runnerInnings },
    1,
    batterSlot,
    cleared.inning
  );
  const withCell = setCurrentBatterCell(updateRunnerState(cleared, placed), finalCell(game, notation, 1, null));
  return advancePlate(recordAtBat(resetCounts(withCell)));
}

export function handleSetLineup(game: EngineGameState, event: ScoringEvent): EngineGameState {
  return {
    ...game,
    homeLineup: overlayLineup(game.homeLineup, event.homeLineup, event.homePitcherName),
    awayLineup: overlayLineup(game.awayLineup, event.awayLineup, event.awayPitcherName),
  };
}

function overlayLineup(
  lineup: EngineGameState['homeLineup'],
  incoming: import('./rule-engine').LineupAssignment[] | undefined,
  pitcherName?: string
): EngineGameState['homeLineup'] {
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

export function handleSacrificeBunt(game: EngineGameState, fieldPos?: number): EngineGameState {
  const notation = inPlayOutNotation('SACRIFICE_BUNT', fieldPos);
  const endsInning = game.outs >= 2;
  const withCell = setCurrentBatterCell(game, {
    ...finalCell(game, notation, 0, game.outs + 1, {
      rbiCount: !endsInning && game.runners[2] ? 1 : 0,
    }),
    hasEndedInningLine: endsInning,
  });
  if (endsInning) return recordOut(advancePlate(resetCounts(withCell)));
  return handleSacBuntAdvance(withCell, game);
}

function handleSacBuntAdvance(withCell: EngineGameState, pre: EngineGameState): EngineGameState {
  const advanced = advanceRunnerState(pre.runners, pre.runnerSlots, pre.runnerInnings, 1);
  const withState = updateRunnerState(withCell, advanced);
  const withRuns = creditPlateAppearanceRuns(withState, pre.runners, pre.runnerSlots, 1, 0);
  const runsScored = countRunsScored(pre.runners, 1);
  const withRbi = updateBatterStats(withRuns, (row) => ({ ...row, rbi: row.rbi + runsScored }));
  const withArcs = applyRunnerAdvancements(withRbi, runnerAdvancementsForWalk(pre.runners), pre.runnerSlots, pre.runnerInnings);
  return recordOut(advancePlate(resetCounts(withArcs)));
}

export function handleStolenBase(game: EngineGameState, toBase?: number): EngineGameState {
  const from = stealFromBase(toBase);
  if (from == null) return game;
  if (!game.runners[from - 1]) return game;
  const destination = toBase === 4 ? 4 : (toBase as number);
  if (destination <= 3 && game.runners[destination - 1]) return game;
  const slot = game.runnerSlots[from - 1];
  const originInning = game.runnerInnings[from - 1];
  const next = clearBase(game, from);
  if (destination === 4) return handleStealHome(next, slot, originInning, from);
  return handleStealAdvance(next, slot, originInning, from, destination);
}

function handleStealHome(game: EngineGameState, slot: number | null, originInning: number | null, from: number): EngineGameState {
  const scored = addTeamScore(game, 1);
  const withRunner = creditRunToSlot(scored, slot);
  return applyStealArc(withRunner, slot, originInning, from, 4);
}

function handleStealAdvance(
  game: EngineGameState,
  slot: number | null,
  originInning: number | null,
  from: number,
  destination: number
): EngineGameState {
  const occupied = occupyBase(game, destination, slot, originInning);
  return applyStealArc(occupied, slot, originInning, from, destination);
}

export function handleCaughtStealing(game: EngineGameState, toBase?: number): EngineGameState {
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
  return stampCaughtStealing(withArc, slot, originInning, game.outs);
}

function stampCaughtStealing(game: EngineGameState, slot: number, originInning: number, outs: number): EngineGameState {
  const lineup = battingLineup(game);
  const key = String(originInning);
  const rows = lineup.rows.map((row) => {
    if (row.slotIdx !== slot) return row;
    const cell = row.innings[key];
    if (!cell) return row;
    const notation = cell.notation.endsWith(' CS') ? cell.notation : `${cell.notation} CS`.trim();
    const next = { ...cell, notation, outNum: outs + 1, hasEndedInningLine: outs >= 2 };
    return { ...row, innings: { ...row.innings, [key]: next } };
  });
  const updatedLineup = { ...lineup, rows };
  if (game.half === 'TOP') return { ...game, awayLineup: updatedLineup };
  return { ...game, homeLineup: updatedLineup };
}

export function handleWildAdvance(game: EngineGameState, eventType: ScoringEventType): EngineGameState {
  void eventType;
  const advanced = advanceRunnerState(game.runners, game.runnerSlots, game.runnerInnings, 1);
  const withState = updateRunnerState(game, advanced);
  const withRuns = creditPlateAppearanceRuns(withState, game.runners, game.runnerSlots, 1, 0);
  return applyRunnerAdvancements(withRuns, runnerAdvancementsForWalk(game.runners), game.runnerSlots, game.runnerInnings);
}
