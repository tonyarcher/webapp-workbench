import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {createGame} from 'football-core';
import type {LiveLocalGameState} from './game-state';
import {DEFAULT_GAME_SETUP} from './game-types';
import {
    SAVE_STATE_VERSION,
    clearGameState,
    isValidPersistedGameState,
    loadGameState,
    saveGameState,
} from './save-state';

function sampleGame(): LiveLocalGameState {
    return {
        setup: DEFAULT_GAME_SETUP,
        engine: createGame(DEFAULT_GAME_SETUP),
        historyIndex: 0,
        events: [],
    };
}

beforeEach(async () => {
    await clearGameState();
});

describe('saveGameState / loadGameState', () => {
    it('round-trips a game through IndexedDB', async () => {
        const game = sampleGame();
        await saveGameState(game);
        await expect(loadGameState()).resolves.toEqual(game);
    });

    it('returns null when nothing is stored', async () => {
        await expect(loadGameState()).resolves.toBeNull();
    });

    it('rejects a mismatched version', () => {
        expect(isValidPersistedGameState({
            version: SAVE_STATE_VERSION + 1,
            savedAt: '2026-09-06T00:00:00.000Z',
            setup: DEFAULT_GAME_SETUP,
            engine: createGame(DEFAULT_GAME_SETUP),
            historyIndex: 0,
            events: [],
        })).toBe(false);
    });
});
