import { updateMercy } from './clock';
import { flipPossession } from './down-distance';
import { oppositeTeam } from './rulebook';
import {
    addScore,
    afterScore,
    appendPlayToDrive,
    buildPlay,
    closeDrive,
    currentDriveId,
    finishPlay,
    kickoffReady,
    openDrive,
    personnelForPossession,
} from './reduce-helpers';
import type { ClockFactsInput } from './reduce-helpers';
import { playResult } from './reduce-plays-shared';
import type { GameState, Play, PlayInput, TeamId } from './types';

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

function recordTurnoverPlay(
    game: GameState,
    input: PlayInput,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
    td: boolean,
): GameState {
    const playId = `play-${game.nextPlayId}`;
    const play = turnoverPlay(game, input, playId, kind, yards, spot, td);
    return {
        ...game,
        plays: [...game.plays, play],
        drives: closeDrive(appendPlayToDrive(game.drives, playId), td ? 'td' : 'turnover'),
        nextPlayId: game.nextPlayId + 1,
    };
}

function turnoverPlayResult(
    input: PlayInput,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
    td: boolean,
): Parameters<typeof buildPlay>[4] {
    const scoring = td ? 'touchdown' : undefined;
    return {
        yards,
        firstDown: false,
        turnover: kind,
        ...(scoring === undefined ? {} : { scoring }),
        deadAtYardline100: spot,
        outOfBounds: false,
        incomplete: false,
        sack: input.sack === true,
    };
}

function turnoverPlay(
    game: GameState,
    input: PlayInput,
    playId: string,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
    td: boolean,
): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        turnoverPlayResult(input, kind, yards, spot, td),
        td ? 'score' : 'change_of_possession',
    );
}

function lostBallNext(
    game: GameState,
    situation: GameState['situation'],
    defense: TeamId,
    play: Play,
    playId: string,
    drive: ReturnType<typeof openDrive>,
): GameState {
    return {
        ...game,
        situation,
        personnel: personnelForPossession(game, defense),
        plays: [...game.plays, play],
        drives: [...closeDrive(appendPlayToDrive(game.drives, playId), 'turnover'), { ...drive, playIds: [] }],
        nextPlayId: game.nextPlayId + 1,
        nextDriveId: game.nextDriveId + 1,
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
    const play = lostBallPlay(game, input, playId, kind, yards, spot);
    const drive = openDrive({ ...game, situation }, defense, playId);
    return finishPlay(lostBallNext(game, situation, defense, play, playId, drive), input, turnoverFacts(game, input));
}

function lostBallPlay(
    game: GameState,
    input: PlayInput,
    playId: string,
    kind: 'interception' | 'fumble',
    yards: number,
    spot: number,
): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        playResult({
            yards,
            turnover: kind,
            deadAtYardline100: spot,
            outOfBounds: input.outOfBounds === true,
            sack: input.sack === true,
        }),
        'change_of_possession',
    );
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
    const base = withTouchdownPlay(game, input, yards);
    return finishPlay(afterScore(base, scoringTeam, addScore(base, scoringTeam, 6), true), input, {
        downBefore: game.situation.down,
        firstDown: true,
        incomplete: false,
        scored: true,
        turnover: false,
    });
}

/**
 * A return touchdown already logged its scoring play on the turnover path; record at most one play per snap.
 */
function withTouchdownPlay(game: GameState, input: PlayInput, yards: number): GameState {
    const alreadyRecorded = game.plays[game.plays.length - 1]?.result.scoring === 'touchdown';
    if (alreadyRecorded) return game;
    const playId = `play-${game.nextPlayId}`;
    const play = touchdownPlay(game, input, playId, yards);
    return {
        ...game,
        plays: [...game.plays, play],
        drives: closeDrive(appendPlayToDrive(game.drives, playId), 'td'),
        nextPlayId: game.nextPlayId + 1,
    };
}

function touchdownPlay(game: GameState, input: PlayInput, playId: string, yards: number): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        {
            yards,
            firstDown: true,
            scoring: 'touchdown',
            deadAtYardline100: 0,
            outOfBounds: false,
            incomplete: false,
            sack: input.sack === true,
        },
        'score',
    );
}

export function applySafety(game: GameState, input: PlayInput, yards: number): GameState {
    const playId = `play-${game.nextPlayId}`;
    const play = safetyPlay(game, input, playId, yards);
    const next: GameState = {
        ...game,
        score: addScore(game, oppositeTeam(game.situation.possession), 2),
        ...kickoffReady(game, game.situation.possession),
        plays: [...game.plays, play],
        drives: closeDrive(appendPlayToDrive(game.drives, playId), 'safety'),
        nextPlayId: game.nextPlayId + 1,
        clock: { ...game.clock, running: false },
    };
    next.clock.mercyActive = updateMercy(next);
    return finishPlay(next, input, safetyFacts(game));
}

function safetyPlay(game: GameState, input: PlayInput, playId: string, yards: number): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        playResult({
            yards,
            scoring: 'safety',
            deadAtYardline100: 100,
            sack: input.sack === true,
        }),
        'score',
    );
}

function safetyFacts(game: GameState): ClockFactsInput {
    return {
        downBefore: game.situation.down,
        firstDown: false,
        incomplete: false,
        scored: true,
        turnover: false,
    };
}
