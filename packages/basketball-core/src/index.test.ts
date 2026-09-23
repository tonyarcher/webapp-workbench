import { describe, expect, it } from 'vitest';
import { NBA, ON_COURT, SCORING_EVENT_TYPES, createGame, formatClock } from './index';

describe('package exports', () => {
    it('re-exports the public API', () => {
        expect(NBA.id).toBe('nba');
        expect(ON_COURT).toBe(5);
        expect(SCORING_EVENT_TYPES).toContain('shot');
        expect(formatClock(60)).toBe('1:00');
        expect(
            createGame({
                homeName: 'H',
                awayName: 'A',
                rulebookId: 'wnba',
                openingPossession: 'home',
            }).clock.gameClockSeconds,
        ).toBe(600);
    });
});
