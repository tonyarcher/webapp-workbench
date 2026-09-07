import {updateMercy} from './clock';
import {advanceDownDistance, flipPossession} from './down-distance';
import {oppositeTeam} from './rulebook';
import {
    addScore,
    afterScore,
    appendPlayToDrive,
    buildPlay,
    closeDrive,
    currentDriveId,
    finishPlay,
    kickoffReady,
    kickoffSituation,
    openDrive,
    personnelForPossession,
} from './reduce-helpers';
import type {ClockFactsInput} from './reduce-helpers';
import type {GameState, Play, PlayInput, Situation, TeamId} from './types';

function playResult(partial: Partial<Play['result']> & Pick<Play['result'], 'deadAtYardline100'>): Play['result'] {
    return {yards: 0, firstDown: false, outOfBounds: false, incomplete: false, sack: false, ...partial};
}

function turnoverFacts(game: GameState, input: PlayInput, incomplete = false): ClockFactsInput {
    return {
        downBefore: game.situation.down,
        firstDown: false,
        incomplete,
        scored: false,
        turnover: true,
        outOfBounds: input.outOfBounds === true,
    };
}

function kickoffSpot(game: GameState, input: PlayInput, receiving: TeamId): Situation {
    if (input.outOfBounds === true) {
        return {down: 1, distance: 10, yardline100: 60, hash: 'middle', possession: receiving};
    }
    if (input.touchback !== false) return kickoffSituation(game, receiving);
    const ownYard = Math.min(99, Math.max(1, input.yards ?? 25));
    return {down: 1, distance: 10, yardline100: 100 - ownYard, hash: 'middle', possession: receiving};
}

export function applyKickoff(game: GameState, input: PlayInput): GameState {
    const receiving = oppositeTeam(game.situation.possession);
    const situation = kickoffSpot(game, input, receiving);
    const playId = `play-${game.nextPlayId}`;
    const drive = openDrive({...game, situation}, receiving, playId);
    const play = buildPlay(game, input, playId, drive.id, playResult({
        yards: input.yards ?? 0,
        firstDown: true,
        deadAtYardline100: situation.yardline100,
    }), 'none');
    return {
        ...game,
        situation,
        personnel: personnelForPossession(game, receiving),
        kickoffPending: false,
        plays: [...game.plays, play],
        drives: [...game.drives, {...drive, startYardline100: situation.yardline100, playIds: []}],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
        clock: {
            ...game.clock,
            gameClockSeconds: game.clock.untimed ? game.clock.gameClockSeconds : input.deadClock,
            running: false,
            playClockSeconds: 25,
        },
    };
}

export function applyTry(game: GameState, input: PlayInput): GameState {
    const scoringTeam = game.tryTeam ?? game.situation.possession;
    const made = input.family === 'extra_point' ? input.extraPointMade === true : input.twoPointMade === true;
    const points = input.family === 'extra_point' ? 1 : 2;
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, '', {
        yards: 0,
        firstDown: made && input.family === 'two_point',
        scoring: made ? (input.family === 'extra_point' ? 'extra_point' : 'two_point') : undefined,
        deadAtYardline100: game.situation.yardline100,
        outOfBounds: false,
        incomplete: !made && input.family === 'two_point',
        sack: false,
    }, 'try');
    const ready = kickoffReady(game, scoringTeam);
    const next: GameState = {
        ...game,
        score: made ? addScore(game, scoringTeam, points) : game.score,
        pendingTry: false,
        tryTeam: null,
        ...ready,
        personnel: personnelForPossession(game, scoringTeam),
        plays: [...game.plays, play],
        nextPlayId: game.nextPlayId + 1,
        clock: {...game.clock, running: false},
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

function puntSituation(game: GameState, yards: number, touchback: boolean) {
    const receiving = oppositeTeam(game.situation.possession);
    const deadAt = touchback ? 0 : Math.min(99, Math.max(1, game.situation.yardline100 - yards));
    const situation = touchback
        ? {down: 1 as const, distance: 10, yardline100: 80, hash: game.situation.hash, possession: receiving}
        : flipPossession(game.situation, deadAt);
    return {receiving, deadAt, situation};
}

export function applyPunt(game: GameState, input: PlayInput): GameState {
    const yards = input.yards ?? 40;
    const touchback = game.situation.yardline100 - yards <= 0 || input.touchback === true;
    const {receiving, deadAt, situation} = puntSituation(game, yards, touchback);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), playResult({
        yards,
        deadAtYardline100: touchback ? 0 : deadAt,
        outOfBounds: input.outOfBounds === true,
    }), 'change_of_possession');
    const drive = openDrive({...game, situation}, receiving, playId);
    return finishPlay({
        ...game,
        situation,
        personnel: personnelForPossession(game, receiving),
        plays: [...game.plays, play],
        drives: [...closeDrive(game.drives, 'punt'), {...drive, playIds: []}],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
        clock: {...game.clock, running: false},
    }, input);
}

