import {clockStopsAfterPlay, shouldIssueTwoMinuteWarning, updateMercy} from './clock';
import {personnelFromRosters} from './default-roster';
import {getRulebook, oppositeTeam} from './rulebook';
import type {
    Drive,
    DriveResult,
    GameState,
    Play,
    PlayEvent,
    PlayInput,
    Situation,
    TeamId,
} from './types';

export function rosterFor(game: GameState, team: TeamId) {
    return team === 'home' ? game.home.roster : game.away.roster;
}

export function personnelForPossession(game: GameState, possession: TeamId) {
    return personnelFromRosters(rosterFor(game, possession), rosterFor(game, oppositeTeam(possession)));
}

export function closeDrive(drives: Drive[], result: DriveResult): Drive[] {
    const last = drives.at(-1);
    if (last === undefined || last.result) return drives;
    return [...drives.slice(0, -1), {...last, result}];
}

export function appendPlayToDrive(drives: Drive[], playId: string): Drive[] {
    const last = drives.at(-1);
    if (last === undefined || last.result) return drives;
    return [...drives.slice(0, -1), {...last, playIds: [...last.playIds, playId]}];
}

export function openDrive(game: GameState, team: TeamId, playId: string): Drive {
    return {
        id: `drive-${game.nextDriveId}`,
        team,
        startPeriod: game.clock.period,
        startClock: game.clock.gameClockSeconds,
        startYardline100: game.situation.yardline100,
        playIds: [playId],
    };
}

export function currentDriveId(game: GameState): string {
    const last = game.drives.at(-1);
    if (last === undefined || last.result) return '';
    return last.id;
}

function withPlayerId(playerId: string | undefined): {playerId?: string} {
    return playerId === undefined ? {} : {playerId};
}

function fumbleEvents(input: PlayInput): PlayEvent[] {
    const events: PlayEvent[] = [
        {kind: 'run', ...withPlayerId(input.rusherId), yards: input.yards ?? 0},
        {kind: 'fumble'},
    ];
    if (input.fumbleOwn) events.push({kind: 'recovery'});
    return events;
}

function scrimmageEvents(input: PlayInput): PlayEvent[] {
    if (input.passerId || input.receiverId) {
        return [{kind: 'pass', ...withPlayerId(input.passerId)}, {kind: 'catch', ...withPlayerId(input.receiverId)}];
    }
    return [{kind: 'run', ...withPlayerId(input.rusherId), yards: input.yards ?? 0}];
}

function passEvents(kind: 'incomplete' | 'interception', input: PlayInput): PlayEvent[] {
    return [{kind: 'pass', ...withPlayerId(input.passerId)}, {kind, ...withPlayerId(input.intendedId)}];
}

function specialOutcome(input: PlayInput): PlayEvent[] | null {
    if (input.family === 'spike') return [{kind: 'spike'}];
    if (input.family === 'kneel') return [{kind: 'kneel', yards: input.yards ?? -1}];
    if (input.incomplete) return passEvents('incomplete', input);
    if (input.interception) return passEvents('interception', input);
    return null;
}

function outcomeEvents(input: PlayInput): PlayEvent[] {
    const special = specialOutcome(input);
    if (special) return special;
    if (input.sack) return [{kind: 'sack', yards: input.yards ?? 0}];
    if (input.fumbleLost || input.fumbleOwn) return fumbleEvents(input);
    return input.family === 'scrimmage' ? scrimmageEvents(input) : [];
}

export function synthesizeEvents(input: PlayInput): PlayEvent[] {
    if (input.events?.length) return input.events;
    const events: PlayEvent[] = [{kind: 'snap'}, ...outcomeEvents(input)];
    if (input.touchdown) events.push({kind: 'score'});
    const tackler = input.tacklers?.find((row) => row.role !== 'missed');
    if (tackler) events.push({kind: 'tackle', playerId: tackler.playerId});
    return events;
}

export interface ScorePair {
    home: number;
    away: number;
}

export function addScore(game: GameState, team: TeamId, points: number): ScorePair {
    return team === 'home'
        ? {home: game.score.home + points, away: game.score.away}
        : {home: game.score.home, away: game.score.away + points};
}

export function trySituation(game: GameState, team: TeamId): Situation {
    const rb = getRulebook(game.rulebookId);
    return {
        down: 1,
        distance: Math.min(3, rb.extraPointYardline100),
        yardline100: rb.extraPointYardline100,
        hash: game.situation.hash,
        possession: team,
    };
}

export function kickoffSituation(game: GameState, receiving: TeamId): Situation {
    const rb = getRulebook(game.rulebookId);
    return {
        down: 1,
        distance: 10,
        yardline100: 100 - rb.touchbackYardline,
        hash: 'middle',
        possession: receiving,
    };
}

