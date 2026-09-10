import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { generateMatchup } from '../sim/generate-roster';
import { mulberry32 } from '../sim/rng';
import { GameStore } from './game-store';
import { WatchRunner, watchLoopAlive } from './watch-runner';

describe('WatchRunner', () => {
  it('takes a play only in watch mode', () => {
    const rosters = generateMatchup(mulberry32(1));
    const watchStore = new GameStore();
    watchStore.startGame({
      homeTeamName: 'Cubs',
      awayTeamName: 'Pads',
      innings: 9,
      mode: 'watch',
      simSeed: 1,
      homeRoster: rosters.home,
      awayRoster: rosters.away,
    });
    const runner = new WatchRunner();
    const play = runner.takePlay(watchStore.current()!);
    expect(play).not.toBeNull();
    expect(typeof play?.type).toBe('string');
    expect(runner.playSeq).toBe(1);

    const scoreStore = new GameStore();
    scoreStore.startGame({ homeTeamName: 'Cubs', awayTeamName: 'Pads', innings: 9, mode: 'score' });
    expect(runner.takePlay(scoreStore.current()!)).toBeNull();
  });

  it('keeps the watch loop inside a connected watch shell', () => {
    expect(watchLoopAlive(true, true, false)).toBe(true);
    expect(watchLoopAlive(false, true, false)).toBe(false);
    expect(watchLoopAlive(true, false, false)).toBe(false);
    expect(watchLoopAlive(true, true, true)).toBe(false);
  });
});
