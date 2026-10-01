import { describe, expect, it } from 'vitest';
import { clockStopsAfterPlay, formatClock, parseClock, shouldIssueTwoMinuteWarning } from './clock';
import { NFL, NFHS_CO, NFHS_MN } from './rulebook';
import type { ClockState } from './types';

function facts(overrides: Partial<Parameters<typeof clockStopsAfterPlay>[1]> = {}) {
    return {
        incomplete: false,
        outOfBounds: false,
        firstDown: false,
        scored: false,
        turnover: false,
        downBefore: 1 as const,
        period: 1,
        deadClock: 800,
        mercyActive: false,
        isTry: false,
        ...overrides,
    };
}

describe('formatClock / parseClock', () => {
    it('round-trips mm:ss', () => {
        expect(formatClock(900)).toBe('15:00');
        expect(formatClock(65)).toBe('1:05');
        expect(parseClock('12:00')).toBe(720);
        expect(parseClock('nope')).toBeNull();
    });
});

describe('clockStopsAfterPlay', () => {
    it('NFL incomplete stops the clock', () => {
        const stop = clockStopsAfterPlay(NFL, facts({ incomplete: true }));
        expect(stop).toEqual({ stops: true, reason: 'incomplete' });
    });

    it('NFHS first down always stops the clock', () => {
        const stop = clockStopsAfterPlay(NFHS_MN, facts({ firstDown: true, period: 1, deadClock: 700 }));
        expect(stop).toEqual({ stops: true, reason: 'first_down' });
    });

    it('NFL first down in Q1 does not stop the clock', () => {
        const stop = clockStopsAfterPlay(NFL, facts({ firstDown: true, period: 1, deadClock: 800 }));
        expect(stop).toEqual({ stops: false, reason: 'none' });
    });

    it('NFL first down inside two minutes stops the clock', () => {
        const stop = clockStopsAfterPlay(NFL, facts({ firstDown: true, period: 2, deadClock: 90 }));
        expect(stop).toEqual({ stops: true, reason: 'first_down' });
    });

    it('MN mercy running clock ignores incomplete', () => {
        const stop = clockStopsAfterPlay(NFHS_MN, facts({ incomplete: true, mercyActive: true, period: 4 }));
        expect(stop).toEqual({ stops: false, reason: 'none' });
    });

    it('CO mercy running clock ignores out of bounds', () => {
        const stop = clockStopsAfterPlay(NFHS_CO, facts({ outOfBounds: true, mercyActive: true, period: 2 }));
        expect(stop).toEqual({ stops: false, reason: 'none' });
    });

    it('try always stops (untimed down)', () => {
        const stop = clockStopsAfterPlay(NFL, facts({ isTry: true }));
        expect(stop).toEqual({ stops: true, reason: 'try' });
    });

    it('a score always stops, even when nothing else does', () => {
        expect(clockStopsAfterPlay(NFL, facts({ scored: true }))).toEqual({
            stops: true,
            reason: 'score',
        });
    });

    it('out of bounds stops before a turnover is considered', () => {
        expect(clockStopsAfterPlay(NFL, facts({ outOfBounds: true }))).toEqual({
            stops: true,
            reason: 'out_of_bounds',
        });
        expect(clockStopsAfterPlay(NFL, facts({ outOfBounds: true, turnover: true }))).toEqual({
            stops: true,
            reason: 'out_of_bounds',
        });
    });

    it('a turnover stops the clock', () => {
        expect(clockStopsAfterPlay(NFL, facts({ turnover: true }))).toEqual({
            stops: true,
            reason: 'change_of_possession',
        });
    });

    it('stops on fourth down only where the rulebook says so', () => {
        const fourth = facts({ downBefore: 4 });
        expect(clockStopsAfterPlay(NFHS_MN, fourth)).toEqual({ stops: true, reason: 'fourth_down' });
        expect(clockStopsAfterPlay(NFL, fourth)).toEqual({ stops: false, reason: 'none' });
    });
});

describe('shouldIssueTwoMinuteWarning', () => {
    const clock: ClockState = {
        period: 2,
        gameClockSeconds: 125,
        playClockSeconds: 40,
        running: true,
        untimed: false,
        twoMinuteWarnedThisHalf: false,
        mercyActive: false,
    };

    it('fires when a play crosses 2:00 in Q2/Q4', () => {
        expect(shouldIssueTwoMinuteWarning(NFL, clock, 125, 118)).toBe(true);
    });

    it('does not fire twice in the same half', () => {
        expect(shouldIssueTwoMinuteWarning(NFL, { ...clock, twoMinuteWarnedThisHalf: true }, 125, 118)).toBe(false);
    });

    it('does not fire under NFHS', () => {
        expect(shouldIssueTwoMinuteWarning(NFHS_MN, clock, 125, 118)).toBe(false);
    });
});
