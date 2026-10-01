import { describe, expect, it } from 'vitest';
import { describePlay, formatDownDistance, formatYardline } from './notation';
import type { Play, PlayCall, PlayResult, Situation } from './types';

const HOME = 'Hawks';
const AWAY = 'Comets';

function situation(overrides: Partial<Situation> = {}): Situation {
    return { down: 1, distance: 10, yardline100: 75, hash: 'middle', possession: 'home', ...overrides };
}

function call(overrides: Partial<PlayCall> = {}): PlayCall {
    return { family: 'scrimmage', concept: 'unknown', formation: 'empty', ...overrides };
}

function result(overrides: Partial<PlayResult> = {}): PlayResult {
    return {
        yards: 5,
        firstDown: false,
        deadAtYardline100: 80,
        outOfBounds: false,
        incomplete: false,
        sack: false,
        ...overrides,
    };
}

function play(
    o: { call?: Partial<PlayCall>; result?: Partial<PlayResult>; situation?: Partial<Situation> } = {},
): Play {
    return {
        id: 'p1',
        driveId: 'd1',
        period: 1,
        clock: { snap: 900, dead: 888, playClockAtSnap: 40, stopReason: 'none' },
        situation: situation(o.situation),
        personnel: { offense: [], defense: [], grouping: 'empty' },
        call: call(o.call),
        events: [],
        result: result(o.result),
        tacklers: [],
    };
}

describe('formatYardline', () => {
    it('names the end zones rather than a number', () => {
        expect(formatYardline(0, 'home', HOME, AWAY)).toBe('end zone');
        expect(formatYardline(-5, 'home', HOME, AWAY)).toBe('end zone');
        expect(formatYardline(100, 'home', HOME, AWAY)).toBe('own end zone');
        expect(formatYardline(105, 'home', HOME, AWAY)).toBe('own end zone');
    });

    it('reads midfield as 50', () => {
        expect(formatYardline(50, 'home', HOME, AWAY)).toBe('50');
        expect(formatYardline(50, 'away', HOME, AWAY)).toBe('50');
    });

    it('counts back from the opponent end zone past midfield', () => {
        expect(formatYardline(75, 'home', HOME, AWAY)).toBe('Hawks 25');
        expect(formatYardline(75, 'away', HOME, AWAY)).toBe('Comets 25');
    });

    it('reads the near half as yards to go, attributed to the defence', () => {
        expect(formatYardline(30, 'home', HOME, AWAY)).toBe('Comets 30');
        expect(formatYardline(30, 'away', HOME, AWAY)).toBe('Hawks 30');
    });
});

describe('formatDownDistance', () => {
    it('spells every down', () => {
        expect(formatDownDistance(situation({ down: 1 }), HOME, AWAY)).toBe('1st & 10 at Hawks 25');
        expect(formatDownDistance(situation({ down: 2 }), HOME, AWAY)).toBe('2nd & 10 at Hawks 25');
        expect(formatDownDistance(situation({ down: 3 }), HOME, AWAY)).toBe('3rd & 10 at Hawks 25');
        expect(formatDownDistance(situation({ down: 4 }), HOME, AWAY)).toBe('4th & 10 at Hawks 25');
    });

    it('collapses a distance at or beyond the yardline to Goal', () => {
        expect(formatDownDistance(situation({ yardline100: 10, distance: 10 }), HOME, AWAY)).toBe(
            '1st & Goal at Comets 10',
        );
        expect(formatDownDistance(situation({ yardline100: 10, distance: 14 }), HOME, AWAY)).toBe(
            '1st & Goal at Comets 10',
        );
        expect(formatDownDistance(situation({ yardline100: 10, distance: 9 }), HOME, AWAY)).toBe(
            '1st & 9 at Comets 10',
        );
    });
});

