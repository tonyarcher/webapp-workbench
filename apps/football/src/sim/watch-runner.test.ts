import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {GameStore} from '../local-game/game-store';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {clearGameState} from '../local-game/save-state';
import {WatchRunner, highlightLabel, watchLoopAlive} from './watch-runner';

beforeEach(async () => {
    await clearGameState();
});

describe('WatchRunner', () => {
    it('winds a long game down instead of stalling at the event cap', () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'watch', simSeed: 68});
        const runner = new WatchRunner();
        for (;;) {
            const game = store.current();
            if (!game) break;
            const event = runner.takeEvent(game);
            if (!event) break;
            store.recordEvent(event);
        }
        const game = store.current();
        expect(game?.historyIndex).toBeGreaterThan(400);
        expect(game?.engine.over).toBe(true);
    });

    it('refuses to emit events for a score-mode game', () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'score'});
        expect(new WatchRunner().takeEvent(store.current()!)).toBeNull();
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
        expect(watchLoopAlive(true, true, false)).toBe(true);
        expect(watchLoopAlive(false, true, false)).toBe(false);
        expect(watchLoopAlive(true, false, false)).toBe(false);
    });
});
