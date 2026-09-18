import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {clearGameState, loadGameState} from './save-state';
import {DEFAULT_GAME_SETUP} from './game-types';
import {GameStore} from './game-store';

beforeEach(async () => {
    await clearGameState();
});

const PAINT = {
    type: 'shot' as const,
    team: 'away' as const,
    shooterId: 'away-1',
    xFeet: 13,
    yFeet: 25,
    made: true,
    clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
};

describe('GameStore', () => {
    it('starts a game and records a make', () => {
        const store = new GameStore();
        store.startGame(DEFAULT_GAME_SETUP);
        expect(store.current()?.engine.score.away).toBe(0);
        store.recordEvent(PAINT);
        expect(store.current()?.engine.score.away).toBe(2);
        expect(store.current()?.historyIndex).toBe(1);
        expect(store.canUndo).toBe(true);
    });

    it('undoes and redoes by replaying the event log', () => {
        const store = new GameStore();
        store.startGame(DEFAULT_GAME_SETUP);
        store.recordEvent(PAINT);
        store.recordEvent({type: 'timeout', team: 'home'});
        expect(store.current()?.engine.home.timeouts).toBe(6);
        store.undo();
        expect(store.current()?.engine.home.timeouts).toBe(7);
        store.redo();
        expect(store.current()?.engine.home.timeouts).toBe(6);
        store.undo();
        store.undo();
        expect(store.current()?.historyIndex).toBe(0);
        store.undo();
        expect(store.current()?.historyIndex).toBe(0);
    });

    it('persists and hydrates', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, homeName: 'Harbor'});
        store.recordEvent(PAINT);
        await store.flushPersist();
        await expect(loadGameState()).resolves.toMatchObject({
            setup: {homeName: 'Harbor'},
            historyIndex: 1,
        });
        const restored = new GameStore();
        await restored.hydrate();
        expect(restored.current()?.setup.homeName).toBe('Harbor');
        expect(restored.current()?.engine.shots).toHaveLength(1);
    });

    it('defers watch-mode persist until flushPersist', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'watch', simSeed: 1, homeName: 'Watch'});
        await store.flushPersist();
        store.recordEvent(PAINT);
        await expect(loadGameState()).resolves.toMatchObject({historyIndex: 0});
        await store.flushPersist();
        await expect(loadGameState()).resolves.toMatchObject({
            setup: {homeName: 'Watch', mode: 'watch'},
            historyIndex: 1,
        });
    });

    it('newGame drops a pending watch persist', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'watch', simSeed: 1});
        store.recordEvent(PAINT);
        store.newGame();
        await store.flushPersist();
        await expect(loadGameState()).resolves.toBeNull();
        expect(store.current()).toBeNull();
        store.recordEvent(PAINT);
        expect(store.current()).toBeNull();
    });

    it('hydrates nothing and reports redo', async () => {
        const empty = new GameStore();
        empty.undo();
        empty.redo();
        await empty.hydrate();
        expect(empty.current()).toBeNull();
        expect(empty.canRedo).toBe(false);
        empty.startGame(DEFAULT_GAME_SETUP);
        empty.recordEvent(PAINT);
        empty.undo();
        expect(empty.canRedo).toBe(true);
        empty.redo();
        expect(empty.canRedo).toBe(false);
        empty.redo();
        expect(empty.current()?.historyIndex).toBe(1);
        empty.recordEvent({type: 'nope'} as unknown as import('basketball-core').ScoringEvent);
        expect(empty.current()?.historyIndex).toBe(1);
    });

    it('watch persist fires after debounce', async () => {
        const store = new GameStore();
        store.startGame({...DEFAULT_GAME_SETUP, mode: 'watch', simSeed: 2});
        store.recordEvent(PAINT);
        store.recordEvent({type: 'timeout', team: 'home'});
        await new Promise((resolve) => {
            setTimeout(resolve, 450);
        });
        await expect(loadGameState()).resolves.toMatchObject({historyIndex: 2});
    });

    it('notifies subscribers', () => {
        const store = new GameStore();
        const seen: number[] = [];
        const unsub = store.subscribe((state) => {
            seen.push(state?.historyIndex ?? -1);
        });
        store.startGame(DEFAULT_GAME_SETUP);
        store.recordEvent(PAINT);
        unsub();
        store.recordEvent({type: 'timeout', team: 'away'});
        expect(seen[0]).toBe(-1);
        expect(seen.includes(1)).toBe(true);
    });
});
