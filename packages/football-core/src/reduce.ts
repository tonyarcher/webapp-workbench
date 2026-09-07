import {updateMercy} from './clock';
import {generateRoster, isValidPersonnel, personnelFromRosters} from './default-roster';
import {goalToGoDistance} from './down-distance';
import {getRulebook, oppositeTeam} from './rulebook';
import {closeDrive, personnelForPossession} from './reduce-helpers';
import {applyFieldGoal, applyKickoff, applyPunt, applyScrimmage, applyTry} from './reduce-plays';
import type {GameSetup, GameState, PlayInput, ScoringEvent, TeamId} from './types';

function initialClock(quarterLength: number): GameState['clock'] {
    return {
        period: 1,
        gameClockSeconds: quarterLength,
        playClockSeconds: 25,
        running: false,
        untimed: false,
        twoMinuteWarnedThisHalf: false,
        mercyActive: false,
    };
}

export function createGame(setup: GameSetup): GameState {
    const rb = getRulebook(setup.rulebookId);
    const homeRoster = setup.homeRoster?.length ? setup.homeRoster : generateRoster('home');
    const awayRoster = setup.awayRoster?.length ? setup.awayRoster : generateRoster('away');
    const kicking = oppositeTeam(setup.receivingTeam);
    const offense = kicking === 'home' ? homeRoster : awayRoster;
    const defense = kicking === 'home' ? awayRoster : homeRoster;
    return {
        rulebookId: setup.rulebookId,
        home: {id: 'home', name: setup.homeName, roster: homeRoster},
        away: {id: 'away', name: setup.awayName, roster: awayRoster},
        receivingTeam: setup.receivingTeam,
        clock: initialClock(rb.quarterLengthSeconds),
        situation: {down: 1, distance: 10, yardline100: rb.kickoffYardline, hash: 'middle', possession: kicking},
        timeouts: {home: rb.timeoutsPerHalf, away: rb.timeoutsPerHalf},
        score: {home: 0, away: 0},
        personnel: personnelFromRosters(offense, defense),
        drives: [],
        plays: [],
        pendingTry: false,
        tryTeam: null,
        kickoffPending: true,
        over: false,
        nextPlayId: 1,
        nextDriveId: 1,
    };
}

function handleTimeout(game: GameState, team: TeamId): GameState {
    if (game.timeouts[team] <= 0) return game;
    return {
        ...game,
        timeouts: {...game.timeouts, [team]: game.timeouts[team] - 1},
        clock: {...game.clock, running: false},
    };
}

function handleSetPersonnel(game: GameState, personnel: GameState['personnel']): GameState {
    if (!isValidPersonnel(personnel)) return game;
    return {...game, personnel};
}

function handlePenalty(game: GameState, event: Extract<ScoringEvent, {type: 'penalty'}>): GameState {
    if (!event.accepted || event.yards <= 0) return {...game, clock: {...game.clock, running: false}};
    const againstOffense = event.team === game.situation.possession;
    let {yardline100, distance, down} = game.situation;
    if (againstOffense) {
        yardline100 = Math.min(99, yardline100 + event.yards);
        distance += event.yards;
    } else {
        yardline100 = Math.max(1, yardline100 - event.yards);
        if (event.yards >= distance) {
            down = 1;
            distance = goalToGoDistance(yardline100);
        } else {
            distance -= event.yards;
        }
    }
    return {
        ...game,
        situation: {...game.situation, yardline100, distance, down},
        clock: {...game.clock, running: false},
    };
}