function applyMadeFieldGoal(game: GameState, input: PlayInput): GameState {
    const kicking = game.situation.possession;
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), {
        yards: game.situation.yardline100,
        firstDown: false,
        scoring: 'field_goal',
        deadAtYardline100: 0,
        outOfBounds: false,
        incomplete: false,
        sack: false,
    }, 'score');
    const ready = kickoffReady(game, kicking);
    const next: GameState = {
        ...game,
        score: addScore(game, kicking, 3),
        ...ready,
        personnel: personnelForPossession(game, kicking),
        plays: [...game.plays, play],
        drives: closeDrive(game.drives, 'fg'),
        nextPlayId: game.nextPlayId + 1,
        clock: {
            ...game.clock,
            running: false,
            gameClockSeconds: game.clock.untimed ? game.clock.gameClockSeconds : input.deadClock,
        },
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

export function applyFieldGoal(game: GameState, input: PlayInput): GameState {
    if (input.fieldGoalMade === true) return applyMadeFieldGoal(game, input);
    const situation = flipPossession(game.situation, game.situation.yardline100);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), {
        yards: 0,
        firstDown: false,
        deadAtYardline100: game.situation.yardline100,
        outOfBounds: false,
        incomplete: true,
        sack: false,
    }, 'change_of_possession');
    const drive = openDrive({...game, situation}, situation.possession, playId);
    return finishPlay({
        ...game,
        situation,
        personnel: personnelForPossession(game, situation.possession),
        plays: [...game.plays, play],
        drives: [...closeDrive(game.drives, 'downs'), {...drive, playIds: []}],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
        clock: {...game.clock, running: false},
    }, input);
}

function applyDownsTurnover(game: GameState, input: PlayInput, yards: number, deadAt: number): GameState {
    const situation = flipPossession(game.situation, deadAt);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), {
        yards,
        firstDown: false,
        turnover: 'downs',
        deadAtYardline100: deadAt,
        outOfBounds: input.outOfBounds === true,
        incomplete: input.incomplete === true || input.family === 'spike',
        sack: input.sack === true,
    }, 'change_of_possession');
    const drive = openDrive({...game, situation}, situation.possession, playId);
    return finishPlay({
        ...game,
        situation,
        personnel: personnelForPossession(game, situation.possession),
        plays: [...game.plays, play],
        drives: [...closeDrive(appendPlayToDrive(game.drives, playId), 'downs'), {...drive, playIds: []}],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
    }, input, {
        downBefore: game.situation.down,
        firstDown: false,
        incomplete: play.result.incomplete,
        scored: false,
        turnover: true,
        outOfBounds: input.outOfBounds === true,
    });
}

function scrimmageYards(input: PlayInput): {incomplete: boolean; yards: number} {
    const incomplete = input.incomplete === true || input.family === 'spike';
    const yards = incomplete ? 0 : (input.yards ?? (input.family === 'kneel' ? -1 : 0));
    return {incomplete, yards};
}

export function applyScrimmage(game: GameState, input: PlayInput): GameState {
    const {incomplete, yards} = scrimmageYards(input);
    if (input.interception === true) return applyTurnover(game, input, 'interception', yards);
    if (input.fumbleLost === true) return applyTurnover(game, input, 'fumble', yards);
    const advance = advanceDownDistance(game.situation, yards, {incomplete});
    if (input.touchdown === true || advance.touchdown) return applyTouchdown(game, input, yards, game.situation.possession);
    if (input.safety === true || advance.safety) return applySafety(game, input, yards);
    if (advance.turnoverOnDowns) return applyDownsTurnover(game, input, yards, advance.yardline100);
    return applyOrdinaryGain(game, input, yards, incomplete, advance);
}

function gainSituation(game: GameState, input: PlayInput, advance: {down: Situation['down']; distance: number; yardline100: number}): Situation {
    return {
        ...game.situation,
        down: advance.down,
        distance: advance.distance,
        yardline100: advance.yardline100,
        hash: input.hash ?? game.situation.hash,
    };
}

function drivesAfterPlay(game: GameState, playId: string) {
    if (currentDriveId(game)) return {drives: appendPlayToDrive(game.drives, playId), nextDriveId: game.nextDriveId};
    return {drives: [...game.drives, openDrive(game, game.situation.possession, playId)], nextDriveId: game.nextDriveId + 1};
}

function ordinaryPlay(game: GameState, input: PlayInput, yards: number, incomplete: boolean, advance: {yardline100: number; firstDown: boolean}) {
    const playId = `play-${game.nextPlayId}`;
    return {
        playId,
        play: buildPlay(game, input, playId, currentDriveId(game), playResult({
            yards,
            firstDown: advance.firstDown,
            deadAtYardline100: advance.yardline100,
            outOfBounds: input.outOfBounds === true,
            incomplete,
            sack: input.sack === true,
        }), 'none'),
    };
}

