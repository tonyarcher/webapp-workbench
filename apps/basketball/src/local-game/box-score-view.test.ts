import { describe, expect, it } from 'vitest';
import { createGame, reduce } from 'basketball-core';
import { DEFAULT_GAME_SETUP } from './game-types';
import { boxScoreText } from './box-score-view';

describe('box-score-view', () => {
    it('prints points for a make', () => {
        const setup = DEFAULT_GAME_SETUP;
        const made = reduce(createGame(setup), {
            type: 'shot',
            team: 'away',
            shooterId: 'away-1',
            xFeet: 13,
            yFeet: 25,
            made: true,
            clock: { period: 1, gameClockSeconds: 700, shotClockSeconds: 24 },
        });
        const text = boxScoreText(made, 'away', 'Away');
        expect(text).toContain('Away');
        expect(text).toContain('PTS');
        expect(text).toContain('2');
    });
});
