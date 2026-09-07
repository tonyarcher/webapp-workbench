import {describe, expect, it} from 'vitest';
import {createGame, reduce, replay} from './reduce';
import type {GameSetup, GameState, PlayInput, ScoringEvent, TeamId} from './types';

const NFL_SETUP: GameSetup = {
    homeName: 'Vikings',
    awayName: 'Packers',
    rulebookId: 'nfl',
    receivingTeam: 'away',
};

const MN_SETUP: GameSetup = {...NFL_SETUP, rulebookId: 'nfhs-mn'};
const CO_SETUP: GameSetup = {...NFL_SETUP, rulebookId: 'nfhs-co'};
const NCAA_SETUP: GameSetup = {...NFL_SETUP, rulebookId: 'ncaa'};

function kickoffTb(game: GameState, clock = game.clock.gameClockSeconds): GameState {
    return reduce(game, {
        type: 'play',
        input: {family: 'kickoff', touchback: true, snapClock: clock, deadClock: clock},
    });
}

function snapPlay(
    input: Omit<PlayInput, 'snapClock' | 'deadClock'> & {snap?: number; dead?: number},
): ScoringEvent {
    const {snap = 900, dead, ...rest} = input;
    return {type: 'play', input: {...rest, snapClock: snap, deadClock: dead ?? snap}};
}

function scoreTouchdown(game: GameState, team: TeamId = 'away'): GameState {
    const clock = game.clock.gameClockSeconds;
    let next = game;
    if (next.kickoffPending) next = kickoffTb(next, clock);
    if (next.situation.possession !== team) {
        next = reduce(next, snapPlay({
            family: 'scrimmage',
            interception: true,
            yards: 0,
            snap: clock,
            dead: clock,
        }));
    }
    next = reduce(next, snapPlay({
        family: 'scrimmage',
        yards: next.situation.yardline100,
        touchdown: true,
        snap: clock,
        dead: clock,
    }));
    next = reduce(next, snapPlay({
        family: 'extra_point',
        extraPointMade: true,
        snap: clock,
        dead: clock,
    }));
    return next;
}

describe('createGame', () => {
    it('starts with a kickoff pending for the kicking team', () => {
        const game = createGame(NFL_SETUP);
        expect(game.kickoffPending).toBe(true);
        expect(game.situation.possession).toBe('home');
        expect(game.clock.gameClockSeconds).toBe(900);
        expect(game.personnel.offense).toHaveLength(11);
        expect(game.personnel.defense).toHaveLength(11);
    });

    it('uses 12-minute quarters for Minnesota HS', () => {
        expect(createGame(MN_SETUP).clock.gameClockSeconds).toBe(720);
    });
});

describe('kickoff and down/distance', () => {
    it('touchback puts the receiving team at its 30 in the NFL', () => {
        const game = kickoffTb(createGame(NFL_SETUP), 900);
        expect(game.kickoffPending).toBe(false);
        expect(game.situation.possession).toBe('away');
        expect(game.situation).toMatchObject({down: 1, distance: 10, yardline100: 70});
    });

    it('1st & 10 gain 4 becomes 2nd & 6; gain 10 is a new first down', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 4, concept: 'inside_zone', snap: 900, dead: 890}));
        expect(game.situation).toMatchObject({down: 2, distance: 6, yardline100: 66});
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 10, concept: 'inside_zone', snap: 890, dead: 880}));
        expect(game.situation).toMatchObject({down: 1, distance: 10, yardline100: 56});
        expect(game.plays.at(-1)?.result.firstDown).toBe(true);
    });

    it('4th down failure flips possession', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 900, dead: 900}));
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 900, dead: 900}));
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 900, dead: 900}));
        expect(game.situation.down).toBe(4);
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 1, snap: 900, dead: 890}));
        expect(game.situation.possession).toBe('home');
        expect(game.situation.down).toBe(1);
        expect(game.plays.at(-1)?.result.turnover).toBe('downs');
    });
});

describe('clock', () => {
    it('NFL incomplete stops the clock at the dead time', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 900, dead: 890}));
        expect(game.clock.gameClockSeconds).toBe(890);
        expect(game.clock.running).toBe(false);
        expect(game.plays.at(-1)?.clock.stopReason).toBe('incomplete');
    });

    it('NFHS first down stops the clock', () => {
        let game = kickoffTb(createGame(MN_SETUP), 720);
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 12, snap: 720, dead: 710}));
        expect(game.clock.running).toBe(false);
        expect(game.plays.at(-1)?.clock.stopReason).toBe('first_down');
    });

    it('NFL two-minute warning stops a live clock that crosses 2:00', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, {type: 'period_end'});
        expect(game.clock.period).toBe(2);
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 3, snap: 125, dead: 118}));
        expect(game.clock.twoMinuteWarnedThisHalf).toBe(true);
        expect(game.clock.running).toBe(false);
        expect(game.plays.at(-1)?.clock.stopReason).toBe('two_minute_warning');
        expect(game.clock.gameClockSeconds).toBe(118);
    });
});

