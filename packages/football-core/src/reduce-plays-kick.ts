import { updateMercy } from './clock';
import { flipPossession } from './down-distance';
import { oppositeTeam } from './rulebook';
import {
    addScore,
    buildPlay,
    closeDrive,
    currentDriveId,
    finishPlay,
    kickoffReady,
    kickoffSituation,
    openDrive,
    personnelForPossession,
} from './reduce-helpers';
import { playResult } from './reduce-plays-shared';
import type { GameState, Play, PlayInput, Situation, TeamId } from './types';

function kickoffSpot(game: GameState, input: PlayInput, receiving: TeamId): Situation {
    if (input.outOfBounds === true) {
        return { down: 1, distance: 10, yardline100: 60, hash: 'middle', possession: receiving };
    }
    if (input.touchback !== false) return kickoffSituation(game, receiving);
    const ownYard = Math.min(99, Math.max(1, input.yards ?? 25));
    return { down: 1, distance: 10, yardline100: 100 - ownYard, hash: 'middle', possession: receiving };
}

export function applyKickoff(game: GameState, input: PlayInput): GameState {
    const receiving = oppositeTeam(game.situation.possession);
    const situation = kickoffSpot(game, input, receiving);
    const playId = `play-${game.nextPlayId}`;
    const drive = openDrive({ ...game, situation }, receiving, playId);
    const play = kickoffPlay(game, input, playId, drive.id, situation);
    return {
        ...game,
        situation,
        personnel: personnelForPossession(game, receiving),
        kickoffPending: false,
        plays: [...game.plays, play],
        drives: [...game.drives, { ...drive, startYardline100: situation.yardline100, playIds: [] }],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
        clock: kickoffClock(game, input),
    };
}

function kickoffPlay(game: GameState, input: PlayInput, playId: string, driveId: string, situation: Situation): Play {
    return buildPlay(
        game,
        input,
        playId,
        driveId,
        playResult({
            yards: input.yards ?? 0,
            firstDown: true,
            deadAtYardline100: situation.yardline100,
        }),
        'none',
    );
}

function kickoffClock(game: GameState, input: PlayInput): GameState['clock'] {
    return {
        ...game.clock,
        gameClockSeconds: game.clock.untimed ? game.clock.gameClockSeconds : input.deadClock,
        running: false,
        playClockSeconds: 25,
    };
}

export function applyTry(game: GameState, input: PlayInput): GameState {
    const scoringTeam = game.tryTeam ?? game.situation.possession;
    const made = tryMade(input);
    const points = input.family === 'extra_point' ? 1 : 2;
    const playId = `play-${game.nextPlayId}`;
    const play = tryPlay(game, input, playId, made);
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
        clock: { ...game.clock, running: false },
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

function tryMade(input: PlayInput): boolean {
    return input.family === 'extra_point' ? input.extraPointMade === true : input.twoPointMade === true;
}

function tryPlay(game: GameState, input: PlayInput, playId: string, made: boolean): Play {
    const scoring = made ? (input.family === 'extra_point' ? 'extra_point' : 'two_point') : undefined;
    return buildPlay(
        game,
        input,
        playId,
        '',
        {
            yards: 0,
            firstDown: made && input.family === 'two_point',
            ...(scoring === undefined ? {} : { scoring }),
            deadAtYardline100: game.situation.yardline100,
            outOfBounds: false,
            incomplete: !made && input.family === 'two_point',
            sack: false,
        },
        'try',
    );
}

function puntSituation(game: GameState, yards: number, touchback: boolean) {
    const receiving = oppositeTeam(game.situation.possession);
    const deadAt = touchback ? 0 : Math.min(99, Math.max(1, game.situation.yardline100 - yards));
    const situation = touchback
        ? { down: 1 as const, distance: 10, yardline100: 80, hash: game.situation.hash, possession: receiving }
        : flipPossession(game.situation, deadAt);
    return { receiving, deadAt, situation };
}

export function applyPunt(game: GameState, input: PlayInput): GameState {
    const yards = input.yards ?? 40;
    const touchback = game.situation.yardline100 - yards <= 0 || input.touchback === true;
    const { receiving, deadAt, situation } = puntSituation(game, yards, touchback);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        playResult({
            yards,
            deadAtYardline100: touchback ? 0 : deadAt,
            outOfBounds: input.outOfBounds === true,
        }),
        'change_of_possession',
    );
    const drive = openDrive({ ...game, situation }, receiving, playId);
    return finishPlay(
        {
            ...game,
            situation,
            personnel: personnelForPossession(game, receiving),
            plays: [...game.plays, play],
            drives: [...closeDrive(game.drives, 'punt'), { ...drive, playIds: [] }],
            nextPlayId: game.nextPlayId + 1,
            nextDriveId: game.nextDriveId + 1,
            clock: { ...game.clock, running: false },
        },
        input,
    );
}

function applyMadeFieldGoal(game: GameState, input: PlayInput): GameState {
    const kicking = game.situation.possession;
    const playId = `play-${game.nextPlayId}`;
    const play = madeFieldGoalPlay(game, input, playId);
    const ready = kickoffReady(game, kicking);
    const next: GameState = {
        ...game,
        score: addScore(game, kicking, 3),
        ...ready,
        personnel: personnelForPossession(game, kicking),
        plays: [...game.plays, play],
        drives: closeDrive(game.drives, 'fg'),
        nextPlayId: game.nextPlayId + 1,
        clock: fieldGoalClock(game, input),
    };
    next.clock.mercyActive = updateMercy(next);
    return next;
}

function madeFieldGoalPlay(game: GameState, input: PlayInput, playId: string): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        {
            yards: game.situation.yardline100,
            firstDown: false,
            scoring: 'field_goal',
            deadAtYardline100: 0,
            outOfBounds: false,
            incomplete: false,
            sack: false,
        },
        'score',
    );
}

function fieldGoalClock(game: GameState, input: PlayInput): GameState['clock'] {
    return {
        ...game.clock,
        running: false,
        gameClockSeconds: game.clock.untimed ? game.clock.gameClockSeconds : input.deadClock,
    };
}

export function applyFieldGoal(game: GameState, input: PlayInput): GameState {
    if (input.fieldGoalMade === true) return applyMadeFieldGoal(game, input);
    const situation = flipPossession(game.situation, game.situation.yardline100);
    const playId = `play-${game.nextPlayId}`;
    const play = buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        {
            yards: 0,
            firstDown: false,
            deadAtYardline100: game.situation.yardline100,
            outOfBounds: false,
            incomplete: true,
            sack: false,
        },
        'change_of_possession',
    );
    const drive = openDrive({ ...game, situation }, situation.possession, playId);
    return finishPlay(
        {
            ...game,
            situation,
            personnel: personnelForPossession(game, situation.possession),
            plays: [...game.plays, play],
            drives: [...closeDrive(game.drives, 'downs'), { ...drive, playIds: [] }],
            nextPlayId: game.nextPlayId + 1,
            nextDriveId: game.nextDriveId + 1,
            clock: { ...game.clock, running: false },
        },
        input,
    );
}
