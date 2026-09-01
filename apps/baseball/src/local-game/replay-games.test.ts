import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from './rule-engine';
import type { EngineGameState, ScoringEvent } from './rule-engine';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';
import { buildBoxScore } from './box-score';

function apply(game: EngineGameState, ...events: ScoringEvent[]): EngineGameState {
  return events.reduce((current, event) => reduceGame(current, event), game);
}

function k(times: number): ScoringEvent[] {
  return Array.from({ length: times }, () => ({ type: 'STRIKEOUT' as const }));
}

function threeUpThreeDown(): ScoringEvent[] {
  return k(3);
}

describe('playing games: batting order over a regulation game', () => {
  it('gives every batter three official at-bats across nine 1-2-3 innings', () => {
    let game = createGame({
      homeName: 'Chicago Cubs',
      awayName: 'St. Louis Cardinals',
      homeLineup: DEFAULT_HOME_LINEUP,
      awayLineup: DEFAULT_AWAY_LINEUP,
      totalInnings: 9,
    });

    for (let inning = 1; inning <= 9; inning++) {
      game = apply(game, ...threeUpThreeDown(), ...threeUpThreeDown());
    }

    expect(game.inning).toBe(10);
    expect(game.over).toBe(false);
    expect(game.awayScore).toBe(0);
    expect(game.homeScore).toBe(0);
    for (const row of game.awayLineup.rows) {
      expect(row.atBats, `${row.batterName} away AB`).toBe(3);
    }
    for (const row of game.homeLineup.rows) {
      expect(row.atBats, `${row.batterName} home AB`).toBe(3);
    }
    expect(game.awayBatterIdx).toBe(0);
    expect(game.homeBatterIdx).toBe(0);
  });
});

describe('playing games: custom lineups actually bat', () => {
  it('starts Tony Gwynn leadoff and puts him on first', () => {
    let game = createGame({
      homeName: "Tony's All-Stars",
      awayName: 'Padres',
      homePitcherName: 'Greg Maddux',
      awayPitcherName: 'Trevor Hoffman',
      totalInnings: 9,
      homeLineup: [{ batterName: 'Nico Hoerner', position: '2B' }],
      awayLineup: [
        { batterName: 'Tony Gwynn', position: 'RF', jerseyNumber: 19 },
        { batterName: 'Steve Finley', position: 'CF', jerseyNumber: 12 },
      ],
    });
    expect(game.awayLineup.rows[0].batterName).toBe('Tony Gwynn');
    expect(game.awayLineup.pitcherName).toBe('Trevor Hoffman');
    game = reduceGame(game, { type: 'SINGLE' });
    expect(game.awayLineup.rows[0].hits).toBe(1);
    expect(game.runnerSlots).toEqual([1, null, null]);
  });
});

describe('playing games: Kirk Gibson walk-off shape', () => {
  it('scores a two-run walk-off homer with a runner on second', () => {
    let game = createGame({
      homeName: 'Dodgers',
      awayName: 'Athletics',
      totalInnings: 1,
      homePitcherName: 'Orel Hershiser',
      awayPitcherName: 'Dennis Eckersley',
      awayLineup: [
        { batterName: 'Jose Canseco', position: 'LF' },
        { batterName: 'Mark McGwire', position: '1B' },
        { batterName: 'Dave Henderson', position: 'CF' },
      ],
      homeLineup: [
        { batterName: 'Steve Sax', position: '2B' },
        { batterName: 'Mike Davis', position: 'RF' },
        { batterName: 'Kirk Gibson', position: 'LF' },
      ],
    });

    game = apply(game, { type: 'HOME_RUN' }, ...k(3));
    expect(game.half).toBe('BOTTOM');
    expect(game.awayScore).toBe(1);
    expect(game.homeScore).toBe(0);

    game = apply(game, { type: 'STRIKEOUT' }, { type: 'WALK' }, { type: 'STOLEN_BASE', base: 2 }, { type: 'HOME_RUN' });
    expect(game.homeScore).toBe(2);
    expect(game.over).toBe(true);
    expect(game.homeLineup.rows[1].batterName).toBe('Mike Davis');
    expect(game.homeLineup.rows[1].runs).toBe(1);
    expect(game.homeLineup.rows[1].atBats).toBe(0);
    expect(game.homeLineup.rows[2].batterName).toBe('Kirk Gibson');
    expect(game.homeLineup.rows[2].runs).toBe(1);
    expect(game.homeLineup.rows[2].rbi).toBe(2);
  });
});

