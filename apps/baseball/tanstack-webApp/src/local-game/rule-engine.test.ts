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

  it('resets the batting order to slot one after nine batters', () => {
    const game = apply(createDefaultGame(), ...Array.from({ length: 9 }, () => event('STRIKEOUT')));
    expect(game.awayBatterIdx).toBe(0);
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
