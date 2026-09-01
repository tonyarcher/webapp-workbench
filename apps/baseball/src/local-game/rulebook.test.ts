import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from './rule-engine';
import type { EngineAtBatCell, EngineGameState, RunnersOnBase, ScoringEvent, ScoringEventType } from './rule-engine';
import { hitBaseCount, hitNotation, inPlayOutNotation } from './notation';
import type { Advancement } from './notation';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';
import { SCOREBOOK_BASE_POINTS, advancementArcPoints, basePathEdges } from './scorebook-path';
import type { DiamondEdge } from './scorebook-path';

const AT_BAT_EVENT_TYPES: ScoringEventType[] = [
  'STRIKEOUT',
  'WALK',
  'HIT_BY_PITCH',
  'SINGLE',
  'DOUBLE',
  'TRIPLE',
  'HOME_RUN',
  'GROUNDOUT',
  'FLYOUT',
  'LINE_OUT',
  'POP_OUT',
  'SACRIFICE_FLY',
  'ERROR',
  'FIELDER_CHOICE',
];

const FIELD_POS_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function createDefaultGame(totalInnings = 9): EngineGameState {
  return createGame({
    homeName: 'Chicago Cubs',
    awayName: 'St. Louis Cardinals',
    homeLineup: DEFAULT_HOME_LINEUP,
    awayLineup: DEFAULT_AWAY_LINEUP,
    totalInnings,
  });
}

function apply(game: EngineGameState, ...events: ScoringEvent[]): EngineGameState {
  return events.reduce((current, event) => reduceGame(current, event), game);
}

function event(type: ScoringEventType): ScoringEvent {
  return { type };
}

function countRunsScored(runners: RunnersOnBase, bases: number): number {
  return runners.reduce((total, occupied, index) => (occupied && index + 1 + bases > 3 ? total + 1 : total), 0);
}

function randomEvent(random: () => number): ScoringEvent {
  const type = AT_BAT_EVENT_TYPES[Math.floor(random() * AT_BAT_EVENT_TYPES.length)];
  const event: ScoringEvent = { type };
  if (type === 'GROUNDOUT' || type === 'LINE_OUT') {
    event.fieldPos = FIELD_POS_RANGE[Math.floor(random() * FIELD_POS_RANGE.length)];
    event.doublePlay = random() < 0.3;
  } else if (type === 'FLYOUT' || type === 'POP_OUT' || type === 'SACRIFICE_FLY' || type === 'ERROR' || type === 'FIELDER_CHOICE') {
    event.fieldPos = FIELD_POS_RANGE[Math.floor(random() * FIELD_POS_RANGE.length)];
  }
  return event;
}

