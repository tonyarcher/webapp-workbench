import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from './rule-engine';
import { buildBoxScore } from './box-score';
import type { EngineGameState, ScoringEvent, ScoringEventType } from './rule-engine';
import type { EngineInitOptions } from './rule-engine';

function createOneInningGame(): EngineGameState {
  const options: EngineInitOptions = {
    homeName: 'Chicago Cubs',
    awayName: 'St. Louis Cardinals',
    homeLineup: [{ batterName: 'Ian Happ', position: 'LF' }],
    awayLineup: [{ batterName: 'Brendan Donovan', position: '2B' }],
    totalInnings: 1,
  };
  return createGame(options);
}

function apply(game: EngineGameState, ...events: ScoringEvent[]): EngineGameState {
  return events.reduce((current, event) => reduceGame(current, event), game);
}

function event(type: ScoringEventType): ScoringEvent {
  return { type };
}

describe('buildBoxScore', () => {
  it('starts with empty line score and zeroed team totals', () => {
    const box = buildBoxScore(createOneInningGame());
    expect(box.innings).toBe(1);
    expect(box.away.runs).toBe(0);
    expect(box.away.hits).toBe(0);
    expect(box.away.errors).toBe(0);
    expect(box.away.runsByInning).toEqual([]);
    expect(box.home.runs).toBe(0);
    expect(box.home.hits).toBe(0);
    expect(box.home.errors).toBe(0);
  });

  it('derives per-inning runs, hits, errors, and batting lines from engine state', () => {
    let game = createOneInningGame();
    game = apply(game, event('HOME_RUN'));
    game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
    game = apply(game, event('ERROR'));
    game = apply(game, event('HOME_RUN'), event('HOME_RUN'));

    const box = buildBoxScore(game);
    expect(box.away.runs).toBe(1);
    expect(box.away.hits).toBe(1);
    expect(box.away.runsByInning).toEqual([1]);
    expect(box.away.errors).toBe(1);
    expect(box.home.runs).toBe(2);
    expect(box.home.hits).toBe(1);
    expect(box.home.runsByInning).toEqual([2]);
    expect(box.home.errors).toBe(0);
    expect(box.away.batting[0]).toMatchObject({ player: 'Brendan Donovan', ab: 4, runs: 1, hits: 1, rbi: 1 });
    expect(box.home.batting[0]).toMatchObject({ player: 'Ian Happ', ab: 2, runs: 2, hits: 1, rbi: 2 });
  });

  it('reports the number of innings columns as at least the configured total', () => {
    const box = buildBoxScore(createOneInningGame());
    expect(box.innings).toBe(1);
  });
});
