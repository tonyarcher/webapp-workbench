import { advanceDownDistance, flipPossession } from './down-distance';
import {
    appendPlayToDrive,
    buildPlay,
    closeDrive,
    currentDriveId,
    finishPlay,
    openDrive,
    personnelForPossession,
} from './reduce-helpers';
import type { ClockFactsInput } from './reduce-helpers';
import { playResult } from './reduce-plays-shared';
import { applySafety, applyTouchdown, applyTurnover } from './reduce-plays-scoring';
import type { GameState, Play, PlayInput, Situation } from './types';

function applyDownsTurnover(game: GameState, input: PlayInput, yards: number, deadAt: number): GameState {
    const situation = flipPossession(game.situation, deadAt);
    const playId = `play-${game.nextPlayId}`;
    const play = downsPlay(game, input, playId, yards, deadAt);
    const drive = openDrive({ ...game, situation }, situation.possession, playId);
    return finishPlay(
        {
            ...game,
            situation,
            personnel: personnelForPossession(game, situation.possession),
            plays: [...game.plays, play],
            drives: [...closeDrive(appendPlayToDrive(game.drives, playId), 'downs'), { ...drive, playIds: [] }],
            nextPlayId: game.nextPlayId + 1,
            nextDriveId: game.nextDriveId + 1,
        },
        input,
        downsFacts(game, input, play),
    );
}

function downsPlay(game: GameState, input: PlayInput, playId: string, yards: number, deadAt: number): Play {
    return buildPlay(
        game,
        input,
        playId,
        currentDriveId(game),
        {
            yards,
            firstDown: false,
            turnover: 'downs',
            deadAtYardline100: deadAt,
            outOfBounds: input.outOfBounds === true,
            incomplete: input.incomplete === true || input.family === 'spike',
            sack: input.sack === true,
        },
        'change_of_possession',
    );
}

function downsFacts(game: GameState, input: PlayInput, play: Play): ClockFactsInput {
    return {
        downBefore: game.situation.down,
        firstDown: false,
        incomplete: play.result.incomplete,
        scored: false,
        turnover: true,
        outOfBounds: input.outOfBounds === true,
    };
}

function scrimmageYards(input: PlayInput): { incomplete: boolean; yards: number } {
    const incomplete = input.incomplete === true || input.family === 'spike';
    const yards = incomplete ? 0 : (input.yards ?? (input.family === 'kneel' ? -1 : 0));
    return { incomplete, yards };
}

export function applyScrimmage(game: GameState, input: PlayInput): GameState {
    const { incomplete, yards } = scrimmageYards(input);
    if (input.interception === true) return applyTurnover(game, input, 'interception', yards);
    if (input.fumbleLost === true) return applyTurnover(game, input, 'fumble', yards);
    const advance = advanceDownDistance(game.situation, yards, { incomplete });
    if (input.touchdown === true || advance.touchdown)
        return applyTouchdown(game, input, yards, game.situation.possession);
    if (input.safety === true || advance.safety) return applySafety(game, input, yards);
    if (advance.turnoverOnDowns) return applyDownsTurnover(game, input, yards, advance.yardline100);
    return applyOrdinaryGain(game, input, yards, incomplete, advance);
}

function gainSituation(
    game: GameState,
    input: PlayInput,
    advance: { down: Situation['down']; distance: number; yardline100: number },
): Situation {
    return {
        ...game.situation,
        down: advance.down,
        distance: advance.distance,
        yardline100: advance.yardline100,
        hash: input.hash ?? game.situation.hash,
    };
}

function drivesAfterPlay(game: GameState, playId: string) {
    if (currentDriveId(game)) return { drives: appendPlayToDrive(game.drives, playId), nextDriveId: game.nextDriveId };
    return {
        drives: [...game.drives, openDrive(game, game.situation.possession, playId)],
        nextDriveId: game.nextDriveId + 1,
    };
}

function ordinaryResult(
    input: PlayInput,
    yards: number,
    incomplete: boolean,
    advance: { yardline100: number; firstDown: boolean },
): ReturnType<typeof playResult> {
    return playResult({
        yards,
        firstDown: advance.firstDown,
        deadAtYardline100: advance.yardline100,
        outOfBounds: input.outOfBounds === true,
        incomplete,
        sack: input.sack === true,
    });
}

function ordinaryPlay(
    game: GameState,
    input: PlayInput,
    yards: number,
    incomplete: boolean,
    advance: { yardline100: number; firstDown: boolean },
) {
    const playId = `play-${game.nextPlayId}`;
    return {
        playId,
        play: buildPlay(
            game,
            input,
            playId,
            currentDriveId(game),
            ordinaryResult(input, yards, incomplete, advance),
            'none',
        ),
    };
}

function ordinaryGainFacts(
    game: GameState,
    input: PlayInput,
    advance: { firstDown: boolean },
    incomplete: boolean,
): ClockFactsInput {
    return {
        downBefore: game.situation.down,
        firstDown: advance.firstDown,
        incomplete,
        scored: false,
        turnover: false,
        outOfBounds: input.outOfBounds === true,
    };
}

function ordinaryGainNext(
    game: GameState,
    input: PlayInput,
    advance: { down: Situation['down']; distance: number; yardline100: number },
    play: Play,
    drives: GameState['drives'],
    nextDriveId: number,
): GameState {
    return {
        ...game,
        situation: gainSituation(game, input, advance),
        plays: [...game.plays, play],
        drives,
        nextPlayId: game.nextPlayId + 1,
        nextDriveId,
    };
}

function applyOrdinaryGain(
    game: GameState,
    input: PlayInput,
    yards: number,
    incomplete: boolean,
    advance: { down: Situation['down']; distance: number; yardline100: number; firstDown: boolean },
): GameState {
    const { playId, play } = ordinaryPlay(game, input, yards, incomplete, advance);
    const { drives, nextDriveId } = drivesAfterPlay(game, playId);
    return finishPlay(
        ordinaryGainNext(game, input, advance, play, drives, nextDriveId),
        input,
        ordinaryGainFacts(game, input, advance, incomplete),
    );
}