describe('scoring and tries', () => {
    it('touchdown then extra point are separate plays and the try does not run the clock', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        const before = 880;
        game = reduce(game, snapPlay({
            family: 'scrimmage',
            yards: 70,
            touchdown: true,
            snap: 900,
            dead: before,
        }));
        expect(game.score.away).toBe(6);
        expect(game.pendingTry).toBe(true);
        expect(game.plays).toHaveLength(2);
        game = reduce(game, snapPlay({
            family: 'extra_point',
            extraPointMade: true,
            snap: before,
            dead: before - 40,
        }));
        expect(game.score.away).toBe(7);
        expect(game.pendingTry).toBe(false);
        expect(game.kickoffPending).toBe(true);
        expect(game.clock.gameClockSeconds).toBe(before);
        expect(game.plays).toHaveLength(3);
        expect(game.plays.at(-1)?.call.family).toBe('extra_point');
    });
});

describe('turnovers', () => {
    it('own-team fumble recovery is a run; fumble lost flips possession', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, snapPlay({family: 'scrimmage', yards: 3, fumbleOwn: true, snap: 900, dead: 890}));
        expect(game.situation.possession).toBe('away');
        expect(game.situation.down).toBe(2);
        expect(game.plays.at(-1)?.result.turnover).toBeUndefined();

        game = reduce(game, snapPlay({family: 'scrimmage', yards: 2, fumbleLost: true, snap: 890, dead: 880}));
        expect(game.situation.possession).toBe('home');
        expect(game.plays.at(-1)?.result.turnover).toBe('fumble');
    });

    it('incomplete is not an interception; INT flips possession', () => {
        let game = kickoffTb(createGame(NFL_SETUP));
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 900, dead: 900}));
        expect(game.situation.possession).toBe('away');
        expect(game.situation.down).toBe(2);
        game = reduce(game, snapPlay({family: 'scrimmage', interception: true, yards: 10, snap: 900, dead: 885}));
        expect(game.situation.possession).toBe('home');
        expect(game.plays.at(-1)?.result.turnover).toBe('interception');
        expect(game.plays.at(-1)?.result.incomplete).toBe(false);
    });
});

describe('mercy rules', () => {
    it('MN: 35-point Q4 running clock, TIPS only, resumes below 30', () => {
        let game = createGame(MN_SETUP);
        for (let i = 0; i < 5; i += 1) game = scoreTouchdown(game);
        expect(game.score.away).toBe(35);
        expect(game.clock.mercyActive).toBe(false);
        game = reduce(game, {type: 'period_end'});
        game = reduce(game, {type: 'period_end'});
        game = reduce(game, {type: 'period_end'});
        expect(game.clock.period).toBe(4);
        expect(game.clock.mercyActive).toBe(true);

        game = kickoffTb(game, 720);
        game = reduce(game, snapPlay({family: 'scrimmage', incomplete: true, snap: 720, dead: 700}));
        expect(game.clock.running).toBe(true);
        expect(game.plays.at(-1)?.clock.stopReason).toBe('none');

        game = reduce(game, {type: 'timeout', team: 'away'});
        expect(game.clock.running).toBe(false);

        game = reduce(game, snapPlay({
            family: 'punt',
            yards: 40,
            snap: game.clock.gameClockSeconds,
            dead: game.clock.gameClockSeconds,
        }));
        game = scoreTouchdown(game, 'home');
        expect(game.score.home).toBe(7);
        expect(game.score.away).toBe(35);
        expect(game.clock.mercyActive).toBe(false);
    });

    it('CO: 40-point mercy is sticky and ignores out of bounds', () => {
        let game = createGame(CO_SETUP);
        for (let i = 0; i < 6; i += 1) game = scoreTouchdown(game);
        expect(game.score.away).toBe(42);
        expect(game.clock.mercyActive).toBe(true);
        game = kickoffTb(game, game.clock.gameClockSeconds);
        game = reduce(game, snapPlay({
            family: 'scrimmage',
            yards: 4,
            outOfBounds: true,
            snap: game.clock.gameClockSeconds,
            dead: game.clock.gameClockSeconds - 5,
        }));
        expect(game.clock.running).toBe(true);
        expect(game.plays.at(-1)?.clock.stopReason).toBe('none');
    });
});

