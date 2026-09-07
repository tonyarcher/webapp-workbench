import type {Situation} from './types';
import {oppositeTeam} from './rulebook';

export interface SpotResult {
    yardline100: number;
    touchdown: boolean;
    safety: boolean;
}

export function applyYards(yardline100: number, yards: number): SpotResult {
    const next = yardline100 - yards;
    if (next <= 0) return {yardline100: 0, touchdown: true, safety: false};
    if (next >= 100) return {yardline100: 100, touchdown: false, safety: true};
    return {yardline100: next, touchdown: false, safety: false};
}

export function goalToGoDistance(yardline100: number): number {
    return Math.min(10, Math.max(1, yardline100));
}

export function flipSpot(deadAtYardline100: number): number {
    return Math.min(99, Math.max(1, 100 - deadAtYardline100));
}

export function flipPossession(situation: Situation, deadAtYardline100: number): Situation {
    const yardline100 = flipSpot(deadAtYardline100);
    return {
        down: 1,
        distance: goalToGoDistance(yardline100),
        yardline100,
        hash: situation.hash,
        possession: oppositeTeam(situation.possession),
    };
}

export interface DownAdvance {
    down: 1 | 2 | 3 | 4;
    distance: number;
    yardline100: number;
    firstDown: boolean;
    turnoverOnDowns: boolean;
    touchdown: boolean;
    safety: boolean;
}

function advanceResult(
    down: 1 | 2 | 3 | 4,
    distance: number,
    yardline100: number,
    firstDown: boolean,
    extras: Partial<Pick<DownAdvance, 'turnoverOnDowns' | 'touchdown' | 'safety'>> = {},
): DownAdvance {
    return {
        down,
        distance,
        yardline100,
        firstDown,
        turnoverOnDowns: false,
        touchdown: false,
        safety: false,
        ...extras,
    };
}

export function advanceDownDistance(
    situation: Situation,
    yards: number,
    opts: {incomplete?: boolean; forceFirstDown?: boolean} = {},
): DownAdvance {
    const gained = opts.incomplete === true ? 0 : yards;
    const spot = applyYards(situation.yardline100, gained);
    if (spot.touchdown || spot.safety) {
        return advanceResult(situation.down, situation.distance, spot.yardline100, spot.touchdown, {
            touchdown: spot.touchdown,
            safety: spot.safety,
        });
    }
    if (opts.forceFirstDown === true || gained >= situation.distance) {
        return advanceResult(1, goalToGoDistance(spot.yardline100), spot.yardline100, true);
    }
    if (situation.down === 4) {
        return advanceResult(1, goalToGoDistance(spot.yardline100), spot.yardline100, false, {turnoverOnDowns: true});
    }
    return advanceResult((situation.down + 1) as 2 | 3 | 4, situation.distance - gained, spot.yardline100, false);
}
