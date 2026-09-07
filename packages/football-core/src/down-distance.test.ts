import {describe, expect, it} from 'vitest';
import {advanceDownDistance, applyYards, flipPossession} from './down-distance';
import type {Situation} from './types';

const firstAndTen: Situation = {
    down: 1,
    distance: 10,
    yardline100: 70,
    hash: 'middle',
    possession: 'away',
};

describe('applyYards', () => {
    it('gaining yards walks toward the opponent end zone', () => {
        expect(applyYards(70, 4)).toEqual({yardline100: 66, touchdown: false, safety: false});
    });

    it('reaching the end zone is a touchdown', () => {
        expect(applyYards(5, 5)).toEqual({yardline100: 0, touchdown: true, safety: false});
    });

    it('being tackled in the own end zone is a safety', () => {
        expect(applyYards(98, -3)).toEqual({yardline100: 100, touchdown: false, safety: true});
    });
});

describe('advanceDownDistance', () => {
    it('1st & 10 gain 4 becomes 2nd & 6', () => {
        const next = advanceDownDistance(firstAndTen, 4);
        expect(next).toMatchObject({down: 2, distance: 6, yardline100: 66, firstDown: false, turnoverOnDowns: false});
    });

    it('gain of 10 is a new first down', () => {
        const next = advanceDownDistance(firstAndTen, 10);
        expect(next).toMatchObject({down: 1, distance: 10, yardline100: 60, firstDown: true});
    });

    it('incomplete keeps the line of scrimmage and consumes a down', () => {
        const next = advanceDownDistance(firstAndTen, 12, {incomplete: true});
        expect(next).toMatchObject({down: 2, distance: 10, yardline100: 70, firstDown: false});
    });

    it('4th down failure is turnover on downs', () => {
        const fourth: Situation = {...firstAndTen, down: 4, distance: 2, yardline100: 40};
        const next = advanceDownDistance(fourth, 1);
        expect(next.turnoverOnDowns).toBe(true);
        expect(next.yardline100).toBe(39);
    });

    it('first down inside the 10 is 1st & goal', () => {
        const redZone: Situation = {...firstAndTen, yardline100: 12, distance: 10};
        const next = advanceDownDistance(redZone, 10);
        expect(next).toMatchObject({down: 1, distance: 2, yardline100: 2, firstDown: true});
    });
});

describe('flipPossession', () => {
    it('mirrors the spot for the other team', () => {
        const flipped = flipPossession(firstAndTen, 40);
        expect(flipped.possession).toBe('home');
        expect(flipped.down).toBe(1);
        expect(flipped.yardline100).toBe(60);
    });
});
