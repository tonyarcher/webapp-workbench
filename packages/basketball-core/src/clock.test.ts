import { describe, expect, it } from 'vitest';
import {
    applyStamp,
    elapsedSeconds,
    formatClock,
    formatShotClock,
    isValidStamp,
    parseClock,
    parseShotClock,
    stampFromClock,
    stepSeconds,
} from './clock';
import type { ClockState } from './types';

const CLOCK: ClockState = {
    period: 1,
    gameClockSeconds: 720,
    shotClockSeconds: 24,
    running: false,
};

describe('formatClock / parseClock', () => {
    it('round-trips mm:ss', () => {
        expect(formatClock(720)).toBe('12:00');
        expect(formatClock(65)).toBe('1:05');
        expect(parseClock('12:00')).toBe(720);
        expect(parseClock('nope')).toBeNull();
        expect(parseClock('1:60')).toBeNull();
    });
});

describe('shot clock', () => {
    it('formats and parses whole seconds', () => {
        expect(formatShotClock(24.4)).toBe('24');
        expect(parseShotClock('14')).toBe(14);
        expect(parseShotClock('')).toBeNull();
        expect(parseShotClock('24.5')).toBeNull();
    });
});

describe('stepSeconds', () => {
    it('clamps to the period length', () => {
        expect(stepSeconds(5, -10, 720)).toBe(0);
        expect(stepSeconds(710, 20, 720)).toBe(720);
        expect(stepSeconds(10, -1, 720)).toBe(9);
    });
});

describe('stamps', () => {
    it('copies clock fields and rejects junk', () => {
        expect(stampFromClock(CLOCK)).toEqual({
            period: 1,
            gameClockSeconds: 720,
            shotClockSeconds: 24,
        });
        expect(isValidStamp({ period: 0, gameClockSeconds: 1, shotClockSeconds: 1 })).toBe(false);
        expect(isValidStamp({ period: 1, gameClockSeconds: -1, shotClockSeconds: 1 })).toBe(false);
        const next = applyStamp(CLOCK, { period: 2, gameClockSeconds: 60, shotClockSeconds: 14 }, true);
        expect(next.running).toBe(true);
        expect(next.period).toBe(2);
    });

    it('elapsed time uses the countdown', () => {
        const start = { period: 1, gameClockSeconds: 100, shotClockSeconds: 24 };
        expect(elapsedSeconds(start, { ...start, gameClockSeconds: 80 })).toBe(20);
        expect(elapsedSeconds(start, { period: 2, gameClockSeconds: 720, shotClockSeconds: 24 })).toBe(100);
    });
});
