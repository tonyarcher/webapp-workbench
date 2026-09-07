import {getRulebook} from './rulebook';
import type {ClockState, ClockStopReason, GameState, Rulebook} from './types';

export interface PlayClockFacts {
    incomplete: boolean;
    outOfBounds: boolean;
    firstDown: boolean;
    scored: boolean;
    turnover: boolean;
    downBefore: 1 | 2 | 3 | 4;
    period: number;
    deadClock: number;
    mercyActive: boolean;
    isTry: boolean;
}

export function isTwoMinutePeriod(period: number): boolean {
    return period === 2 || period === 4 || period >= 5;
}

export function formatClock(seconds: number): string {
    const clamped = Math.max(0, Math.round(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseClock(text: string): number | null {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim());
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function stopOnFirstDown(rulebook: Rulebook, period: number, deadClock: number): boolean {
    if (rulebook.firstDownClock === 'always') return true;
    if (rulebook.firstDownClock === 'never') return false;
    return isTwoMinutePeriod(period) && deadClock <= 120;
}

/**
 * After a live play, decide whether the game clock is stopped for the next snap.
 * Scorer-entered snap/dead times remain source of truth for elapsed time.
 */
function liveClockStop(rulebook: Rulebook, facts: PlayClockFacts): {stops: boolean; reason: ClockStopReason} {
    if (facts.incomplete) return {stops: true, reason: 'incomplete'};
    if (facts.outOfBounds) return {stops: true, reason: 'out_of_bounds'};
    if (facts.turnover) return {stops: true, reason: 'change_of_possession'};
    if (facts.firstDown && stopOnFirstDown(rulebook, facts.period, facts.deadClock)) {
        return {stops: true, reason: 'first_down'};
    }
    if (rulebook.clockStopsOnFourthDown && facts.downBefore === 4) {
        return {stops: true, reason: 'fourth_down'};
    }
    return {stops: false, reason: 'none'};
}

export function clockStopsAfterPlay(rulebook: Rulebook, facts: PlayClockFacts): {stops: boolean; reason: ClockStopReason} {
    if (facts.isTry) return {stops: true, reason: 'try'};
    if (facts.scored) return {stops: true, reason: 'score'};
    if (facts.mercyActive && rulebook.mercy) return {stops: false, reason: 'none'};
    return liveClockStop(rulebook, facts);
}

export function shouldIssueTwoMinuteWarning(
    rulebook: Rulebook,
    clock: ClockState,
    snapClock: number,
    deadClock: number,
): boolean {
    if (!rulebook.twoMinuteWarning) return false;
    if (clock.twoMinuteWarnedThisHalf) return false;
    if (!isTwoMinutePeriod(clock.period)) return false;
    return snapClock > 120 && deadClock <= 120;
}

export function updateMercy(game: GameState): boolean {
    const rulebook = getRulebook(game.rulebookId);
    const mercy = rulebook.mercy;
    if (!mercy) return false;
    const margin = Math.abs(game.score.home - game.score.away);
    if (game.clock.mercyActive) {
        if (mercy.sticky) return true;
        if (mercy.resumeBelow != null && margin < mercy.resumeBelow) return false;
        return margin >= mercy.margin || margin >= (mercy.resumeBelow ?? mercy.margin);
    }
    return game.clock.period >= mercy.startPeriod && margin >= mercy.margin;
}
