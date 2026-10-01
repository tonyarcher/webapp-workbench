import { describe, expect, it } from 'vitest';
import { createGame, reduce } from './reduce';
import type { GameSetup, GameState, PlayInput } from './types';

const SETUP: GameSetup = { homeName: 'Hawks', awayName: 'Comets', rulebookId: 'nfl', receivingTeam: 'away' };

function afterKickoff(clock = 900): GameState {
    return reduce(createGame(SETUP), {
        type: 'play',
        input: { family: 'kickoff', touchback: true, snapClock: clock, deadClock: clock },
    });
}

/** A touchdown, which is what puts the game in a try situation. */
function afterTouchdown(game: GameState): GameState {
    const clock = game.clock.gameClockSeconds;
    return reduce(game, {
        type: 'play',
        input: {
            family: 'scrimmage',
            yards: game.situation.yardline100,
            touchdown: true,
            snapClock: clock,
            deadClock: clock,
        },
    });
}

function play(game: GameState, input: Omit<PlayInput, 'snapClock' | 'deadClock'>): GameState {
    const clock = game.clock.gameClockSeconds;
    return reduce(game, { type: 'play', input: { ...input, snapClock: clock, deadClock: clock } });
}

function lastResult(game: GameState) {
    return game.plays[game.plays.length - 1]?.result;
}

describe('extra point and two-point tries', () => {
    it('adds one for a made extra point', () => {
        const game = play(afterTouchdown(afterKickoff()), { family: 'extra_point', extraPointMade: true });

        expect(game.score.away).toBe(7);
        expect(lastResult(game)?.scoring).toBe('extra_point');
    });

    it('leaves the score at six for a missed extra point', () => {
        const game = play(afterTouchdown(afterKickoff()), { family: 'extra_point', extraPointMade: false });

        expect(game.score.away).toBe(6);
        expect(lastResult(game)?.scoring).toBeUndefined();
    });

    it('adds two for a made two-point try, and marks the play a first down', () => {
        const game = play(afterTouchdown(afterKickoff()), { family: 'two_point', twoPointMade: true });

        expect(game.score.away).toBe(8);
        expect(lastResult(game)?.scoring).toBe('two_point');
        expect(lastResult(game)?.firstDown).toBe(true);
        expect(lastResult(game)?.incomplete).toBe(false);
    });

    it('records a missed two-point try as an incomplete play worth nothing', () => {
        const game = play(afterTouchdown(afterKickoff()), { family: 'two_point', twoPointMade: false });

        expect(game.score.away).toBe(6);
        expect(lastResult(game)?.scoring).toBeUndefined();
        expect(lastResult(game)?.firstDown).toBe(false);
        expect(lastResult(game)?.incomplete).toBe(true);
    });
});

describe('punt', () => {
    it('defaults to a 40 yard punt when no distance is given', () => {
        const before = afterKickoff();
        const game = play(before, { family: 'punt' });

        expect(game.situation.possession).not.toBe(before.situation.possession);
        expect(game.plays[game.plays.length - 1]?.result.yards).toBe(40);
    });

    it('puts the ball at the 20 for a declared touchback', () => {
        const before = afterKickoff();
        const game = play(before, { family: 'punt', yards: 20, touchback: true });

        expect(game.situation.possession).not.toBe(before.situation.possession);
        expect(game.situation.yardline100).toBe(80);
        expect(game.situation.down).toBe(1);
        expect(game.situation.distance).toBe(10);
    });

    it('hands the ball over at the far end when the punt covers the field', () => {
        const before = afterKickoff();
        const game = play(before, { family: 'punt', yards: 69 });

        // The punt is downed at the 1, so the receiving side starts at the 99.
        expect(game.situation.yardline100).toBe(99);
        expect(game.situation.possession).not.toBe(before.situation.possession);
    });
});