describe('describePlay, special teams', () => {
    it('describes the units, not the yards', () => {
        expect(describePlay(play({ call: { family: 'kickoff' }, result: { yards: 0 } }), HOME, AWAY)).toBe(
            '(15:00) Kickoff',
        );
        expect(describePlay(play({ call: { family: 'punt' }, result: { yards: 40 } }), HOME, AWAY)).toBe(
            '(15:00) Punt +40',
        );
    });

    it('reports good and no good for each attempt', () => {
        expect(
            describePlay(play({ call: { family: 'extra_point' }, result: { scoring: 'extra_point' } }), HOME, AWAY),
        ).toBe('(15:00) Extra point good');
        expect(describePlay(play({ call: { family: 'extra_point' } }), HOME, AWAY)).toBe('(15:00) Extra point no good');
        expect(
            describePlay(play({ call: { family: 'two_point' }, result: { scoring: 'two_point' } }), HOME, AWAY),
        ).toBe('(15:00) Two-point good');
        expect(describePlay(play({ call: { family: 'two_point' } }), HOME, AWAY)).toBe('(15:00) Two-point no good');
        expect(
            describePlay(play({ call: { family: 'field_goal' }, result: { scoring: 'field_goal' } }), HOME, AWAY),
        ).toBe('(15:00) Field goal good');
        expect(describePlay(play({ call: { family: 'field_goal' } }), HOME, AWAY)).toBe('(15:00) Field goal no good');
    });

    it('signs only gains, so a loss reads negative', () => {
        expect(describePlay(play({ call: { family: 'punt' }, result: { yards: -4 } }), HOME, AWAY)).toBe(
            '(15:00) Punt -4',
        );
    });
});

describe('describePlay, scoring', () => {
    it('prefers a turnover touchdown over a plain one', () => {
        expect(describePlay(play({ result: { scoring: 'touchdown', yards: 10 } }), HOME, AWAY)).toBe(
            '(15:00) Touchdown +10',
        );
        expect(
            describePlay(play({ result: { scoring: 'touchdown', turnover: 'interception', yards: 0 } }), HOME, AWAY),
        ).toBe('(15:00) Interception touchdown +0');
    });

    it('only a touchdown scores on a scrimmage play', () => {
        expect(describePlay(play({ result: { scoring: 'safety', yards: 0 } }), HOME, AWAY)).toContain('scrimmage');
    });
});

describe('describePlay, scrimmage', () => {
    it('reads an incomplete pass before any turnover', () => {
        expect(describePlay(play({ result: { incomplete: true, yards: 0 } }), HOME, AWAY)).toBe(
            '(15:00) Incomplete pass',
        );
        expect(
            describePlay(play({ result: { incomplete: true, turnover: 'interception', yards: 0 } }), HOME, AWAY),
        ).toBe('(15:00) Incomplete pass');
    });

    it('names the turnover, then the sack', () => {
        expect(describePlay(play({ result: { turnover: 'interception', yards: -3 } }), HOME, AWAY)).toBe(
            '(15:00) Interception',
        );
        expect(describePlay(play({ result: { turnover: 'fumble', yards: -2 } }), HOME, AWAY)).toBe(
            '(15:00) Fumble lost -2',
        );
        expect(describePlay(play({ result: { sack: true, yards: -7 } }), HOME, AWAY)).toBe('(15:00) Sack -7');
    });

    it('names the clock-killing plays', () => {
        expect(describePlay(play({ call: { family: 'kneel' }, result: { yards: -1 } }), HOME, AWAY)).toBe(
            '(15:00) Kneel -1',
        );
        expect(describePlay(play({ call: { family: 'spike' } }), HOME, AWAY)).toBe('(15:00) Spike');
    });

    it('falls back to the family when the concept is unknown', () => {
        expect(describePlay(play(), HOME, AWAY)).toBe('(15:00) scrimmage +5 · 1st & 10 at Hawks 25');
    });

    it('spells an underscored concept for a reader', () => {
        expect(describePlay(play({ call: { concept: 'qb_sneak' } }), HOME, AWAY)).toBe(
            '(15:00) qb sneak +5 · 1st & 10 at Hawks 25',
        );
        expect(describePlay(play({ call: { concept: 'inside_zone' } }), HOME, AWAY)).toBe(
            '(15:00) inside zone +5 · 1st & 10 at Hawks 25',
        );
    });
});
