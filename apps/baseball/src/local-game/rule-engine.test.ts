import { describe, expect, it } from 'vitest';
import {
  createGame,
  isBattingHalfTop,
  isGameOver,
  isHitEventType,
  isOutEventType,
  reduceGame,
} from './rule-engine';
import type { EngineGameState, ScoringEvent, ScoringEventType } from './rule-engine';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';

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

describe('rule engine: count and plate appearances', () => {
  it('starts at top of first inning with empty count', () => {
    const game = createDefaultGame();
    expect(game.inning).toBe(1);
    expect(isBattingHalfTop(game)).toBe(true);
    expect(game.half).toBe('TOP');
    expect(game.balls).toBe(0);
    expect(game.strikes).toBe(0);
    expect(game.outs).toBe(0);
    expect(game.awayScore).toBe(0);
    expect(game.homeScore).toBe(0);
    expect(game.runners).toEqual([false, false, false]);
    expect(game.over).toBe(false);
  });

  it('tracks ball count and converts the fourth ball into a walk', () => {
    let game = createDefaultGame();
    game = apply(game, event('BALL'), event('BALL'), event('BALL'));
    expect(game.balls).toBe(3);
    game = reduceGame(game, event('BALL'));
    expect(game.balls).toBe(0);
    expect(game.runners[0]).toBe(true);
    expect(game.awayLineup.rows[0].walks).toBe(1);
  });

  it('advances strikes and turns the third strike into a strikeout', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKE'), event('STRIKE'));
    expect(game.strikes).toBe(2);
    game = reduceGame(game, event('STRIKE'));
    expect(game.outs).toBe(1);
    expect(game.strikes).toBe(0);
    expect(game.awayLineup.rows[0].atBats).toBe(1);
  });

  it('caps foul balls at two strikes', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKE'), event('STRIKE'), event('FOUL'), event('FOUL'));
    expect(game.strikes).toBe(2);
    expect(game.outs).toBe(0);
  });

  it('records a strikeout from a two-strike foul sequence correctly', () => {
    let game = createDefaultGame();
    game = apply(game, event('FOUL'), event('STRIKE'));
    expect(game.strikes).toBe(2);
    game = reduceGame(game, event('STRIKE'));
    expect(game.outs).toBe(1);
  });

  it('cycles the batting order to the next batter after a plate appearance', () => {
    let game = createDefaultGame();
    expect(game.awayBatterIdx).toBe(0);
    game = reduceGame(game, event('STRIKEOUT'));
    expect(game.awayBatterIdx).toBe(1);
    game = reduceGame(game, event('STRIKEOUT'));
    expect(game.awayBatterIdx).toBe(2);
  });

  it('wraps the batting order after nine plate appearances in the same half', () => {
    const game = apply(
      createDefaultGame(),
      event('STRIKEOUT'),
      event('STRIKEOUT'),
      ...Array.from({ length: 7 }, () => event('WALK'))
    );
    expect(game.awayBatterIdx).toBe(0);
    expect(game.half).toBe('TOP');
    expect(game.outs).toBe(2);
  });

  it('does not treat a walk as an official at-bat', () => {
    const game = reduceGame(createDefaultGame(), event('WALK'));
    expect(game.awayLineup.rows[0].walks).toBe(1);
    expect(game.awayLineup.rows[0].atBats).toBe(0);
  });

  it('records hit-by-pitch as HBP without a walk or at-bat', () => {
    const game = reduceGame(createDefaultGame(), event('HIT_BY_PITCH'));
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: 'HBP', base: 1 });
    expect(game.awayLineup.rows[0].walks).toBe(0);
    expect(game.awayLineup.rows[0].atBats).toBe(0);
    expect(game.runners[0]).toBe(true);
  });
});

