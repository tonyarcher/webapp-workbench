import {describe, expect, it} from 'vitest';
import {createGame} from 'football-core';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {chooseCall} from './coach';
import {mulberry32} from './rng';

describe('chooseCall', () => {
    it('kicks off when kickoff is pending', () => {
        const game = createGame(DEFAULT_GAME_SETUP);
        expect(chooseCall(game, mulberry32(1)).family).toBe('kickoff');
    });
});