// Independently derive the at-bat cell the engine SHOULD write for an event,
// straight from the pre-event runner occupancy and count. Advancement arcs are
// never written to the batter's own cell — they live in each runner's cell.
function expectedCell(pre: EngineGameState, event: ScoringEvent): EngineAtBatCell {
  const runners = pre.runners;
  const count = `${pre.balls}-${pre.strikes}`;
  switch (event.type) {
    case 'STRIKEOUT':
      return {
        count,
        notation: 'K',
        base: 0,
        outNum: pre.outs + 1,
        hasEndedInningLine: pre.outs === 2,
        run: false,
        rbiCount: 0,
      };
    case 'WALK':
    case 'HIT_BY_PITCH': {
      const runsScored = countRunsScored(runners, 1);
      return {
        count,
        notation: event.type === 'HIT_BY_PITCH' ? 'HBP' : 'BB',
        base: 1,
        outNum: null,
        hasEndedInningLine: false,
        run: false,
        rbiCount: runsScored,
      };
    }
    case 'SINGLE':
    case 'DOUBLE':
    case 'TRIPLE':
    case 'HOME_RUN': {
      const bases = hitBaseCount(event.type);
      const runsScored = countRunsScored(runners, bases);
      return {
        count,
        notation: hitNotation(event.type),
        base: bases === 4 ? 0 : bases,
        outNum: null,
        hasEndedInningLine: false,
        run: bases === 4,
        rbiCount: runsScored + (bases === 4 ? 1 : 0),
      };
    }
    case 'GROUNDOUT':
    case 'LINE_OUT':
    case 'FLYOUT':
    case 'POP_OUT':
    case 'SACRIFICE_FLY': {
      const sacFly = event.type === 'SACRIFICE_FLY';
      const forceDoublePlay = Boolean(event.doublePlay) && pre.outs <= 1 && runners[0] && !sacFly;
      const outsAdded = forceDoublePlay ? 2 : 1;
      return {
        count,
        notation: inPlayOutNotation(event.type, event.fieldPos, forceDoublePlay),
        base: 0,
        outNum: pre.outs + 1,
        hasEndedInningLine: pre.outs + outsAdded >= 3,
        run: false,
        rbiCount: sacFly && runners[2] ? 1 : 0,
      };
    }
    case 'ERROR': {
      const runsScored = countRunsScored(runners, 1);
      return {
        count,
        notation: 'E' + (event.fieldPos ? String(event.fieldPos) : ''),
        base: 1,
        outNum: null,
        hasEndedInningLine: false,
        run: false,
        rbiCount: runsScored,
      };
    }
    case 'FIELDER_CHOICE':
      return {
        count,
        notation: 'FC' + (event.fieldPos ? String(event.fieldPos) : ''),
        base: 1,
        outNum: null,
        hasEndedInningLine: false,
        run: false,
        rbiCount: 0,
      };
    default:
      return { count, notation: '', base: 0, outNum: null, hasEndedInningLine: false, run: false, rbiCount: 0 };
  }
}

function cellForBatter(
  game: EngineGameState,
  half: 'TOP' | 'BOTTOM',
  batterIdx: number,
  inning: number
): EngineAtBatCell {
  const lineup = half === 'TOP' ? game.awayLineup : game.homeLineup;
  const row = lineup.rows[batterIdx % lineup.rows.length];
  return row.innings[String(inning)] ?? { count: '', notation: '', base: 0, outNum: null, hasEndedInningLine: false, run: false, rbiCount: 0 };
}

function assertCellMatches(cell: EngineAtBatCell, expected: EngineAtBatCell, context: string): void {
  expect(cell.notation, `${context}: notation`).toBe(expected.notation);
  expect(cell.base, `${context}: base`).toBe(expected.base);
  expect(cell.outNum ?? null, `${context}: outNum`).toBe(expected.outNum ?? null);
  expect(cell.count, `${context}: count`).toBe(expected.count);
  expect(cell.run ?? false, `${context}: run`).toBe(expected.run ?? false);
  expect(cell.rbiCount ?? 0, `${context}: rbiCount`).toBe(expected.rbiCount ?? 0);
  expect(cell.hasEndedInningLine, `${context}: hasEndedInningLine`).toBe(expected.hasEndedInningLine);
  expect(cell.advancements ?? [], `${context}: advancements`).toEqual(expected.advancements ?? []);
}

function assertLinesConsistent(cell: EngineAtBatCell, expectedEdges: DiamondEdge[], context: string): void {
  expect(basePathEdges(cell.base), `${context}: base-path edges`).toEqual(expectedEdges);
}

// Which diamond edges the batter's own path covers, derived from the EVENT
// (not from the engine's recorded base) so a wrong `base` gets caught.
function expectedEdgesForEvent(event: ScoringEvent): DiamondEdge[] {
  switch (event.type) {
    case 'SINGLE':
    case 'WALK':
    case 'HIT_BY_PITCH':
    case 'ERROR':
    case 'FIELDER_CHOICE':
      return ['right'];
    case 'DOUBLE':
      return ['right', 'top'];
    case 'TRIPLE':
      return ['right', 'top', 'left'];
    case 'HOME_RUN':
      // The engine records home runs with base 0 and a run dot instead of a
      // filled diamond, so no border edges are expected.
      return [];
    default:
      return [];
  }
}