describe('rule engine: runners and runs', () => {
  it('walks home a runner with the bases loaded', () => {
    const game = apply(
      createDefaultGame(),
      event('WALK'),
      event('WALK'),
      event('WALK'),
      event('WALK')
    );
    expect(game.awayScore).toBe(1);
    expect(game.runners).toEqual([true, true, true]);
    expect(game.awayLineup.rows[3].rbi).toBe(1);
    expect(game.awayLineup.rows[0].runs).toBe(1);
    expect(game.awayLineup.rows[3].atBats).toBe(0);
  });

  it('places the batter on first and keeps a runner on third after a walk', () => {
    let game = createDefaultGame();
    game = reduceGame(game, { type: 'WALK' });
    game = reduceGame(game, { type: 'SINGLE' });
    game = reduceGame(game, { type: 'SINGLE' });
    game = reduceGame(game, { type: 'STRIKEOUT' });
    expect(game.runners).toEqual([true, true, true]);
    game = reduceGame(game, { type: 'WALK' });
    expect(game.awayScore).toBe(1);
    expect(game.runners).toEqual([true, true, true]);
  });

  it('scores a runner from third on a single', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    expect(game.awayScore).toBe(0);
    expect(game.runners).toEqual([true, true, true]);
    game = reduceGame(game, event('SINGLE'));
    expect(game.awayScore).toBe(1);
  });

  it('scores two runners on a double with runners on first and second', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('WALK'));
    expect(game.runners).toEqual([true, true, false]);
    game = reduceGame(game, event('DOUBLE'));
    expect(game.awayScore).toBe(1);
    expect(game.runners[1]).toBe(true);
  });

  it('scores all runners and the batter on a grand slam', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('WALK'), event('WALK'));
    game = reduceGame(game, event('HOME_RUN'));
    expect(game.awayScore).toBe(4);
    expect(game.runners).toEqual([false, false, false]);
    expect(game.awayLineup.rows[3].hits).toBe(1);
    expect(game.awayLineup.rows[3].rbi).toBe(4);
  });

  it('a home run with the bases empty scores one run', () => {
    const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
    expect(game.awayScore).toBe(1);
    expect(game.awayLineup.rows[0].rbi).toBe(1);
    expect(game.awayLineup.rows[0].runs).toBe(1);
  });

  it('tracks runs and RBIs on the scorebook rows', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'));
    expect(game.awayScore).toBe(0);
    game = reduceGame(game, event('TRIPLE'));
    expect(game.awayScore).toBe(2);
    expect(game.awayLineup.rows[2].rbi).toBe(2);
  });
});

describe('rule engine: outs and inning flips', () => {
  it('flips to the bottom of the first inning after three outs', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.half).toBe('BOTTOM');
    expect(game.inning).toBe(1);
    expect(game.outs).toBe(0);
    expect(game.homeBatterIdx).toBe(0);
    expect(game.awayBatterIdx).toBe(3);
  });

  it('continues the batting order from the next slot in the following inning', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.half).toBe('TOP');
    expect(game.inning).toBe(2);
    expect(game.awayBatterIdx).toBe(3);
    expect(game.homeBatterIdx).toBe(3);
  });

  it('keeps the runner on base when the half inning flips', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.half).toBe('BOTTOM');
    expect(game.runners).toEqual([false, false, false]);
  });

  it('advances to the top of the second inning after the bottom half', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.inning).toBe(2);
    expect(game.half).toBe('TOP');
  });

  it('ends the game when the home team walks off in the final inning', () => {
    let game = createDefaultGame(1);
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('HOME_RUN'));
    expect(game.half).toBe('BOTTOM');
    expect(game.inning).toBe(1);
    expect(game.over).toBe(true);
  });

  it('ends the game early when the home team leads in the final inning', () => {
    let game = createDefaultGame(1);
    game = apply(game, event('HOME_RUN'), event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.awayScore).toBe(1);
    expect(game.half).toBe('BOTTOM');
    game = apply(game, event('HOME_RUN'), event('HOME_RUN'));
    expect(game.homeScore).toBe(2);
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.over).toBe(true);
  });
});