describe('kickoff returns and punt touchbacks', () => {
    it('kickoff return spots the ball at the receiving team yardline', () => {
        const game = reduce(createGame(NFL_SETUP), {
            type: 'play',
            input: {family: 'kickoff', touchback: false, yards: 22, snapClock: 900, deadClock: 890},
        });
        expect(game.kickoffPending).toBe(false);
        expect(game.situation).toMatchObject({possession: 'away', down: 1, distance: 10, yardline100: 78});
    });

    it('kickoff out of bounds is first-and-10 at the 40', () => {
        const game = reduce(createGame(NFL_SETUP), {
            type: 'play',
            input: {family: 'kickoff', touchback: false, outOfBounds: true, snapClock: 900, deadClock: 900},
        });
        expect(game.situation).toMatchObject({possession: 'away', yardline100: 60});
    });

    it('punt touchback is the 20 for NFL, NCAA, and MN — not the kickoff TB spot', () => {
        for (const setup of [NFL_SETUP, NCAA_SETUP, MN_SETUP]) {
            let game = kickoffTb(createGame(setup), createGame(setup).clock.gameClockSeconds);
            game = reduce(game, snapPlay({
                family: 'punt',
                yards: 90,
                snap: game.clock.gameClockSeconds,
                dead: game.clock.gameClockSeconds,
            }));
            expect(game.situation.yardline100).toBe(80);
            expect(game.situation.possession).toBe('home');
        }
    });
});

describe('overtime', () => {
    it('NFL OT is a timed period with a kickoff', () => {
        let game = createGame(NFL_SETUP);
        for (let i = 0; i < 4; i += 1) game = reduce(game, {type: 'period_end'});
        expect(game.clock.period).toBe(5);
        expect(game.clock.gameClockSeconds).toBe(600);
        expect(game.clock.untimed).toBe(false);
        expect(game.kickoffPending).toBe(true);
    });

    it('NFL OT expires as a tie after one overtime period', () => {
        let game = createGame(NFL_SETUP);
        for (let i = 0; i < 5; i += 1) game = reduce(game, {type: 'period_end'});
        expect(game.over).toBe(true);
        expect(game.score).toEqual({home: 0, away: 0});
        expect(game.clock.period).toBe(5);
    });

    it('NCAA OT is untimed from the 25 and continues if still tied', () => {
        let game = createGame(NCAA_SETUP);
        for (let i = 0; i < 4; i += 1) game = reduce(game, {type: 'period_end'});
        expect(game.clock.untimed).toBe(true);
        expect(game.kickoffPending).toBe(false);
        expect(game.situation).toMatchObject({down: 1, yardline100: 25, possession: 'home'});
        game = reduce(game, {type: 'period_end'});
        expect(game.over).toBe(false);
        expect(game.clock.period).toBe(6);
    });

    it('NFHS Kansas plan starts 1st & goal at the 10', () => {
        let game = createGame(MN_SETUP);
        for (let i = 0; i < 4; i += 1) game = reduce(game, {type: 'period_end'});
        expect(game.situation).toMatchObject({down: 1, distance: 10, yardline100: 10, possession: 'home'});
        expect(game.clock.untimed).toBe(true);
    });
});

describe('invalid events and replay', () => {
    it('unknown or illegal events are no-ops', () => {
        const game = createGame(NFL_SETUP);
        const skipped = reduce(game, snapPlay({family: 'scrimmage', yards: 5, snap: 900, dead: 890}));
        expect(skipped).toEqual(game);
        const noTimeouts: GameState = {...game, timeouts: {home: 0, away: 0}};
        expect(reduce(noTimeouts, {type: 'timeout', team: 'home'})).toEqual(noTimeouts);
        const ended: GameState = {...game, over: true};
        expect(reduce(ended, {type: 'period_end'})).toEqual(ended);
    });

    it('replaying the event log reconstructs state (undo)', () => {
        const events: ScoringEvent[] = [
            {type: 'play', input: {family: 'kickoff', touchback: true, snapClock: 900, deadClock: 900}},
            snapPlay({family: 'scrimmage', yards: 4, concept: 'inside_zone', snap: 900, dead: 890}),
            snapPlay({family: 'scrimmage', incomplete: true, snap: 890, dead: 890}),
            {type: 'timeout', team: 'away'},
        ];
        const once = replay(NFL_SETUP, events);
        const again = replay(NFL_SETUP, events);
        expect(again).toEqual(once);
        const undone = replay(NFL_SETUP, events.slice(0, 2));
        expect(undone.situation.down).toBe(2);
        expect(undone.timeouts.away).toBe(3);
        expect(once.timeouts.away).toBe(2);
    });
});
