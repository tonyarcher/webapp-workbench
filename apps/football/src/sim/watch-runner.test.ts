import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {GameStore} from '../local-game/game-store';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {clearGameState} from '../local-game/save-state';
import {WatchRunner, highlightLabel} from './watch-runner';

beforeEach(async () => {
    await clearGameState();
});

function runnerFor(store: GameStore): WatchRunner {
    return new WatchRunner({
        getGame: () => store.current(),
        record: (event) => store.recordEvent(event),
        flush: () => {},
        onChange: () => {},
        wait: () => Promise.resolve(),
    });
}

describe('WatchRunner', () => {
    it('winds a long game down instead of stalling at the event cap', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'watch', simSeed: 68});
        const runner = runnerFor(store);
        runner.speed = 0;
        runner.animations = false;
        await runner.play(true);
        const game = store.current();
        expect(game?.historyIndex).toBeGreaterThan(400);
        expect(game?.engine.over).toBe(true);
        await store.flushPersist();
    });

    it('maps sim families to the pad labels', () => {
        expect(highlightLabel({
            type: 'play',
            input: {family: 'kickoff', touchback: true, snapClock: 720, deadClock: 720},
        })).toBe('Kickoff TB');
        expect(highlightLabel({
            type: 'play',
            input: {family: 'scrimmage', concept: 'inside_zone', snapClock: 720, deadClock: 700, yards: 3},
        })).toBe('Run');
        expect(highlightLabel({type: 'period_end'})).toBe('Period end');
        expect(highlightLabel(null)).toBeNull();
    });
});
