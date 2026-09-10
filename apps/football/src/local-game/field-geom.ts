import type {Play, PlayFamily, TeamId} from 'football-core';

/** SVG units: 10 per yard. Home goal line at x=100, away at x=1100. */
export const FIELD_SCALE = 10;
export const ENDZONE_YARDS = 10;
export const FIELD_YARDS = 100;
export const FIELD_WIDTH = (ENDZONE_YARDS * 2 + FIELD_YARDS) * FIELD_SCALE;
export const FIELD_HEIGHT = 53.3 * FIELD_SCALE;
export const HOME_GOAL_X = ENDZONE_YARDS * FIELD_SCALE;
export const AWAY_GOAL_X = (ENDZONE_YARDS + FIELD_YARDS) * FIELD_SCALE;

const HASH = {
    left: FIELD_HEIGHT * 0.35,
    middle: FIELD_HEIGHT / 2,
    right: FIELD_HEIGHT * 0.65,
} as const;

export function yardsFromHomeGoal(yardline100: number, possession: TeamId): number {
    const clamped = Math.min(100, Math.max(0, yardline100));
    return possession === 'home' ? 100 - clamped : clamped;
}

export function xFromHomeYards(yards: number): number {
    const clamped = Math.min(FIELD_YARDS, Math.max(0, yards));
    return HOME_GOAL_X + clamped * FIELD_SCALE;
}

export function ballX(yardline100: number, possession: TeamId): number {
    return xFromHomeYards(yardsFromHomeGoal(yardline100, possession));
}

export function firstDownX(yardline100: number, distance: number, possession: TeamId): number {
    const los = yardsFromHomeGoal(yardline100, possession);
    const dir = possession === 'home' ? 1 : -1;
    return xFromHomeYards(los + dir * distance);
}

export function hashY(hash: 'left' | 'middle' | 'right'): number {
    return HASH[hash];
}

/** Place a unit blob `yards` behind (offense) or ahead (defense) of the LOS. */
export function unitX(losX: number, possession: TeamId, side: 'offense' | 'defense', yards = 5): number {
    const towardScore = possession === 'home' ? 1 : -1;
    const delta = (side === 'offense' ? -towardScore : towardScore) * yards * FIELD_SCALE;
    return Math.min(AWAY_GOAL_X - 20, Math.max(HOME_GOAL_X + 20, losX + delta));
}

export type FieldAnimKind = 'run' | 'pass' | 'fg' | 'kick';
export type FgAim = 'through' | 'left' | 'right';

export interface PlayFlight {
    kind: FieldAnimKind;
    fromX: number;
    toX: number;
    fromY: number;
    toY: number;
    aim?: FgAim;
}

/** Half the width of the goal posts, in field units (18.5 ft goal, 10 units per yard). */
export const POST_HALF = 31;
const POST_CENTER_Y = FIELD_HEIGHT / 2;
const POST_WIDE = POST_HALF + 34;
const POST_PAST = 35;

export function animKind(family: PlayFamily, incomplete: boolean, concept?: string): FieldAnimKind | null {
    if (isFieldGoal(family)) return 'fg';
    if (isKick(family)) return 'kick';
    if (family === 'scrimmage' || family === 'two_point') return scrimmageKind(incomplete, concept);
    if (family === 'kneel' || family === 'spike') return 'run';
    return null;
}

function isFieldGoal(family: PlayFamily): boolean {
    return family === 'field_goal' || family === 'extra_point';
}

function isKick(family: PlayFamily): boolean {
    return family === 'punt' || family === 'kickoff';
}

function scrimmageKind(incomplete: boolean, concept?: string): FieldAnimKind {
    if (incomplete) return 'pass';
    if (concept === 'dropback' || concept === 'play_action' || concept === 'screen') return 'pass';
    return 'run';
}

export function kickAim(play: Play): FgAim {
    if (play.result.scoring === 'field_goal' || play.result.scoring === 'extra_point') {
        return 'through';
    }
    let n = 0;
    for (let i = 0; i < play.id.length; i += 1) n += play.id.charCodeAt(i);
    return n % 2 === 0 ? 'left' : 'right';
}

/**
 * Straight kick that crosses the post plane at the aim point, then runs past it.
 * The origin is needed so the frozen ball continues along the same line.
 */
export function fgTarget(fromX: number, fromY: number, possession: TeamId, aim: FgAim): {toX: number; toY: number} {
    const towardAway = possession === 'home';
    const postX = towardAway ? FIELD_WIDTH : 0;
    let aimY = POST_CENTER_Y;
    if (aim !== 'through') {
        const wide = POST_WIDE;
        const toLeft = towardAway === (aim === 'left');
        aimY = toLeft ? POST_CENTER_Y - wide : POST_CENTER_Y + wide;
    }
    const dx = postX - fromX;
    const dy = aimY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    return {toX: postX + ux * POST_PAST, toY: aimY + uy * POST_PAST};
}

export function playFlight(play: Play): PlayFlight | null {
    const kind = animKind(play.call.family, play.result.incomplete, play.call.concept);
    if (!kind) return null;
    const poss = play.situation.possession;
    const fromY = hashY(play.situation.hash);
    const fromX = ballX(play.situation.yardline100, poss);
    if (kind === 'fg') {
        const aim = kickAim(play);
        const {toX, toY} = fgTarget(fromX, fromY, poss, aim);
        return {kind, fromX, fromY, toX, toY, aim};
    }
    const dir = poss === 'home' ? 1 : -1;
    const yards = play.result.incomplete ? 12 : play.result.yards;
    const toX = xFromHomeYards(yardsFromHomeGoal(play.situation.yardline100, poss) + dir * yards);
    return {kind, fromX, fromY, toX, toY: fromY};
}
