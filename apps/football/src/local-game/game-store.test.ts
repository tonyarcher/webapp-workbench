import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {clearGameState, loadGameState} from './save-state';
import {DEFAULT_GAME_SETUP} from './game-types';
import {GameStore} from './game-store';

beforeEach(async () => {
    await clearGameState();
});

describe('GameStore', () => {
    it('starts a game and records a kickoff', () => {
        const store = new GameStore();
        store.startGame(DEFAULT_GAME_SETUP);
        expect(store.current()?.engine.kickoffPending).toBe(true);
        store.recordEvent({
            type: 'play',
            input: {family: 'kickoff', touchback: true, snapClock: 720, deadClock: 720},
        });
        const game = store.current();
        expect(game?.engine.kickoffPending).toBe(false);
        expect(game?.engine.situation.possession).toBe('away');
        expect(game?.historyIndex).toBe(1);
    });

    it('undoes and redoes by replaying the event log', () => {
        const store = new GameStore();
        store.startGame(DEFAULT_GAME_SETUP);
        store.recordEvent({
            type: 'play',
            input: {family: 'kickoff', touchback: true, snapClock: 720, deadClock: 720},
        });
        store.recordEvent({
            type: 'play',
            input: {family: 'scrimmage', yards: 4, snapClock: 720, deadClock: 710},
        });
        expect(store.current()?.engine.situation.down).toBe(2);
        store.undo();
        expect(store.current()?.engine.situation.down).toBe(1);
        expect(store.current()?.engine.kickoffPending).toBe(false);
        store.redo();
        expect(store.current()?.engine.situation.down).toBe(2);
    });

    it('persists and hydrates', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, homeName: 'Eagles'});
        store.recordEvent({
            type: 'play',
            input: {family: 'kickoff', touchback: true, snapClock: 720, deadClock: 720},
        });
        await store.flushPersist();
        await expect(loadGameState()).resolves.toMatchObject({
            setup: {homeName: 'Eagles'},
            historyIndex: 1,
        });
        const restored = new GameStore();
        await restored.hydrate();
        expect(restored.current()?.setup.homeName).toBe('Eagles');
        expect(restored.current()?.engine.plays).toHaveLength(1);
    });
});