function applyOrdinaryGain(
    game: GameState,
    input: PlayInput,
    yards: number,
    incomplete: boolean,
    advance: {down: Situation['down']; distance: number; yardline100: number; firstDown: boolean},
): GameState {
    const {playId, play} = ordinaryPlay(game, input, yards, incomplete, advance);
    const {drives, nextDriveId} = drivesAfterPlay(game, playId);
    return finishPlay({
        ...game,
        situation: gainSituation(game, input, advance),
        plays: [...game.plays, play],
        drives,
        nextPlayId: game.nextPlayId + 1,
        nextDriveId,
    }, input, {
        downBefore: game.situation.down,
        firstDown: advance.firstDown,
        incomplete,
        scored: false,
        turnover: false,
        outOfBounds: input.outOfBounds === true,
    });
}

function recordTurnoverPlay(
    game: GameState,
    input: PlayInput,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
    td: boolean,
): GameState {
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), {
        yards,
        firstDown: false,
        turnover: kind,
        scoring: td ? 'touchdown' : undefined,
        deadAtYardline100: spot,
        outOfBounds: false,
        incomplete: false,
        sack: input.sack === true,
    }, td ? 'score' : 'change_of_possession');
    return {
        ...game,
        plays: [...game.plays, play],
        drives: closeDrive(appendPlayToDrive(game.drives, playId), td ? 'td' : 'turnover'),
        nextPlayId: game.nextPlayId + 1,
    };
}

function applyLostBall(
    game: GameState,
    input: PlayInput,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
    defense: TeamId,
): GameState {
    const situation = flipPossession(game.situation, spot);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), playResult({
        yards,
        turnover: kind,
        deadAtYardline100: spot,
        outOfBounds: input.outOfBounds === true,
        sack: input.sack === true,
    }), 'change_of_possession');
    const drive = openDrive({...game, situation}, defense, playId);
    return finishPlay({
        ...game,
        situation,
        personnel: personnelForPossession(game, defense),
        plays: [...game.plays, play],
        drives: [...closeDrive(appendPlayToDrive(game.drives, playId), 'turnover'), {...drive, playIds: []}],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
    }, input, turnoverFacts(game, input));
}

export function applyTurnover(
    game: GameState,
    input: PlayInput,
    kind: 'interception' | 'fumble',
    yards: number,
): GameState {
    const spot = Math.min(99, Math.max(1, game.situation.yardline100 - yards));
    const defense = oppositeTeam(game.situation.possession);
    if (input.touchdown === true) {
        return applyTouchdown(recordTurnoverPlay(game, input, kind, yards, spot, true), input, yards, defense);
    }
    return applyLostBall(game, input, kind, yards, spot, defense);
}

export function applyTouchdown(game: GameState, input: PlayInput, yards: number, scoringTeam: TeamId): GameState {
    const alreadyRecorded = game.plays[game.plays.length - 1]?.result.scoring === 'touchdown';
    let base = game;
    if (!alreadyRecorded) {
        const playId = `play-${game.nextPlayId}`;
        const play = buildPlay(game, input, playId, currentDriveId(game), {
            yards,
            firstDown: true,
            scoring: 'touchdown',
            deadAtYardline100: 0,
            outOfBounds: false,
            incomplete: false,
            sack: input.sack === true,
        }, 'score');
        base = {
            ...game,
            plays: [...game.plays, play],
            drives: closeDrive(appendPlayToDrive(game.drives, playId), 'td'),
            nextPlayId: game.nextPlayId + 1,
        };
    }
    return finishPlay(afterScore(base, scoringTeam, addScore(base, scoringTeam, 6), true), input, {
        downBefore: game.situation.down,
        firstDown: true,
        incomplete: false,
        scored: true,
        turnover: false,
    });
}

export function applySafety(game: GameState, input: PlayInput, yards: number): GameState {
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(game, input, playId, currentDriveId(game), playResult({
        yards,
        scoring: 'safety',
        deadAtYardline100: 100,
        sack: input.sack === true,
    }), 'score');
    const next: GameState = {
        ...game,
        score: addScore(game, oppositeTeam(game.situation.possession), 2),
        ...kickoffReady(game, game.situation.possession),
        plays: [...game.plays, play],
        drives: closeDrive(appendPlayToDrive(game.drives, playId), 'safety'),
        nextPlayId: game.nextPlayId + 1,
        clock: {...game.clock, running: false},
    };
    next.clock.mercyActive = updateMercy(next);
    return finishPlay(next, input, {
        downBefore: game.situation.down,
        firstDown: false,
        incomplete: false,
        scored: true,
        turnover: false,
    });
}
