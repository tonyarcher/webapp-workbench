import {describe, expect, it} from 'vitest';
import {NBA, NCAA, NFHS, RULEBOOKS, WNBA, bonusKind, getRulebook, isHalfTime, oppositeTeam, periodLabel} from './rulebook';

describe('rulebooks', () => {
    it('exposes four levels', () => {
        expect(Object.keys(RULEBOOKS)).toEqual(['nfhs', 'ncaa', 'nba', 'wnba']);
        expect(getRulebook('nba')).toBe(NBA);
        expect(NFHS.court.length).toBe(84);
        expect(NCAA.regulationPeriods).toBe(2);
        expect(NBA.periodLengthSeconds).toBe(720);
        expect(WNBA.periodLengthSeconds).toBe(600);
        expect(NBA.shotClockOrebSeconds).toBe(14);
        expect(NCAA.shotClockOrebSeconds).toBe(20);
    });

    it('labels periods and halves', () => {
        expect(periodLabel(1, 4)).toBe('Q1');
        expect(periodLabel(1, 2)).toBe('1st');
        expect(periodLabel(2, 2)).toBe('2nd');
        expect(periodLabel(5, 4)).toBe('OT');
        expect(periodLabel(6, 4)).toBe('2OT');
        expect(isHalfTime(2, 4)).toBe(true);
        expect(isHalfTime(1, 2)).toBe(true);
        expect(isHalfTime(1, 4)).toBe(false);
        expect(oppositeTeam('home')).toBe('away');
        expect(oppositeTeam('away')).toBe('home');
    });

    it('computes bonus from team fouls', () => {
        expect(bonusKind(NBA, 4)).toBe('none');
        expect(bonusKind(NBA, 5)).toBe('double');
        expect(bonusKind(NCAA, 6)).toBe('none');
        expect(bonusKind(NCAA, 7)).toBe('one-and-one');
        expect(bonusKind(NCAA, 10)).toBe('double');
        expect(bonusKind(NFHS, 7)).toBe('one-and-one');
    });
});