function advanceQuarter(game: GameState): GameState {
    const rb = getRulebook(game.rulebookId);
    const halfTime = game.clock.period === 2;
    const nextReceiving = halfTime ? oppositeTeam(game.receivingTeam) : game.situation.possession;
    const next: GameState = {
        ...game,
        clock: {
            period: game.clock.period + 1,
            gameClockSeconds: rb.quarterLengthSeconds,
            playClockSeconds: 25,
            running: false,
            untimed: false,
            twoMinuteWarnedThisHalf: halfTime ? false : game.clock.twoMinuteWarnedThisHalf,
            mercyActive: game.clock.mercyActive,
        },
        timeouts: halfTime ? {home: rb.timeoutsPerHalf, away: rb.timeoutsPerHalf} : game.timeouts,
        kickoffPending: halfTime || game.kickoffPending,
        pendingTry: false,
        tryTeam: null,
        situation: halfTime
            ? {down: 1, distance: 10, yardline100: rb.kickoffYardline, hash: 'middle', possession: oppositeTeam(nextReceiving)}
            : game.situation,
        personnel: halfTime ? personnelForPossession(game, oppositeTeam(nextReceiving)) : game.personnel,
        drives: halfTime ? closeDrive(game.drives, 'end_half') : game.drives,
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

function enterOvertime(game: GameState): GameState {
    const rb = getRulebook(game.rulebookId);
    const ot = rb.overtime;
    const nfl = ot.kind === 'nfl-2024';
    const first: TeamId = 'home';
    const possession = nfl ? oppositeTeam(first) : first;
    const yardline100 = nfl ? rb.kickoffYardline : ot.startYardline100;
    return {
        ...game,
        clock: {
            period: game.clock.period + 1,
            gameClockSeconds: nfl ? ot.periodSeconds : 0,
            playClockSeconds: 25,
            running: false,
            untimed: ot.periodSeconds === 0,
            twoMinuteWarnedThisHalf: false,
            mercyActive: false,
        },
        timeouts: {home: 2, away: 2},
        kickoffPending: nfl,
        pendingTry: false,
        tryTeam: null,
        situation: {down: 1, distance: goalToGoDistance(nfl ? 10 : yardline100), yardline100, hash: 'middle', possession},
        personnel: personnelForPossession(game, possession),
        drives: closeDrive(game.drives, 'end_half'),
    };
}

function endGame(game: GameState): GameState {
    return {...game, over: true, clock: {...game.clock, running: false}, drives: closeDrive(game.drives, 'end_half')};
}

function handlePeriodEnd(game: GameState): GameState {
    if (game.clock.period < 4) return advanceQuarter(game);
    if (game.score.home !== game.score.away) return endGame(game);
    const nflOtDone = getRulebook(game.rulebookId).overtime.kind === 'nfl-2024' && game.clock.period >= 5;
    return nflOtDone ? endGame(game) : enterOvertime(game);
}

function playAllowed(game: GameState, input: PlayInput): boolean {
    if (game.kickoffPending) return input.family === 'kickoff';
    if (game.pendingTry) return input.family === 'extra_point' || input.family === 'two_point';
    return input.family !== 'kickoff' && input.family !== 'extra_point' && input.family !== 'two_point';
}

function clocksAreValid(game: GameState, input: PlayInput): boolean {
    if (!Number.isFinite(input.snapClock) || !Number.isFinite(input.deadClock)) return false;
    if (input.snapClock < 0 || input.deadClock < 0) return false;
    const isTry = input.family === 'extra_point' || input.family === 'two_point';
    return isTry || game.clock.untimed || input.deadClock <= input.snapClock;
}

function dispatchPlay(game: GameState, input: PlayInput): GameState {
    if (input.family === 'kickoff') return applyKickoff(game, input);
    if (input.family === 'extra_point' || input.family === 'two_point') return applyTry(game, input);
    if (input.family === 'punt') return applyPunt(game, input);
    if (input.family === 'field_goal') return applyFieldGoal(game, input);
    if (input.family === 'scrimmage' || input.family === 'kneel' || input.family === 'spike') {
        return applyScrimmage(game, input);
    }
    return game;
}

function handlePlay(game: GameState, input: PlayInput): GameState {
    if (!playAllowed(game, input) || !clocksAreValid(game, input)) return game;
    return dispatchPlay(game, input);
}

export function reduce(game: GameState, event: ScoringEvent): GameState {
    if (game.over) return game;
    switch (event.type) {
        case 'set_personnel':
            return handleSetPersonnel(game, event.personnel);
        case 'timeout':
            return handleTimeout(game, event.team);
        case 'play':
            return handlePlay(game, event.input);
        case 'period_end':
            return handlePeriodEnd(game);
        case 'penalty':
            return handlePenalty(game, event);
        default:
            return game;
    }
}

export function replay(setup: GameSetup, events: ScoringEvent[]): GameState {
    return events.reduce(reduce, createGame(setup));
}
