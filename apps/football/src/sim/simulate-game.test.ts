import {describe, expect, it} from 'vitest';
import {createGame, reduce} from 'football-core';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {nextEvent, rngForEngine} from './resolve-play';
import {simulateGame} from './simulate-game';

describe('simulateGame', () => {
    it('is deterministic for a seed', () => {
        const first = simulateGame(DEFAULT_GAME_SETUP, 21);
        const second = simulateGame(DEFAULT_GAME_SETUP, 21);
        expect(first.engine.score).toEqual(second.engine.score);
        expect(first.events.length).toBe(second.events.length);
    });

    it('finishes regulation for several seeds', () => {
        for (const seed of [1, 7, 21, 99, 404]) {
            const result = simulateGame(DEFAULT_GAME_SETUP, seed);
            expect(result.events.length).toBeGreaterThan(20);
            expect(result.engine.over || result.events.length >= 450).toBe(true);
        }
    });

    it('opens with a kickoff when kickoff is pending', () => {
        const game = createGame(DEFAULT_GAME_SETUP);
        const event = nextEvent(game, rngForEngine(3, game, 0));
        expect(event.type).toBe('play');
        if (event.type === 'play') expect(event.input.family).toBe('kickoff');
        const next = reduce(game, event);
        expect(next.kickoffPending).toBe(false);
    });
});
