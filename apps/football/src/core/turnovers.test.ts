import { describe, expect, it } from 'vitest';
import { createGame, reduce } from './reduce';
import type { GameSetup, GameState, PlayInput } from './types';

const NFL_SETUP: GameSetup = {
    homeName: 'Hawks',
    awayName: 'Comets',
    rulebookId: 'nfl',
    receivingTeam: 'away',
};

/** A kicked-off game, so the kicking leg does not stand in for a scrimmage play. */
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

function last<T>(items: T[]): T | undefined {
    return items[items.length - 1];
}

/** The most recently closed drive, which a turnover or score leaves behind.

    find would return the FIRST completed drive, which is only correct while a
    test plays a single drive. Taking the last one keeps this right as soon as a
    scenario spans two.
*/
function closedDrive(game: GameState) {
    return game.drives.filter((drive) => drive.result !== undefined).at(-1);
}

describe('turnovers', () => {
    it('hands possession over, closes the drive, and opens one for the defence', () => {
        const next = snap(afterKickoff(), { family: 'scrimmage', interception: true, yards: 0 });

        expect(next.situation.possession).toBe('home');
        expect(last(next.plays)?.result.turnover).toBe('interception');
        expect(closedDrive(next)?.result).toBe('turnover');
        expect(closedDrive(next)?.team).toBe('away');
        expect(last(next.drives)?.team).toBe('home');
        expect(last(next.drives)?.playIds).toEqual([]);
    });

    it('scoring a turnover touchdown closes the drive as a score, not a turnover', () => {
        const next = snap(afterKickoff(), {
            family: 'scrimmage',
            interception: true,
            touchdown: true,
            yards: 0,
        });

        const play = last(next.plays);
        expect(play?.result.turnover).toBe('interception');
        expect(play?.result.scoring).toBe('touchdown');
        expect(closedDrive(next)?.result).toBe('td');
    });

    it('loses the ball on a fumble, distinct from an interception', () => {
        const next = snap(afterKickoff(), { family: 'scrimmage', fumbleLost: true, yards: -2 });

        expect(next.situation.possession).toBe('home');
        expect(last(next.plays)?.result.turnover).toBe('fumble');
        expect(closedDrive(next)?.result).toBe('turnover');
    });

    it('records both the fumble and the recovery on the play', () => {
        const next = snap(afterKickoff(), {
            family: 'scrimmage',
            concept: 'power',
            rusherId: 'r1',
            fumbleLost: true,
            fumbleOwn: true,
            yards: 0,
        });

        const kinds = last(next.plays)?.events.map((e) => e.kind);
        expect(kinds).toContain('fumble');
        expect(kinds).toContain('recovery');
    });
});

describe('scrimmage events', () => {
    it('records a pass and a catch when a passer and receiver are named', () => {
        const next = snap(afterKickoff(), {
            family: 'scrimmage',
            concept: 'slant',
            passerId: 'qb1',
            receiverId: 'wr1',
            yards: 12,
        });

        const kinds = last(next.plays)?.events.map((e) => e.kind);
        expect(kinds).toContain('pass');
        expect(kinds).toContain('catch');
        expect(kinds).not.toContain('run');
    });

    it('records a run when there is no passer or receiver', () => {
        const next = snap(afterKickoff(), {
            family: 'scrimmage',
            concept: 'power',
            rusherId: 'rb1',
            yards: 5,
        });

        expect(last(next.plays)?.events.map((e) => e.kind)).toContain('run');
    });

    it('records a run when neither passer nor receiver is named', () => {
        const next = snap(afterKickoff(), { family: 'scrimmage', concept: 'draw', yards: 4 });

        expect(last(next.plays)?.events.map((e) => e.kind)).toContain('run');
    });
});