describe('rule engine: defensive events', () => {
  it('records at-bats for in-play outs', () => {
    const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
    expect(game.outs).toBe(1);
    expect(game.awayLineup.rows[0].atBats).toBe(1);
  });

  it('advances the batter after a flyout with the bases empty', () => {
    const game = reduceGame(createDefaultGame(), event('FLYOUT'));
    expect(game.outs).toBe(1);
    expect(game.awayBatterIdx).toBe(1);
  });

  it('scores a runner from third on a sacrifice fly', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    expect(game.awayScore).toBe(0);
    expect(game.runners[2]).toBe(true);
    game = reduceGame(game, event('SACRIFICE_FLY'));
    expect(game.awayScore).toBe(1);
    expect(game.outs).toBe(1);
    expect(game.awayLineup.rows[3].rbi).toBe(1);
    expect(game.awayLineup.rows[3].atBats).toBe(0);
    expect(game.awayLineup.rows[0].runs).toBe(1);
  });

  it('does not score a runner from third on a plain flyout', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('FLYOUT'));
    expect(game.awayScore).toBe(0);
    expect(game.runners[2]).toBe(true);
    expect(game.outs).toBe(1);
    expect(game.awayLineup.rows[3].atBats).toBe(1);
  });

  it('records at-bats without an out for fielder choices and errors', () => {
    const game = apply(createDefaultGame(), event('ERROR'), event('FIELDER_CHOICE'));
    expect(game.outs).toBe(0);
    expect(game.awayLineup.rows[0].atBats).toBe(1);
    expect(game.awayLineup.rows[1].atBats).toBe(1);
  });
});

describe('rule engine: helpers and edge cases', () => {
  it('classifies event types', () => {
    expect(isHitEventType('HOME_RUN')).toBe(true);
    expect(isHitEventType('DOUBLE')).toBe(true);
    expect(isHitEventType('BALL')).toBe(false);
    expect(isOutEventType('STRIKEOUT')).toBe(true);
    expect(isOutEventType('GROUNDOUT')).toBe(true);
    expect(isOutEventType('CAUGHT_STEALING')).toBe(true);
    expect(isOutEventType('SINGLE')).toBe(false);
  });

  it('returns the game unchanged when it is over', () => {
    const game = { ...createDefaultGame(1), over: true };
    expect(reduceGame(game, event('HOME_RUN'))).toBe(game);
  });

  it('returns the game unchanged for an unknown event type', () => {
    const game = createDefaultGame();
    const next = reduceGame(game, { type: 'NOT_A_REAL_EVENT' } as unknown as ScoringEvent);
    expect(next).toBe(game);
  });

  it('reports the game as over', () => {
    expect(isGameOver(createDefaultGame(1))).toBe(false);
    expect(isGameOver({ ...createDefaultGame(1), over: true })).toBe(true);
  });

  it('has no runners or scores in the away lineup initially', () => {
    const game = createDefaultGame();
    expect(game.awayLineup.rows).toHaveLength(9);
    expect(game.awayLineup.rows[0]).toMatchObject({
      atBats: 0,
      runs: 0,
      hits: 0,
      rbi: 0,
      walks: 0,
    });
  });
});

describe('rule engine: scorebook cells', () => {
  it('records a strikeout cell with notation, count, and out number', () => {
    let game = createDefaultGame();
    game = apply(game, event('BALL'), event('STRIKE'), event('STRIKE'));
    game = reduceGame(game, event('STRIKEOUT'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'K', count: '1-2', outNum: 1, hasEndedInningLine: false });
  });

  it('records a walk cell with the batter reaching first base', () => {
    const game = reduceGame(createDefaultGame(), event('WALK'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'BB', base: 1, outNum: null, hasEndedInningLine: false });
  });

  it('records a home run cell without a base marker', () => {
    const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'HR', base: 0, outNum: null });
  });

  it('records a single cell with the batter reaching first', () => {
    const game = reduceGame(createDefaultGame(), event('SINGLE'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: '1B', base: 1 });
  });

  it('records a groundout cell with the out number', () => {
    const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'GO', outNum: 1 });
  });

  it('records a sacrifice fly cell for the batter', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('SACRIFICE_FLY'));
    const cell = game.awayLineup.rows[3].innings['1'];
    expect(cell).toMatchObject({ notation: 'SF', outNum: 1 });
  });

  it('marks the third out as ending the inning', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'));
    game = reduceGame(game, event('STRIKEOUT'));
    const cell = game.awayLineup.rows[2].innings['1'];
    expect(cell).toMatchObject({ outNum: 3, hasEndedInningLine: true });
    expect(game.half).toBe('BOTTOM');
  });

  it('records an error cell with the batter reaching first without an out', () => {
    const game = reduceGame(createDefaultGame(), event('ERROR'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'E', base: 1, outNum: null });
    expect(game.outs).toBe(0);
  });

  it('records a fielder choice cell', () => {
    const game = reduceGame(createDefaultGame(), event('FIELDER_CHOICE'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'FC', base: 1 });
  });

  it('keeps a struck-out batter cell intact after the inning flips', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    const cell = game.awayLineup.rows[2].innings['1'];
    expect(cell.notation).toBe('K');
    expect(game.homeLineup.rows[0].innings).toEqual({});
  });
});