describe('playing games: a messy sandlot half-inning', () => {
  it('tracks HBP, stolen bases, a sac fly, and the right batter still hitting', () => {
    let game = createGame({
      homeName: 'Cubs',
      awayName: 'Cardinals',
      homeLineup: DEFAULT_HOME_LINEUP,
      awayLineup: DEFAULT_AWAY_LINEUP,
      totalInnings: 9,
    });

    game = apply(
      game,
      { type: 'HIT_BY_PITCH' },
      { type: 'STOLEN_BASE', base: 2 },
      { type: 'WALK' },
      { type: 'SINGLE' },
      { type: 'SACRIFICE_FLY', fieldPos: 8 },
      { type: 'WILD_PITCH' },
      { type: 'SINGLE' },
      { type: 'GROUNDOUT', fieldPos: 6 }
    );

    expect(game.awayScore).toBe(2);
    expect(game.outs).toBe(2);
    expect(game.awayLineup.rows[0].runs).toBe(1);
    expect(game.awayLineup.rows[0].atBats).toBe(0);
    expect(game.awayLineup.rows[1].runs).toBe(1);
    expect(game.awayLineup.rows[1].atBats).toBe(0);
    expect(game.awayLineup.rows[2].rbi).toBe(1);
    expect(game.awayLineup.rows[3].atBats).toBe(0);
    expect(game.awayLineup.rows[3].innings['1']).toMatchObject({ notation: 'SF8' });
    expect(game.awayBatterIdx).toBe(6);
  });

  it('credits every grand slam run to the player who scored it', () => {
    let game = createGame({
      homeName: 'Cubs',
      awayName: 'Cardinals',
      homeLineup: DEFAULT_HOME_LINEUP,
      awayLineup: DEFAULT_AWAY_LINEUP,
      totalInnings: 9,
    });
    game = apply(game, { type: 'WALK' }, { type: 'WALK' }, { type: 'WALK' }, { type: 'HOME_RUN' });
    expect(game.awayScore).toBe(4);
    expect(game.awayLineup.rows[0].runs).toBe(1);
    expect(game.awayLineup.rows[1].runs).toBe(1);
    expect(game.awayLineup.rows[2].runs).toBe(1);
    expect(game.awayLineup.rows[3].runs).toBe(1);
    expect(game.awayLineup.rows[3].rbi).toBe(4);
    const box = buildBoxScore(game);
    expect(box.away.runs).toBe(4);
    expect(box.away.hits).toBe(1);
  });
});

describe('playing games: a full nine-inning script', () => {
  it('ends 3-2 when the home team cannot catch a two-run ninth', () => {
    let game = createGame({
      homeName: 'Cubs',
      awayName: 'Cardinals',
      homeLineup: DEFAULT_HOME_LINEUP,
      awayLineup: DEFAULT_AWAY_LINEUP,
      totalInnings: 9,
    });

    game = apply(game, { type: 'HOME_RUN' }, ...k(3));
    game = apply(game, ...threeUpThreeDown());
    for (let inning = 2; inning <= 8; inning++) {
      game = apply(game, ...threeUpThreeDown(), ...threeUpThreeDown());
    }

    // Top 9: two on, a triple plates both, then two Ks.
    game = apply(
      game,
      { type: 'WALK' },
      { type: 'WALK' },
      { type: 'TRIPLE' },
      { type: 'STRIKEOUT' },
      { type: 'STRIKEOUT' },
      { type: 'STRIKEOUT' }
    );
    expect(game.awayScore).toBe(3);
    expect(game.half).toBe('BOTTOM');
    expect(game.inning).toBe(9);

    game = apply(game, { type: 'HOME_RUN' }, { type: 'HOME_RUN' }, ...k(3));
    expect(game.homeScore).toBe(2);
    expect(game.over).toBe(true);

    const box = buildBoxScore(game);
    expect(box.away.runs).toBe(3);
    expect(box.home.runs).toBe(2);
    expect(box.away.batting.reduce((sum, line) => sum + line.ab, 0)).toBeGreaterThan(24);
  });
});