// mulberry32 — deterministic PRNG so the suite is reproducible.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// An independent model of the batting side: which runner (slot) stands on which
// base, which inning he reached base in, and which advancement arcs the engine
// must have written into his origin cell so far.
interface ModelRunner {
  slot: number;
  base: number;
  originInning: number;
}

interface ScorebookModel {
  half: 'TOP' | 'BOTTOM';
  inning: number;
  awayBatterIdx: number;
  homeBatterIdx: number;
  outs: number;
  runners: ModelRunner[];
  expectedCells: Map<string, Advancement[]>;
  appearances: Map<string, number>;
}

function createScorebookModel(): ScorebookModel {
  return {
    half: 'TOP',
    inning: 1,
    awayBatterIdx: 0,
    homeBatterIdx: 0,
    outs: 0,
    runners: [],
    expectedCells: new Map(),
    appearances: new Map(),
  };
}

function modelBatterIdx(model: ScorebookModel): number {
  return model.half === 'TOP' ? model.awayBatterIdx : model.homeBatterIdx;
}

function advanceModelBatter(model: ScorebookModel, rowCount: number): void {
  if (model.half === 'TOP') {
    model.awayBatterIdx = (model.awayBatterIdx + 1) % rowCount;
  } else {
    model.homeBatterIdx = (model.homeBatterIdx + 1) % rowCount;
  }
}

function isOutType(type: ScoringEventType): boolean {
  return ['STRIKEOUT', 'GROUNDOUT', 'LINE_OUT', 'FLYOUT', 'POP_OUT', 'SACRIFICE_FLY'].includes(type);
}

function baseCountFor(type: ScoringEventType): number {
  switch (type) {
    case 'SINGLE':
      return 1;
    case 'DOUBLE':
      return 2;
    case 'TRIPLE':
      return 3;
    case 'HOME_RUN':
      return 4;
    case 'WALK':
    case 'HIT_BY_PITCH':
    case 'ERROR':
      return 1;
    default:
      return 0;
  }
}

// Apply the event to the model and return how many runs the event scored
// according to the model (scored advancement arcs + the batter's own home run)
// and which cells received an arc this event.
function applyModelEvent(model: ScorebookModel, event: ScoringEvent, rowCount: number): { runs: number; touched: string[] } {
  const touched: string[] = [];
  const batterSlot = (modelBatterIdx(model) % rowCount) + 1;
  const batterKey = `${model.half}:${batterSlot}:${model.inning}`;
  const priorAppearances = model.appearances.get(batterKey) ?? 0;
  model.appearances.set(batterKey, priorAppearances + 1);
  if (priorAppearances > 0) {
    // The engine overwrites the cell when the same batter bats again in the
    // same inning, so any arcs recorded there earlier are gone.
    model.expectedCells.set(batterKey, []);
    touched.push(batterKey);
  }

  const sacFly = event.type === 'SACRIFICE_FLY';
  const forceDoublePlay =
    Boolean(event.doublePlay) &&
    model.outs <= 1 &&
    model.runners.some((runner) => runner.base === 1) &&
    !sacFly;
  const bases = baseCountFor(event.type);

  let scoredArcs = 0;
  const appendArc = (runner: ModelRunner, advancement: Advancement) => {
    const key = `${model.half}:${runner.slot}:${runner.originInning}`;
    const arcs = model.expectedCells.get(key) ?? [];
    arcs.push(advancement);
    model.expectedCells.set(key, arcs);
    touched.push(key);
    if (advancement.scored) scoredArcs++;
  };

  if (forceDoublePlay) {
    model.runners = model.runners.filter((runner) => runner.base !== 1);
  }

  if (bases >= 1) {
    const moved: ModelRunner[] = [];
    for (const runner of model.runners) {
      const destination = runner.base + bases;
      if (destination > 3) {
        appendArc(runner, { from: runner.base, to: 4, scored: true });
      } else {
        appendArc(runner, { from: runner.base, to: destination, scored: false });
        moved.push({ ...runner, base: destination });
      }
    }
    model.runners = moved;
  }

  if (sacFly) {
    const runnerOnThird = model.runners.find((runner) => runner.base === 3);
    if (runnerOnThird) {
      appendArc(runnerOnThird, { from: 3, to: 4, scored: true });
      model.runners = model.runners.filter((runner) => runner.base !== 3);
    }
  }

  if (event.type === 'FIELDER_CHOICE') {
    model.runners = model.runners.filter((runner) => runner.base !== 1);
  }

  if (bases >= 1 && bases <= 3) {
    model.runners.push({ slot: batterSlot, base: bases, originInning: model.inning });
  } else if (event.type === 'FIELDER_CHOICE') {
    model.runners.push({ slot: batterSlot, base: 1, originInning: model.inning });
  }

  const batterScores = event.type === 'HOME_RUN';

  advanceModelBatter(model, rowCount);
  model.outs += isOutType(event.type) ? (forceDoublePlay ? 2 : 1) : 0;
  if (model.outs >= 3) {
    model.outs = 0;
    model.runners = [];
    model.half = model.half === 'TOP' ? 'BOTTOM' : 'TOP';
    if (model.half === 'TOP') model.inning += 1;
  }

  return { runs: scoredArcs + (batterScores ? 1 : 0), touched };
}