describe('rule engine: extra innings and game ending', () => {
  it('continues into an extra inning when the final inning ends tied', () => {
    let game = createDefaultGame(1);
    game = apply(game, event('HOME_RUN'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('HOME_RUN'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.over).toBe(false);
    expect(game.inning).toBe(2);
    expect(game.half).toBe('TOP');
  });

  it('ends on a walk-off home run in an extra inning', () => {
    let game: EngineGameState = { ...createDefaultGame(1), inning: 2, half: 'TOP', awayScore: 1, homeScore: 1, over: false };
    game = apply(game, event('HOME_RUN'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('HOME_RUN'));
    expect(game.over).toBe(false);
    game = reduceGame(game, event('HOME_RUN'));
    expect(game.over).toBe(true);
    expect(game.homeScore).toBe(3);
  });

  it('does not end the game when home takes a lead before the final inning', () => {
    let game = createDefaultGame(2);
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = reduceGame(game, event('HOME_RUN'));
    expect(game.over).toBe(false);
    expect(game.half).toBe('BOTTOM');
    expect(game.homeScore).toBe(1);
  });

  it('skips the bottom of the final inning when home is already leading', () => {
    let game: EngineGameState = { ...createDefaultGame(2), inning: 2, half: 'TOP', awayScore: 0, homeScore: 1, over: false };
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.over).toBe(true);
    expect(game.inning).toBe(2);
  });

  it('ends on a walk-off home run in the bottom of the final inning', () => {
    let game: EngineGameState = { ...createDefaultGame(2), inning: 2, half: 'BOTTOM', awayScore: 1, homeScore: 1, over: false };
    game = reduceGame(game, event('HOME_RUN'));
    expect(game.over).toBe(true);
    expect(game.homeScore).toBe(2);
  });

  it('ends when the away team wins the final inning outright', () => {
    let game = createDefaultGame(1);
    game = apply(game, event('HOME_RUN'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.over).toBe(true);
    expect(game.awayScore).toBe(1);
    expect(game.homeScore).toBe(0);
  });
});

describe('rule engine: per-inning runs and errors', () => {
  it('records runs by inning for each team', () => {
    let game = createDefaultGame(1);
    game = apply(game, event('HOME_RUN'));
    expect(game.awayRunsByInning).toEqual([1]);
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('HOME_RUN'), event('HOME_RUN'));
    expect(game.homeRunsByInning).toEqual([2]);
    expect(game.awayRunsByInning).toEqual([1]);
  });

  it('charges errors to the fielding team', () => {
    let game = createDefaultGame();
    game = reduceGame(game, event('ERROR'));
    expect(game.homeErrors).toBe(1);
    expect(game.awayErrors).toBe(0);
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = reduceGame(game, event('ERROR'));
    expect(game.awayErrors).toBe(1);
    expect(game.homeErrors).toBe(1);
  });

  it('does not charge a fielder choice as an error', () => {
    const game = reduceGame(createDefaultGame(), event('FIELDER_CHOICE'));
    expect(game.homeErrors).toBe(0);
  });
});

describe('rule engine: fielding positions and run marks', () => {
  it('records a groundout with the fielding positions', () => {
    const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 6 });
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: '6-3', outNum: 1 });
  });

  it('records a groundout fielded by first base without a pair', () => {
    const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 3 });
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: '3' });
  });

  it('falls back to GO without a fielding position', () => {
    const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: 'GO' });
  });

  it('records flyout, lineout, popout, and sac fly with positions', () => {
    let game = reduceGame(createDefaultGame(), { type: 'FLYOUT', fieldPos: 8 });
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: '8' });
    game = reduceGame(game, { type: 'LINE_OUT', fieldPos: 9 });
    expect(game.awayLineup.rows[1].innings['1']).toMatchObject({ notation: 'L9' });
    game = reduceGame(game, { type: 'POP_OUT', fieldPos: 6 });
    expect(game.awayLineup.rows[2].innings['1']).toMatchObject({ notation: 'P6' });
  });

  it('records an error and fielder choice with the fielder position', () => {
    let game = reduceGame(createDefaultGame(), { type: 'ERROR', fieldPos: 6 });
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: 'E6' });
    expect(game.homeErrors).toBe(1);
    game = reduceGame(game, { type: 'FIELDER_CHOICE', fieldPos: 4 });
    expect(game.awayLineup.rows[1].innings['1']).toMatchObject({ notation: 'FC4' });
  });

  it('places the batter on first base when he reaches on an error', () => {
    const game = reduceGame(createDefaultGame(), { type: 'ERROR', fieldPos: 6 });
    expect(game.runners).toEqual([true, false, false]);
    expect(game.runnerSlots).toEqual([1, null, null]);
    expect(game.runnerInnings).toEqual([1, null, null]);
  });

  it('advances runners one base when a batter reaches on an error', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, { type: 'ERROR', fieldPos: 6 });
    expect(game.runners).toEqual([true, true, false]);
    expect(game.runnerSlots).toEqual([2, 1, null]);
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
  });

  it('scores the runner from third with an RBI when the bases are loaded and the batter reaches on an error', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'ERROR', fieldPos: 6 });
    expect(game.awayScore).toBe(1);
    expect(game.awayLineup.rows[3].innings['1']).toMatchObject({ notation: 'E6', base: 1, rbiCount: 1 });
    expect(game.awayLineup.rows[0].innings['1'].advancements).toContainEqual({ from: 3, to: 4, scored: true });
  });

  it('retires the forced runner on first and puts the batter on base on a fielder\'s choice', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, { type: 'FIELDER_CHOICE', fieldPos: 4 });
    expect(game.runners).toEqual([true, false, false]);
    expect(game.runnerSlots).toEqual([2, null, null]);
    expect(game.awayLineup.rows[0].innings['1'].advancements).toBeUndefined();
  });

  it('marks a solo home run with a run dot and one RBI', () => {
    const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell).toMatchObject({ notation: 'HR', run: true, rbiCount: 1 });
  });

  it('marks a single driving in a runner with an RBI but no run dot', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('DOUBLE'));
    game = reduceGame(game, event('SINGLE'));
    const cell = game.awayLineup.rows[2].innings['1'];
    expect(cell).toMatchObject({ notation: '1B', run: false, rbiCount: 1 });
  });

  it('marks a bases-loaded walk with an RBI but no run dot', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('WALK'));
    const cell = game.awayLineup.rows[3].innings['1'];
    expect(cell).toMatchObject({ notation: 'BB', run: false, rbiCount: 1 });
  });

  it('marks a sacrifice fly scoring a runner with an RBI', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
    const cell = game.awayLineup.rows[3].innings['1'];
    expect(cell).toMatchObject({ notation: 'SF8', run: false, rbiCount: 1 });
    expect(game.outs).toBe(1);
  });
});

