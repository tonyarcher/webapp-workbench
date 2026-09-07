import { describe, expect, it } from 'vitest';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';
import { createGame, reduceGame } from './rule-engine';
import { defendingTeamName, defenseFielders, matchupHands } from './game-shell-helpers';

function createDefaultGame() {
  return createGame({
    homeName: 'Chicago Cubs',
    awayName: 'St. Louis Cardinals',
    homeLineup: DEFAULT_HOME_LINEUP,
    awayLineup: DEFAULT_AWAY_LINEUP,
    homePitcherName: 'Shota Imanaga',
    awayPitcherName: 'Sonny Gray',
    totalInnings: 9,
  });
}

describe('defenseFielders', () => {
  it('lists the nine fielders for the defending team', () => {
    const fielders = defenseFielders(createDefaultGame());
    expect(fielders.map((row) => row.posName)).toEqual(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);
    expect(fielders.find((row) => row.posName === 'P')?.playerName).toBe('Shota Imanaga');
    expect(fielders.find((row) => row.posName === 'SS')?.playerName).toBe('Dansby Swanson');
    expect(defendingTeamName(createDefaultGame())).toBe('Chicago Cubs');
  });

  it('switches to the away defense in the bottom half', () => {
    let game = createDefaultGame();
    game = reduceGame(game, { type: 'STRIKEOUT' });
    game = reduceGame(game, { type: 'STRIKEOUT' });
    game = reduceGame(game, { type: 'STRIKEOUT' });
    expect(defendingTeamName(game)).toBe('St. Louis Cardinals');
    const fielders = defenseFielders(game);
    expect(fielders.find((row) => row.posName === 'P')?.playerName).toBe('Sonny Gray');
    expect(fielders.find((row) => row.posName === '3B')?.playerName).toBe('Nolan Arenado');
  });
});

describe('matchupHands', () => {
  it('defaults to right-handed without rosters', () => {
    expect(
      matchupHands({
        setup: { homeTeamName: 'Cubs', awayTeamName: 'Cards', innings: 9 },
        engine: createDefaultGame(),
        historyIndex: 0,
        events: [],
      })
    ).toEqual({ batterBats: 'R', pitcherThrows: 'R' });
  });
});
