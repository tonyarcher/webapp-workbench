import { isValidStamp } from './clock';
import { offensiveHoop, shotPoints } from './court-geom';
import { isOnCourt } from './lineup';
import { bonusKind, getRulebook } from './rulebook';
import { addStat, creditStints, flipPossession, resetShotClock, setPossession, teamSide } from './reduce-helpers';
import type { FreeThrowEvent, GameState, PendingFt, ReboundEvent, ShotEvent, ShotMark, TeamId } from './types';

function legalShooter(game: GameState, team: TeamId, shooterId: string): boolean {
    return game.possession === team && isOnCourt(teamSide(game, team).onCourt, shooterId);
}

function assistIdFor(game: GameState, event: ShotEvent): string | undefined {
    if (!event.made || !event.assistId || event.assistId === event.shooterId) return undefined;
    return isOnCourt(teamSide(game, event.team).onCourt, event.assistId) ? event.assistId : undefined;
}

function markFrom(game: GameState, event: ShotEvent, points: 0 | 2 | 3, assistId: string | undefined): ShotMark {
    const mark: ShotMark = {
        id: game.nextShotId,
        team: event.team,
        shooterId: event.shooterId,
        xFeet: event.xFeet,
        yFeet: event.yFeet,
        made: event.made,
        points,
        period: event.clock.period,
        clockSeconds: event.clock.gameClockSeconds,
    };
    if (assistId) mark.assistId = assistId;
    return mark;
}

function applyFieldGoalStats(
    game: GameState,
    event: ShotEvent,
    points: 0 | 2 | 3,
    assistId: string | undefined,
): GameState {
    let next = addStat(game, event.shooterId, 'fga', 1);
    if (points === 3 || (!event.made && points === 0 && shotWasThree(game, event))) {
        next = addStat(next, event.shooterId, 'tpa', 1);
    }
    if (!event.made) return next;
    next = addStat(next, event.shooterId, 'fgm', 1);
    next = addStat(next, event.shooterId, 'pts', points);
    if (points === 3) next = addStat(next, event.shooterId, 'tpm', 1);
    if (assistId) next = addStat(next, assistId, 'ast', 1);
    return next;
}

function shotWasThree(game: GameState, event: ShotEvent): boolean {
    const rb = getRulebook(game.rulebookId);
    const hoop = offensiveHoop(game.homeAttacksLeft, event.team, rb.court);
    return shotPoints(true, event.xFeet, event.yFeet, hoop, rb.court) === 3;
}

function shootingTrip(game: GameState, event: ShotEvent, points: 0 | 2 | 3): PendingFt {
    const three = points === 3 || shotWasThree(game, event);
    if (event.made)
        return { team: event.team, shooterId: event.shooterId, remaining: 1, oneAndOne: false, andOne: true };
    return { team: event.team, shooterId: event.shooterId, remaining: three ? 3 : 2, oneAndOne: false, andOne: false };
}

function applyBlock(game: GameState, blockerId: string | undefined, defense: TeamId): GameState {
    if (!blockerId) return game;
    if (!isOnCourt(teamSide(game, defense).onCourt, blockerId)) return game;
    return addStat(game, blockerId, 'blk', 1);
}

export function applyShot(game: GameState, event: ShotEvent): GameState {
    if (game.pendingFt || !isValidStamp(event.clock)) return game;
    if (!legalShooter(game, event.team, event.shooterId)) return game;
    const rb = getRulebook(game.rulebookId);
    const hoop = offensiveHoop(game.homeAttacksLeft, event.team, rb.court);
    const points = shotPoints(event.made, event.xFeet, event.yFeet, hoop, rb.court);
    const assistId = assistIdFor(game, event);
    let next = creditStints(game, event.clock);
    next = applyFieldGoalStats(next, event, points, assistId);
    next = applyBlock(next, event.blockedById, event.team === 'home' ? 'away' : 'home');
    next = {
        ...next,
        shots: [...next.shots, markFrom(next, event, points, assistId)],
        nextShotId: next.nextShotId + 1,
        score: event.made ? { ...next.score, [event.team]: next.score[event.team] + points } : next.score,
    };
    if (event.shootingFoul) {
        return { ...next, pendingFt: shootingTrip(next, event, points), clock: { ...next.clock, running: false } };
    }
    return event.made ? flipPossession(next) : next;
}

export function applyFreeThrow(game: GameState, event: FreeThrowEvent): GameState {
    const pending = game.pendingFt;
    if (!pending || pending.shooterId !== event.shooterId) return game;
    if (!isValidStamp(event.clock)) return game;
    let next = creditStints(game, event.clock);
    next = addStat(next, event.shooterId, 'fta', 1);
    if (event.made) {
        next = addStat(next, event.shooterId, 'ftm', 1);
        next = addStat(next, event.shooterId, 'pts', 1);
        next = { ...next, score: { ...next.score, [pending.team]: next.score[pending.team] + 1 } };
    }
    const stopTrip = pending.oneAndOne && !event.made;
    const remaining = stopTrip ? 0 : pending.remaining - 1;
    if (remaining > 0) {
        return { ...next, pendingFt: { ...pending, remaining }, clock: { ...next.clock, running: false } };
    }
    next = { ...next, pendingFt: null, clock: { ...next.clock, running: false } };
    if (event.made) return flipPossession(next);
    return next;
}

export function applyRebound(game: GameState, event: ReboundEvent): GameState {
    if (game.pendingFt) return game;
    if (!isValidStamp(event.clock)) return game;
    if (!isOnCourt(teamSide(game, event.team).onCourt, event.playerId)) return game;
    const rb = getRulebook(game.rulebookId);
    let next = creditStints(game, event.clock);
    next = addStat(next, event.playerId, event.offensive ? 'orb' : 'drb', 1);
    next = setPossession({ ...next, pendingFt: null }, event.team);
    if (event.offensive) return resetShotClock(next, rb.shotClockOrebSeconds);
    return next;
}

export function bonusTripForFouls(game: GameState, foulingTeam: TeamId, shooterId: string): PendingFt | null {
    const shootingTeam = foulingTeam === 'home' ? 'away' : 'home';
    const kind = bonusKind(getRulebook(game.rulebookId), game.teamFouls[foulingTeam]);
    if (kind === 'none') return null;
    return {
        team: shootingTeam,
        shooterId,
        remaining: 2,
        oneAndOne: kind === 'one-and-one',
        andOne: false,
    };
}