describe('rule engine: runner advancement arcs', () => {
  it('advances a runner from first to third on a double, marked in the runner\'s own cell', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, event('DOUBLE'));
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell.advancements).toEqual([{ from: 1, to: 3, scored: false }]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toBeUndefined();
  });

  it('advances the first batter to second when a second batter singles', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, event('SINGLE'));
    expect(game.runners).toEqual([true, true, false]);
    expect(game.runnerSlots).toEqual([2, 1, null]);
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toBeUndefined();
  });

  it('advances runners one base on a walk and scores the runner from third', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('WALK'), event('WALK'));
    game = reduceGame(game, event('WALK'));
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
      { from: 3, to: 4, scored: true },
    ]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
    ]);
    expect(game.awayLineup.rows[2].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    expect(game.awayLineup.rows[3].innings['1'].advancements).toBeUndefined();
  });

  it('moves runners up on a single, marking each runner\'s advance in their own cell', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('SINGLE'));
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
    ]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    expect(game.awayLineup.rows[2].innings['1'].advancements).toBeUndefined();
  });

  it('scores runners from first and second on a triple, marking each scorer in their own cell', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('TRIPLE'));
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 4, scored: true },
    ]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toEqual([{ from: 1, to: 4, scored: true }]);
  });

  it('records a sacrifice fly advancement when a runner scores from third', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
    const cell = game.awayLineup.rows[0].innings['1'];
    expect(cell.advancements).toEqual([
      { from: 1, to: 2, scored: false },
      { from: 2, to: 3, scored: false },
      { from: 3, to: 4, scored: true },
    ]);
    expect(game.awayLineup.rows[1].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    expect(game.awayLineup.rows[2].innings['1'].advancements).toBeUndefined();
  });

  it('keeps advancement records empty for a home run with no runners', () => {
    const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
    expect(game.awayLineup.rows[0].innings['1'].advancements).toBeUndefined();
  });

  it('leaves advancements unset for outs and strikeouts', () => {
    let game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 6 });
    expect(game.awayLineup.rows[0].innings['1'].advancements).toBeUndefined();
    game = reduceGame(game, event('STRIKEOUT'));
    expect(game.awayLineup.rows[1].innings['1'].advancements).toBeUndefined();
  });
});

