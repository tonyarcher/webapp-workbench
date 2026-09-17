import {describe, expect, it} from 'vitest';
import {createGame, reduce} from './reduce';
import type {GameSetup, GameState} from './types';

const SETUP: GameSetup = {
    homeName: 'Vikings',
    awayName: 'Packers',
    rulebookId: 'nfl',
    receivingTeam: 'away',
};

function kickoffTb(game: GameState, clock = game.clock.gameClockSeconds): GameState {
    return reduce(game, {
        type: 'play',
        input: {family: 'kickoff', touchback: true, snapClock: clock, deadClock: clock},
    });
}

function snap(
    game: GameState,
    input: Record<string, unknown>,
    clock?: number,
): GameState {
    const snapClock = clock ?? game.clock.gameClockSeconds;
    return reduce(game, {
        type: 'play',
        input: {...input, family: 'scrimmage', snapClock, deadClock: snapClock},
    });
}

describe('field goals', () => {
    it('made field goal scores 3 and sets up a kickoff', () => {
        let game = kickoffTb(createGame(SETUP));
        const clock = game.clock.gameClockSeconds;
        game = reduce(game, {
            type: 'play',
            input: {family: 'field_goal', fieldGoalMade: true, snapClock: clock, deadClock: clock},
        });
        expect(game.score.away).toBe(3);
        expect(game.kickoffPending).toBe(true);
        expect(game.plays[game.plays.length - 1]?.result.scoring).toBe('field_goal');
    });

    it('missed field goal turns the ball over', () => {
        let game = kickoffTb(createGame(SETUP));
        const clock = game.clock.gameClockSeconds;
        const before = game.situation.possession;
        game = reduce(game, {
            type: 'play',
            input: {family: 'field_goal', fieldGoalMade: false, snapClock: clock, deadClock: clock},
        });
        expect(game.situation.possession).not.toBe(before);
    });
});

describe('turnovers and safeties', () => {
    it('interception return touchdown scores for the defense', () => {
        let game = kickoffTb(createGame(SETUP));
        game = snap(game, {interception: true, yards: 30, touchdown: true});
        expect(game.score.home).toBe(6);
        expect(game.plays[game.plays.length - 1]?.result.turnover).toBe('interception');
    });

    it('fumble without a touchdown changes possession', () => {
        let game = kickoffTb(createGame(SETUP));
        const before = game.situation.possession;
        game = snap(game, {fumbleLost: true, yards: 5});
        expect(game.situation.possession).not.toBe(before);
    });

    it('safety scores 2 for the defense and stops the clock', () => {
        let game = kickoffTb(createGame(SETUP));
        game = snap(game, {safety: true, yards: -5});
        const total = game.score.home + game.score.away;
        expect(total).toBe(2);
        expect(game.clock.running).toBe(false);
    });

    it('punt flips the field', () => {
        let game = kickoffTb(createGame(SETUP));
        const before = game.situation.possession;
        const clock = game.clock.gameClockSeconds;
        game = reduce(game, {
            type: 'play',
            input: {family: 'punt', yards: 40, snapClock: clock, deadClock: clock},
        });
        expect(game.situation.possession).not.toBe(before);
    });
});
