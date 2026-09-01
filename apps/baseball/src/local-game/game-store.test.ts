import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { GameStore } from './game-store';
import { DEFAULT_AWAY_PITCHER, DEFAULT_HOME_PITCHER } from './default-lineups';

describe('GameStore lineups', () => {
  it('starts a game with the custom batting orders from setup', () => {
    const store = new GameStore();
    store.startGame({
      homeTeamName: 'Cubs',
      awayTeamName: 'Padres',
      innings: 9,
      awayPitcherName: 'Trevor Hoffman',
      homePitcherName: 'Shota Imanaga',
      awayLineup: [
        { batterName: 'Tony Gwynn', position: 'RF', jerseyNumber: 19 },
        { batterName: 'Steve Finley', position: 'CF', jerseyNumber: 12 },
      ],
      homeLineup: [{ batterName: 'Ryne Sandberg', position: '2B', jerseyNumber: 23 }],
    });

    const game = store.current();
    expect(game?.engine.awayLineup.rows[0].batterName).toBe('Tony Gwynn');
    expect(game?.engine.awayLineup.rows[0].jerseyNumber).toBe(19);
    expect(game?.engine.homeLineup.rows[0].batterName).toBe('Ryne Sandberg');
    expect(game?.engine.awayLineup.pitcherName).toBe('Trevor Hoffman');
    expect(game?.engine.homeLineup.pitcherName).toBe('Shota Imanaga');
  });

  it('falls back to the default Cubs/Cardinals orders when setup omits lineups', () => {
    const store = new GameStore();
    store.startGame({ homeTeamName: 'Chicago Cubs', awayTeamName: 'St. Louis Cardinals', innings: 9 });
    const game = store.current();
    expect(game?.engine.awayLineup.rows[0].batterName).toBe('Brendan Donovan');
    expect(game?.engine.homeLineup.rows[0].batterName).toBe('Nico Hoerner');
    expect(game?.engine.homeLineup.pitcherName).toBe(DEFAULT_HOME_PITCHER);
    expect(game?.engine.awayLineup.pitcherName).toBe(DEFAULT_AWAY_PITCHER);
  });

  it('applies a mid-game SET_LINEUP event and undoes it', () => {
    const store = new GameStore();
    store.startGame({ homeTeamName: 'Cubs', awayTeamName: 'Padres', innings: 9 });
    store.recordEvent({
      id: 1,
      eventType: 'SET_LINEUP',
      occurredAt: '2026-08-31T00:00:00.000Z',
      detail: {
        awayLineup: [{ batterName: 'Tony Gwynn', position: 'RF', jerseyNumber: 19 }],
        awayPitcherName: 'Trevor Hoffman',
      },
    });
    expect(store.current()?.engine.awayLineup.rows[0].batterName).toBe('Tony Gwynn');
    store.undo();
    expect(store.current()?.engine.awayLineup.rows[0].batterName).toBe('Brendan Donovan');
    store.redo();
    expect(store.current()?.engine.awayLineup.rows[0].batterName).toBe('Tony Gwynn');
  });

  it('does not shift later batting slots when a SET_LINEUP entry has a blank name', () => {
    const store = new GameStore();
    store.startGame({ homeTeamName: 'Cubs', awayTeamName: 'Padres', innings: 9 });
    store.recordEvent({
      id: 1,
      eventType: 'SET_LINEUP',
      occurredAt: '2026-08-31T00:00:00.000Z',
      detail: {
        awayLineup: [
          { batterName: '', position: 'RF' },
          { batterName: 'Steve Finley', position: 'CF', jerseyNumber: 12 },
        ],
      },
    });
    const rows = store.current()?.engine.awayLineup.rows ?? [];
    expect(rows[0]?.batterName).toBe('Brendan Donovan');
    expect(rows[1]?.batterName).toBe('Steve Finley');
  });
});