function assertModelCells(game: EngineGameState, model: ScorebookModel, context: string, touched: string[]): number {
  for (const key of touched) {
    const [half, slotStr, inningStr] = key.split(':');
    const lineup = half === 'TOP' ? game.awayLineup : game.homeLineup;
    const row = lineup.rows[Number(slotStr) - 1];
    const cell = row?.innings[inningStr];
    const expected = model.expectedCells.get(key) ?? [];
    const actual = (cell?.advancements ?? []).map((advancement) => ({ ...advancement }));
    expect(actual, `${context}: arcs in cell ${key}`).toEqual(expected);
    for (const advancement of expected) {
      const from = SCOREBOOK_BASE_POINTS[advancement.from];
      const to = SCOREBOOK_BASE_POINTS[advancement.to];
      expect(from && to, `${context}: arc endpoints known`).toBeTruthy();
      const arc = advancementArcPoints(advancement);
      expect([arc.x1, arc.y1], `${context}: arc from point`).toEqual([from.x, from.y]);
      expect([arc.x2, arc.y2], `${context}: arc to point`).toEqual([to.x, to.y]);
    }
  }
  return touched.length;
}

function assertRunnerStateMatches(game: EngineGameState, model: ScorebookModel, context: string): void {
  const expectedRunners: RunnersOnBase = [false, false, false];
  const expectedSlots: (number | null)[] = [null, null, null];
  const expectedInnings: (number | null)[] = [null, null, null];
  for (const runner of model.runners) {
    expectedRunners[runner.base - 1] = true;
    expectedSlots[runner.base - 1] = runner.slot;
    expectedInnings[runner.base - 1] = runner.originInning;
  }
  expect(game.runners, `${context}: runners`).toEqual(expectedRunners);
  expect(game.runnerSlots, `${context}: runnerSlots`).toEqual(expectedSlots);
  expect(game.runnerInnings, `${context}: runnerInnings`).toEqual(expectedInnings);
}

