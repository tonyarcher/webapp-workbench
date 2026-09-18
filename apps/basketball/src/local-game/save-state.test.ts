import {beforeEach, describe, expect, it} from 'vitest';
import 'fake-indexeddb/auto';
import {createGame} from 'basketball-core';
import {DEFAULT_GAME_SETUP} from './game-types';
import {clearGameState, isValidPersistedGameState, loadGameState, saveGameState} from './save-state';

beforeEach(async () => {
    await clearGameState();
});

describe('save-state', () => {
    it('round-trips a live game', async () => {
        const engine = createGame(DEFAULT_GAME_SETUP);
        await saveGameState({
            setup: DEFAULT_GAME_SETUP,
            engine,
            historyIndex: 0,
            events: [],
        });
        await expect(loadGameState()).resolves.toMatchObject({
            setup: {homeName: 'Home', rulebookId: 'nba'},
            historyIndex: 0,
        });
    });

    it('rejects junk', () => {
        expect(isValidPersistedGameState(null)).toBe(false);
        expect(isValidPersistedGameState({version: 1})).toBe(false);
        expect(isValidPersistedGameState({
            version: 1,
            savedAt: 'now',
            setup: {homeName: 'H', awayName: 'A', rulebookId: 'nba', openingPossession: 'away'},
            engine: {over: true},
            historyIndex: 0,
            events: [],
        })).toBe(false);
        expect(isValidPersistedGameState({
            version: 1,
            savedAt: 't',
            setup: {homeName: 'H', awayName: 'A', rulebookId: 'wnba', openingPossession: 'home'},
            engine: {
                rulebookId: 'wnba',
                over: false,
                homeAttacksLeft: false,
                clock: {period: 1, gameClockSeconds: 1},
                score: {home: 0, away: 0},
                shots: [],
            },
            historyIndex: 2,
            events: [{id: 1, occurredAt: 't', event: {type: 'timeout', team: 'home'}}],
        })).toBe(false);
        expect(isValidPersistedGameState({
            version: 1,
            savedAt: 't',
            setup: {homeName: 1, awayName: 'A', rulebookId: 'nba', openingPossession: 'away'},
            engine: createGame(DEFAULT_GAME_SETUP),
            historyIndex: 0,
            events: [],
        })).toBe(false);
        expect(isValidPersistedGameState({
            version: 1,
            savedAt: 't',
            setup: DEFAULT_GAME_SETUP,
            engine: createGame(DEFAULT_GAME_SETUP),
            historyIndex: 0,
            events: [{id: 1, occurredAt: 't', event: {type: 'nope'}}],
        })).toBe(false);
    });
});