describe('rule engine: runner identity', () => {
  it('tracks which batter occupies first base after a single', () => {
    const game = reduceGame(createDefaultGame(), event('SINGLE'));
    expect(game.runnerSlots).toEqual([1, null, null]);
    expect(game.runners).toEqual([true, false, false]);
  });

  it('shifts runner slots when a later batter hits a double', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, event('DOUBLE'));
    expect(game.runnerSlots).toEqual([null, 2, 1]);
  });

  it('walks the batter to first and shuffles the other runners', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('WALK'));
    expect(game.runnerSlots).toEqual([2, 1, null]);
  });

  it('scores a runner from third on a sacrifice fly and clears that base slot', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
    expect(game.runnerSlots).toEqual([3, 2, null]);
    expect(game.awayScore).toBe(1);
  });

  it('clears all runner slots after a home run', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, event('HOME_RUN'));
    expect(game.runnerSlots).toEqual([null, null, null]);
  });

  it('clears runner slots when the inning flips', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.runnerSlots).toEqual([null, null, null]);
  });

  it('tracks the inning where each runner reached base', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'), event('SINGLE'));
    expect(game.runnerSlots).toEqual([4, 3, 2]);
    expect(game.runnerInnings).toEqual([1, 1, 1]);
  });

  it('records the origin inning of a runner from a later inning', () => {
    let game = createDefaultGame();
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = reduceGame(game, event('SINGLE'));
    expect(game.inning).toBe(2);
    expect(game.awayBatterIdx).toBe(4);
    expect(game.runnerSlots).toEqual([4, null, null]);
    expect(game.runnerInnings).toEqual([2, null, null]);
  });

  it('clears runner origin innings when the inning flips', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.runnerInnings).toEqual([null, null, null]);
  });
});

describe('rule engine: double plays', () => {
  it('records two outs on a 6-4-3 double play and retires the runner on first', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'));
    game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
    expect(game.outs).toBe(2);
    expect(game.runners).toEqual([false, false, false]);
    expect(game.runnerSlots).toEqual([null, null, null]);
    expect(game.awayLineup.rows[1].innings['1']).toMatchObject({ notation: '6-4-3', outNum: 1 });
  });

  it('keeps runners on second and third when a force double play retires first', () => {
    let game = createDefaultGame();
    game = apply(game, event('WALK'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
    expect(game.runners).toEqual([false, true, true]);
    expect(game.runnerSlots).toEqual([null, 2, 1]);
    expect(game.outs).toBe(2);
  });

  it('flips the inning when a double play records the third out', () => {
    let game = createDefaultGame();
    game = apply(game, event('SINGLE'), event('STRIKEOUT'));
    game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
    expect(game.outs).toBe(0);
    expect(game.half).toBe('BOTTOM');
    expect(game.awayLineup.rows[2].innings['1'].hasEndedInningLine).toBe(true);
  });

  it('records a single out when a double play is requested without a runner on first', () => {
    const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 4, doublePlay: true });
    expect(game.outs).toBe(1);
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({ notation: '4-3' });
  });
});