describe('rulebook: base-path line rendering over many games', () => {
  it('fills in correct base-path edges and advancement arcs across hundreds of games', () => {
    const GAMES = 250;
    const MAX_EVENTS = 300;
    let cellsChecked = 0;
    let gamesPlayed = 0;

    for (let gameSeed = 1; gameSeed <= GAMES; gameSeed++) {
      const random = mulberry32(gameSeed * 7919);
      let game = createDefaultGame();
      const model = createScorebookModel();
      let eventsApplied = 0;

      while (!game.over && eventsApplied < MAX_EVENTS) {
        const event = randomEvent(random);
        const pre = game;
        const preHalf = pre.half;
        const preBatterIdx = preHalf === 'TOP' ? pre.awayBatterIdx : pre.homeBatterIdx;
        const preInning = pre.inning;
        const preScore = preHalf === 'TOP' ? pre.awayScore : pre.homeScore;

        const expected = expectedCell(pre, event);
        const expectedEdges = expectedEdgesForEvent(event);
        const modelResult = applyModelEvent(model, event, preHalf === 'TOP' ? pre.awayLineup.rows.length : pre.homeLineup.rows.length);

        game = reduceGame(pre, event);
        eventsApplied++;

        const cell = cellForBatter(game, preHalf, preBatterIdx, preInning);
        const context = `game ${gameSeed} event ${eventsApplied} (${event.type})`;

        assertCellMatches(cell, expected, context);
        assertLinesConsistent(cell, expectedEdges, context);

        const delta = (preHalf === 'TOP' ? game.awayScore : game.homeScore) - preScore;
        expect(delta, `${context}: score delta`).toBe(cell.rbiCount ?? 0);
        expect(delta, `${context}: scored runners match delta`).toBe(modelResult.runs);

        assertRunnerStateMatches(game, model, context);
        cellsChecked += assertModelCells(game, model, context, modelResult.touched);
      }

      gamesPlayed++;
      expect(game.over, `game ${gameSeed} reached a final state`).toBe(true);
    }

    expect(gamesPlayed).toBe(GAMES);
    expect(cellsChecked).toBeGreaterThan(GAMES * 30);
  });
});

describe('rulebook: known advancement scenarios', () => {
  it('moves the first batter to second on the scorebook after a second single', () => {
    let game = createDefaultGame();
    game = reduceGame(game, { type: 'SINGLE' });
    const first = cellForBatter(game, 'TOP', 0, 1);
    expect(first).toMatchObject({ notation: '1B', base: 1 });
    expect(basePathEdges(first.base)).toEqual(['right']);
    expect(first.advancements).toBeUndefined();

    game = reduceGame(game, { type: 'SINGLE' });
    const advancedFirst = cellForBatter(game, 'TOP', 0, 1);
    expect(advancedFirst.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    const second = cellForBatter(game, 'TOP', 1, 1);
    expect(second).toMatchObject({ notation: '1B', base: 1 });
    expect(basePathEdges(second.base)).toEqual(['right']);
    expect(second.advancements).toBeUndefined();

    const arc = advancementArcPoints({ from: 1, to: 2, scored: false });
    expect(arc).toEqual({ x1: 46, y1: 26, x2: 26, y2: 6 });
    expect(game.runners).toEqual([true, true, false]);
    expect(game.runnerSlots).toEqual([2, 1, null]);
  });

  it('scores a runner from third and marks the scoring arc in the runner\'s own cell', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('WALK'), event('WALK'));
    game = reduceGame(game, event('SINGLE'));
    expect(cellForBatter(game, 'TOP', 0, 1).advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
      { from: 3, to: 4, scored: true },
    ]);
    expect(cellForBatter(game, 'TOP', 1, 1).advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
    ]);
    expect(cellForBatter(game, 'TOP', 2, 1).advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    expect(cellForBatter(game, 'TOP', 3, 1).advancements).toBeUndefined();
    const scoring = advancementArcPoints({ from: 3, to: 4, scored: true });
    expect(scoring).toEqual({ x1: 6, y1: 26, x2: 26, y2: 46 });
    expect(game.awayScore).toBe(1);
    expect(game.runners).toEqual([true, true, true]);
  });
});
