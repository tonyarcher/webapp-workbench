import { describe, expect, it } from 'vitest';
import { generateRoster } from './default-roster';
import { goalToGoDistance } from './down-distance';
import { createGame, reduce } from './reduce';
import type { GameSetup, GameState, Personnel, PlayInput } from './types';

const NFL_SETUP: GameSetup = {
    homeName: 'Hawks',
    awayName: 'Comets',
    rulebookId: 'nfl',
    receivingTeam: 'away',
};

function afterKickoff(clock = 900): GameState {
    return reduce(createGame(NFL_SETUP), {
        type: 'play',
        input: { family: 'kickoff', touchback: true, snapClock: clock, deadClock: clock },
    });
}

function snap(game: GameState, input: Omit<PlayInput, 'snapClock' | 'deadClock'>): GameState {
    const clock = game.clock.gameClockSeconds;
    return reduce(game, { type: 'play', input: { ...input, snapClock: clock, deadClock: clock } });
}

function eleven(): string[] {
    return Array.from({ length: 11 }, (_, i) => `p${i + 1}`);
}

function personnel(grouping: string, size = 11): Personnel {
    return { offense: eleven().slice(0, size), defense: eleven().slice(0, size), grouping };
}

describe('set_personnel', () => {
    it('takes a valid eleven on each side', () => {
        const next = reduce(afterKickoff(), { type: 'set_personnel', personnel: personnel('21') });

        expect(next.personnel.grouping).toBe('21');
        expect(next.personnel.offense).toHaveLength(11);
        expect(next.personnel.defense).toHaveLength(11);
    });

    it('refuses a group that is not eleven, leaving the game untouched', () => {
        const before = afterKickoff();
        const next = reduce(before, { type: 'set_personnel', personnel: personnel('10', 10) });

        expect(next.personnel).toEqual(before.personnel);
        expect(next).toBe(before);
    });
});

describe('penalty', () => {
    const foul = { type: 'penalty', foul: 'false start', yards: 5 } as const;

    it('backs the offence up when the offence is penalised', () => {
        const before = afterKickoff();
        const next = reduce(before, { ...foul, team: before.situation.possession, accepted: true });

        expect(next.situation.yardline100).toBe(before.situation.yardline100 + 5);
        expect(next.situation.distance).toBe(before.situation.distance + 5);
        expect(next.situation.down).toBe(before.situation.down);
        expect(next.clock.running).toBe(false);
    });

    it('moves the defence back when the defence is penalised', () => {
        const before = afterKickoff();
        const next = reduce(before, {
            ...foul,
            team: before.situation.possession === 'home' ? 'away' : 'home',
            accepted: true,
        });

        expect(next.situation.yardline100).toBe(before.situation.yardline100 - 5);
        expect(next.situation.distance).toBe(before.situation.distance - 5);
        expect(next.clock.running).toBe(false);
    });

    it('gives a first down when the defence-penalised gain loses the down', () => {
        const before = afterKickoff();
        const next = reduce(before, {
            type: 'penalty',
            team: before.situation.possession === 'home' ? 'away' : 'home',
            foul: 'offside',
            yards: before.situation.distance + 4,
            accepted: true,
        });

        expect(next.situation.down).toBe(1);
        expect(next.situation.distance).toBe(goalToGoDistance(next.situation.yardline100));
    });

    it('stops the clock without moving the ball when the penalty is declined', () => {
        const before = afterKickoff();
        const next = reduce(before, { ...foul, team: before.situation.possession, accepted: false });

        expect(next.situation).toEqual(before.situation);
        expect(next.clock.running).toBe(false);
    });

    it('treats a zero-yard foul as declined', () => {
        const before = afterKickoff();
        const next = reduce(before, { ...foul, team: before.situation.possession, yards: 0, accepted: true });

        expect(next.situation).toEqual(before.situation);
        expect(next.clock.running).toBe(false);
    });

    it('never backs the ball past the goal line or its own end zone', () => {
        // A loss past the 100 would read as a safety, so aim just inside it.
        const deep = snap(afterKickoff(), { family: 'scrimmage', concept: 'draw', yards: -28 });
        expect(deep.situation.yardline100).toBe(98);

        const long = reduce(deep, {
            type: 'penalty',
            team: deep.situation.possession,
            foul: 'delay of game',
            yards: 10,
            accepted: true,
        });
        expect(long.situation.yardline100).toBe(99);

        const atGoal = snap(afterKickoff(), { family: 'scrimmage', concept: 'draw', yards: 69 });
        expect(atGoal.situation.yardline100).toBe(1);
        const short = reduce(atGoal, {
            type: 'penalty',
            team: atGoal.situation.possession === 'home' ? 'away' : 'home',
            foul: 'offside',
            yards: 10,
            accepted: true,
        });
        expect(short.situation.yardline100).toBe(1);
    });
});

describe('play families the reducer does not dispatch', () => {
    it('leaves the game untouched for a family with no reducer of its own', () => {
        const before = afterKickoff();
        for (const family of ['penalty', 'timeout', 'period_end'] as const) {
            const next = snap(before, { family });
            expect(next).toBe(before);
        }
    });

    it('ignores an unknown event type', () => {
        const before = afterKickoff();
        const next = reduce(before, { type: 'nonsense' } as never);
        expect(next).toBe(before);
    });

    it('ignores anything once the game is over', () => {
        const over: GameState = { ...afterKickoff(), over: true };
        const next = reduce(over, { type: 'set_personnel', personnel: personnel('21') });
        expect(next).toBe(over);
    });
});

describe('rosters supplied by the caller', () => {
    it('uses the rosters it is given instead of generating them', () => {
        const home = generateRoster('home').map((p) => ({ ...p, id: `H-${p.id}` }));
        const away = generateRoster('away').map((p) => ({ ...p, id: `A-${p.id}` }));

        const game = createGame({ ...NFL_SETUP, homeRoster: home, awayRoster: away });

        // createGame seeds personnel from the kicking side, so with 'away'
        // receiving, the opening eleven on offense come from the home roster.
        expect(game.personnel.offense.every((id) => id.startsWith('H-'))).toBe(true);
        expect(game.personnel.defense.every((id) => id.startsWith('A-'))).toBe(true);
    });

    it('falls back to generated rosters when the caller supplies none', () => {
        const empty = createGame({ ...NFL_SETUP, homeRoster: [], awayRoster: [] });
        const bare = createGame(NFL_SETUP);

        expect(empty.personnel).toEqual(bare.personnel);
    });
});

describe('clock guards on scorer input', () => {
    it('ignores a play whose clocks are not finite', () => {
        const before = afterKickoff();
        const next = reduce(before, {
            type: 'play',
            input: { family: 'scrimmage', snapClock: Number.NaN, deadClock: 900 },
        });

        expect(next).toBe(before);
    });

    it('ignores a play with a negative clock', () => {
        const before = afterKickoff();
        const next = reduce(before, {
            type: 'play',
            input: { family: 'scrimmage', snapClock: 900, deadClock: -1 },
        });

        expect(next).toBe(before);
    });
});

describe('period_end', () => {
    it('ends the game when the fourth period closes with a lead', () => {
        const base = afterKickoff();
        const atFour: GameState = {
            ...base,
            clock: { ...base.clock, period: 4 },
            score: { home: 7, away: 3 },
        };

        const next = reduce(atFour, { type: 'period_end' });

        expect(next.over).toBe(true);
    });

    it('advances the quarter rather than ending before the fourth', () => {
        const base = afterKickoff();
        const next = reduce(base, { type: 'period_end' });

        expect(next.over).toBe(false);
        expect(next.clock.period).toBe(2);
    });
});