describe('rule engine: lineups and baserunning', () => {
  it('renames batters and the pitcher from a SET_LINEUP event', () => {
    const game = reduceGame(createDefaultGame(), {
      type: 'SET_LINEUP',
      awayLineup: [{ batterName: 'Tony Gwynn', position: 'RF', jerseyNumber: 19 }],
      awayPitcherName: 'Trevor Hoffman',
    });
    expect(game.awayLineup.rows[0].batterName).toBe('Tony Gwynn');
    expect(game.awayLineup.rows[0].position).toBe('RF');
    expect(game.awayLineup.rows[0].jerseyNumber).toBe(19);
    expect(game.awayLineup.pitcherName).toBe('Trevor Hoffman');
    expect(game.awayLineup.rows[1].batterName).toBe('Paul Goldschmidt');
  });

  it('steals second when first is occupied', () => {
    let game = reduceGame(createDefaultGame(), event('SINGLE'));
    game = reduceGame(game, { type: 'STOLEN_BASE', base: 2 });
    expect(game.runners).toEqual([false, true, false]);
    expect(game.runnerSlots).toEqual([null, 1, null]);
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
  });

  it('scores a runner from third on a wild pitch without an RBI', () => {
    let game = apply(createDefaultGame(), event('SINGLE'), event('SINGLE'), event('SINGLE'));
    game = reduceGame(game, { type: 'WILD_PITCH' });
    expect(game.awayScore).toBe(1);
    expect(game.awayLineup.rows[0].runs).toBe(1);
    expect(game.awayLineup.rows[3].rbi).toBe(0);
    expect(game.runners).toEqual([false, true, true]);
  });

  it('records an out on a caught stealing', () => {
    let game = reduceGame(createDefaultGame(), event('WALK'));
    game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
    expect(game.outs).toBe(1);
    expect(game.runners).toEqual([false, false, false]);
    expect(game.awayBatterIdx).toBe(1);
  });

  it('writes CS notation and an out number on the runner\'s own cell', () => {
    let game = reduceGame(createDefaultGame(), event('WALK'));
    game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({
      notation: 'BB CS',
      base: 1,
      outNum: 1,
      hasEndedInningLine: false,
    });
    expect(game.awayLineup.rows[0].innings['1'].advancements).toEqual([{ from: 1, to: 2, scored: false }]);
  });

  it('does not mark a run when a runner is caught stealing home', () => {
    let game = apply(createDefaultGame(), event('SINGLE'), event('SINGLE'), event('SINGLE'));
    expect(game.runners[2]).toBe(true);
    game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 4 });
    expect(game.awayScore).toBe(0);
    expect(game.awayLineup.rows[0].runs).toBe(0);
    expect(game.outs).toBe(1);
    expect(game.runners[2]).toBe(false);
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({
      notation: '1B CS',
      outNum: 1,
      run: false,
    });
    expect(game.awayLineup.rows[0].innings['1'].advancements).toContainEqual({ from: 3, to: 4, scored: false });
  });

  it('ends the inning on a caught stealing for the third out', () => {
    let game = apply(createDefaultGame(), event('WALK'), event('STRIKEOUT'), event('STRIKEOUT'));
    expect(game.outs).toBe(2);
    game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
    expect(game.half).toBe('BOTTOM');
    expect(game.awayLineup.rows[0].innings['1']).toMatchObject({
      notation: 'BB CS',
      outNum: 3,
      hasEndedInningLine: true,
    });
  });

  it('advances runners on a sacrifice bunt without charging an at-bat', () => {
    let game = reduceGame(createDefaultGame(), event('SINGLE'));
    game = reduceGame(game, { type: 'SACRIFICE_BUNT', fieldPos: 1 });
    expect(game.outs).toBe(1);
    expect(game.runners).toEqual([false, true, false]);
    expect(game.awayLineup.rows[1].atBats).toBe(0);
    expect(game.awayLineup.rows[1].innings['1']).toMatchObject({ notation: 'SH1', outNum: 1 });
  });
});
