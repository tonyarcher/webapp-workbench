import {describe, expect, it} from 'vitest';
import {formatMinutes} from './box-score';
import {createGame} from './reduce';
import {describeEvent} from './notation';
import type {GameSetup} from './types';

const SETUP: GameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nba',
    openingPossession: 'away',
};

describe('notation', () => {
    it('covers each event kind', () => {
        const game = createGame(SETUP);
        expect(describeEvent({
            type: 'shot',
            team: 'away',
            shooterId: 'away-1',
            xFeet: 20,
            yFeet: 25,
            made: true,
            assistId: 'away-2',
            clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
        }, game)).toContain('G 2');
        expect(describeEvent({
            type: 'free_throw',
            shooterId: 'away-1',
            made: false,
            clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
        }, game)).toContain('miss');
        expect(describeEvent({
            type: 'rebound',
            team: 'home',
            playerId: 'home-1',
            offensive: false,
            clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
        }, game)).toContain('DREB');
        expect(describeEvent({
            type: 'turnover',
            team: 'away',
            playerId: 'away-1',
            clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
        }, game)).toContain('turnover');
        expect(describeEvent({
            type: 'foul',
            team: 'home',
            playerId: 'home-1',
            clock: {period: 1, gameClockSeconds: 700, shotClockSeconds: 24},
        }, game)).toContain('foul');
        expect(describeEvent({type: 'substitution', team: 'away', outId: 'away-1', inId: 'away-3'}, game)).toContain('sub');
        expect(describeEvent({type: 'timeout', team: 'home'}, game)).toBe('Home timeout');
        expect(describeEvent({
            type: 'set_clock',
            clock: {period: 1, gameClockSeconds: 65, shotClockSeconds: 14},
        }, game)).toBe('Clock 1:05');
        expect(describeEvent({
            type: 'set_lineup',
            team: 'home',
            onCourt: game.home.onCourt,
        }, game)).toBe('Home lineup');
        expect(formatMinutes(125)).toBe('2:05');
    });
});