export function afterScore(game: GameState, scoringTeam: TeamId, score: ScorePair, pendingTry: boolean): GameState {
    const next: GameState = {
        ...game,
        score,
        pendingTry,
        tryTeam: pendingTry ? scoringTeam : null,
        kickoffPending: !pendingTry,
        situation: pendingTry ? trySituation(game, scoringTeam) : game.situation,
        personnel: personnelForPossession(game, pendingTry ? scoringTeam : oppositeTeam(scoringTeam)),
        clock: {...game.clock, running: false},
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

export function buildPlay(
    game: GameState,
    input: PlayInput,
    playId: string,
    driveId: string,
    result: Play['result'],
    stopReason: Play['clock']['stopReason'],
): Play {
    return {
        id: playId,
        driveId,
        period: game.clock.period,
        clock: playClock(input, stopReason),
        situation: {...game.situation},
        personnel: game.personnel,
        call: playCall(input),
        events: synthesizeEvents(input),
        result,
        tacklers: input.tacklers ?? [],
    };
}

function playClock(input: PlayInput, stopReason: Play['clock']['stopReason']): Play['clock'] {
    return {
        snap: input.snapClock,
        dead: input.deadClock,
        playClockAtSnap: input.playClockAtSnap ?? 40,
        stopReason,
    };
}

function playCall(input: PlayInput): Play['call'] {
    return {
        family: input.family,
        concept: input.concept ?? (input.scramble ? 'scramble' : 'unknown'),
        formation: input.formation ?? 'unknown',
    };
}

export interface ClockFactsInput {
    downBefore: 1 | 2 | 3 | 4;
    firstDown: boolean;
    incomplete: boolean;
    scored: boolean;
    turnover: boolean;
    outOfBounds?: boolean;
}

function withTwoMinute(
    stop: {stops: boolean; reason: Play['clock']['stopReason']},
    clockSeconds: number,
): {clockSeconds: number; warned: boolean; stopReason: Play['clock']['stopReason']; running: boolean} {
    if (stop.stops) return {clockSeconds, warned: true, stopReason: stop.reason, running: false};
    return {clockSeconds: Math.min(clockSeconds, 120), warned: true, stopReason: 'two_minute_warning', running: false};
}

function playClockFacts(game: GameState, input: PlayInput, facts: ClockFactsInput, isTry: boolean) {
    return clockStopsAfterPlay(getRulebook(game.rulebookId), {
        incomplete: facts.incomplete,
        outOfBounds: facts.outOfBounds === true,
        firstDown: facts.firstDown,
        scored: facts.scored,
        turnover: facts.turnover,
        downBefore: facts.downBefore,
        period: game.clock.period,
        deadClock: input.deadClock,
        mercyActive: updateMercy(game),
        isTry,
    });
}

function clockAfterPlay(
    game: GameState,
    input: PlayInput,
    facts: ClockFactsInput | undefined,
): {clockSeconds: number; warned: boolean; stopReason: Play['clock']['stopReason']; running: boolean} {
    const isTry = input.family === 'extra_point' || input.family === 'two_point';
    const clockSeconds = isTry || game.clock.untimed ? game.clock.gameClockSeconds : input.deadClock;
    if (!facts) {
        return {
            clockSeconds,
            warned: game.clock.twoMinuteWarnedThisHalf,
            stopReason: game.plays.at(-1)?.clock.stopReason ?? 'none',
            running: game.clock.running,
        };
    }
    const stop = playClockFacts(game, input, facts, isTry);
    const rb = getRulebook(game.rulebookId);
    if (shouldIssueTwoMinuteWarning(rb, game.clock, input.snapClock, input.deadClock)) return withTwoMinute(stop, clockSeconds);
    return {clockSeconds, warned: game.clock.twoMinuteWarnedThisHalf, stopReason: stop.reason, running: !stop.stops};
}

export function finishPlay(game: GameState, input: PlayInput, facts?: ClockFactsInput): GameState {
    const {clockSeconds, warned, stopReason, running} = clockAfterPlay(game, input, facts);
    const prev = game.plays.at(-1);
    const plays = prev === undefined
        ? game.plays
        : [...game.plays.slice(0, -1), {...prev, clock: {...prev.clock, stopReason}}];
    const next: GameState = {
        ...game,
        plays,
        clock: {
            ...game.clock,
            gameClockSeconds: Math.max(0, clockSeconds),
            running,
            twoMinuteWarnedThisHalf: warned,
            playClockSeconds: 40,
        },
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

export function kickoffReady(game: GameState, kicking: TeamId): Pick<GameState, 'kickoffPending' | 'situation'> {
    const rb = getRulebook(game.rulebookId);
    return {
        kickoffPending: true,
        situation: {
            down: 1,
            distance: 10,
            yardline100: rb.kickoffYardline,
            hash: 'middle',
            possession: kicking,
        },
    };
}
