import {describe, expect, it} from 'vitest';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {mulberry32} from './rng';
import {generateMatchup} from './generate-roster';
import {simulateGame} from './simulate-game';

describe('simulateGame', () => {
    it('is deterministic for a seed', () => {
        const first = simulateGame(DEFAULT_GAME_SETUP, 21);
        const second = simulateGame(DEFAULT_GAME_SETUP, 21);
        expect(first.engine.score).toEqual(second.engine.score);
        expect(first.events).toEqual(second.events);
    });

    it('finishes with five on the floor', () => {
        const generated = generateMatchup(mulberry32(9));
        const result = simulateGame({
            ...DEFAULT_GAME_SETUP,
            homeName: generated.home.teamName,
            awayName: generated.away.teamName,
            homeRoster: generated.home.roster,
            awayRoster: generated.away.roster,
            simRatings: {...generated.home.ratings, ...generated.away.ratings},
        }, 99);
        expect(result.engine.over).toBe(true);
        expect(result.engine.home.onCourt).toHaveLength(5);
        expect(result.engine.away.onCourt).toHaveLength(5);
        expect(result.events.length).toBeGreaterThan(20);
    });

    it('winds down with period ends if the cap is tiny', () => {
        const result = simulateGame(DEFAULT_GAME_SETUP, 3, 2);
        expect(result.events.length).toBeGreaterThan(2);
        expect(result.events.some((event) => event.type === 'period_end')).toBe(true);
    });
});
