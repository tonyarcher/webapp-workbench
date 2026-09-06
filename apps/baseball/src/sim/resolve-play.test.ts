import { describe, expect, it } from 'vitest';
import { createGame, reduceGame } from '../local-game/rule-engine';
import type { ScoringEventType } from '../local-game/rule-engine';
import { generateRoster } from './generate-roster';
import { matchupFromGame } from './matchup';
import { mulberry32 } from './rng';
import { nextPlay } from './resolve-play';
import { toScoringEvent } from './simulate-game';

const LEGAL: ScoringEventType[] = [
  'BALL',
  'STRIKE',
  'FOUL',
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
  'SACRIFICE_BUNT',
  'ERROR',
  'FIELDER_CHOICE',
  'STOLEN_BASE',
  'CAUGHT_STEALING',
  'WILD_PITCH',
  'PASSED_BALL',
  'BALK',
];

describe('nextPlay', () => {
  it('emits only legal scoring events and valid extras', () => {
    const home = generateRoster(mulberry32(5), 'Home');
    const away = generateRoster(mulberry32(6), 'Away');
    let engine = createGame({
      homeName: home.teamName,
      awayName: away.teamName,
      homeLineup: home.lineup,
      awayLineup: away.lineup,
      totalInnings: 3,
      homePitcherName: home.pitcher.name,
      awayPitcherName: away.pitcher.name,
    });
    for (let i = 0; i < 80 && !engine.over; i++) {
      const play = nextPlay(engine, matchupFromGame(engine, home, away), mulberry32(1000 + i));
      expect(LEGAL, play.type).toContain(play.type);
      const fieldPos = play.detail.fieldPos;
      if (typeof fieldPos === 'number') {
        expect(fieldPos).toBeGreaterThanOrEqual(1);
        expect(fieldPos).toBeLessThanOrEqual(9);
      }
      const zone = (play.detail.pitchLocation as { zone?: number } | undefined)?.zone;
      if (typeof zone === 'number') {
        expect(zone).toBeGreaterThanOrEqual(1);
        expect(zone).toBeLessThanOrEqual(9);
      }
      if (play.type === 'STOLEN_BASE' || play.type === 'CAUGHT_STEALING') {
        expect(engine.runners[(Number(play.detail.base) || 2) - 2]).toBe(true);
      }
      engine = reduceGame(engine, toScoringEvent(play));
    }
  });

  it('picks a pitch from the pitcher arsenal', () => {
    const home = generateRoster(mulberry32(5), 'Home');
    const away = generateRoster(mulberry32(6), 'Away');
    home.pitcher.ratings.arsenal = ['Fastball', 'Slider'];
    const engine = createGame({
      homeName: home.teamName,
      awayName: away.teamName,
      homeLineup: home.lineup,
      awayLineup: away.lineup,
      totalInnings: 9,
      homePitcherName: home.pitcher.name,
      awayPitcherName: away.pitcher.name,
    });
    const play = nextPlay(engine, matchupFromGame(engine, home, away), () => 0.1);
    if (play.detail.pitchType) {
      expect(['Fastball', 'Slider']).toContain(play.detail.pitchType);
    }
  });
});
