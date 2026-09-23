import { applyStamp, isValidStamp } from './clock';
import { isHalfTime, getRulebook, oppositeTeam } from './rulebook';
import { creditStints, setPossession, startStint, teamSide } from './reduce-helpers';
import type { FoulEvent, GameState, SetClockEvent, TimeoutEvent, TurnoverEvent } from './types';
import { addStat, flipPossession } from './reduce-helpers';
import { isOnCourt } from './lineup';
import { bonusTripForFouls } from './reduce-shots';

export function applySetClock(game: GameState, event: SetClockEvent): GameState {
    if (!isValidStamp(event.clock)) return game;
    const next = creditStints(game, event.clock);
    const running = event.running ?? next.clock.running;
    return { ...next, clock: applyStamp(next.clock, event.clock, running) };
}

export function applyTimeout(game: GameState, event: TimeoutEvent): GameState {
    const side = teamSide(game, event.team);
    if (side.timeouts <= 0) return game;
    const nextSide = { ...side, timeouts: side.timeouts - 1 };
    const withSide = event.team === 'home' ? { ...game, home: nextSide } : { ...game, away: nextSide };
    return { ...withSide, clock: { ...withSide.clock, running: false } };
}

export function applyTurnover(game: GameState, event: TurnoverEvent): GameState {
    if (game.pendingFt || !isValidStamp(event.clock)) return game;
    if (event.team !== game.possession) return game;
    if (!isOnCourt(teamSide(game, event.team).onCourt, event.playerId)) return game;
    let next = creditStints(game, event.clock);
    next = addStat(next, event.playerId, 'tov', 1);
    if (event.stealPlayerId) {
        const defense = event.team === 'home' ? 'away' : 'home';
        if (isOnCourt(teamSide(next, defense).onCourt, event.stealPlayerId)) {
            next = addStat(next, event.stealPlayerId, 'stl', 1);
        }
    }
    return flipPossession(next);
}

export function applyFoul(game: GameState, event: FoulEvent): GameState {
    if (game.pendingFt) return game;
    if (!isValidStamp(event.clock)) return game;
    if (!isOnCourt(teamSide(game, event.team).onCourt, event.playerId)) return game;
    let next = creditStints(game, event.clock);
    next = addStat(next, event.playerId, 'pf', 1);
    next = { ...next, clock: { ...next.clock, running: false } };
    if (event.offensive) return applyOffensiveFoul(next, event);
    next = addTeamFoul(next, event.team);
    return attachFoulTrip(next, event);
}

function attachFoulTrip(game: GameState, event: FoulEvent): GameState {
    if (!event.fouledId) return game;
    const shootingTeam = event.team === 'home' ? 'away' : 'home';
    if (!isOnCourt(teamSide(game, shootingTeam).onCourt, event.fouledId)) return game;
    if (event.shooting) {
        return {
            ...game,
            pendingFt: {
                team: shootingTeam,
                shooterId: event.fouledId,
                remaining: 2,
                oneAndOne: false,
                andOne: false,
            },
        };
    }
    const trip = bonusTripForFouls(game, event.team, event.fouledId);
    if (!trip) return game;
    return { ...game, pendingFt: trip };
}

function applyOffensiveFoul(game: GameState, event: FoulEvent): GameState {
    let next = addStat(game, event.playerId, 'tov', 1);
    return flipPossession(next);
}

function addTeamFoul(game: GameState, team: GameState['home']['id']): GameState {
    return { ...game, teamFouls: { ...game.teamFouls, [team]: game.teamFouls[team] + 1 } };
}

export function applyPeriodEnd(game: GameState): GameState {
    const zero = {
        period: game.clock.period,
        gameClockSeconds: 0,
        shotClockSeconds: 0,
    };
    const credited = creditStints(game, zero);
    const rb = getRulebook(credited.rulebookId);
    if (credited.clock.period < rb.regulationPeriods) {
        return nextPeriod(
            credited,
            rb.periodLengthSeconds,
            isHalfTime(credited.clock.period, rb.regulationPeriods),
            shouldResetFouls(rb.bonus.kind, credited.clock.period, rb.regulationPeriods, false),
        );
    }
    if (credited.score.home !== credited.score.away) {
        return { ...credited, over: true, pendingFt: null, clock: { ...credited.clock, running: false } };
    }
    return nextPeriod(credited, rb.otLengthSeconds, false, true);
}

function nextPeriod(game: GameState, length: number, flipBaskets: boolean, resetFouls: boolean): GameState {
    const rb = getRulebook(game.rulebookId);
    const period = game.clock.period + 1;
    let next = periodShell(game, rb, period, length, flipBaskets, resetFouls);
    for (const id of [...next.home.onCourt, ...next.away.onCourt]) {
        next = startStint(next, id);
    }
    if (flipBaskets) return setPossession(next, oppositeTeam(game.openingPossession));
    return next;
}

function periodShell(
    game: GameState,
    rb: ReturnType<typeof getRulebook>,
    period: number,
    length: number,
    flipBaskets: boolean,
    resetFouls: boolean,
): GameState {
    const sides =
        period > rb.regulationPeriods
            ? { home: { ...game.home, timeouts: 1 }, away: { ...game.away, timeouts: 1 } }
            : { home: game.home, away: game.away };
    const stamp = { period, gameClockSeconds: length, shotClockSeconds: rb.shotClockSeconds };
    return {
        ...game,
        ...sides,
        homeAttacksLeft: flipBaskets ? !game.homeAttacksLeft : game.homeAttacksLeft,
        pendingFt: null,
        teamFouls: resetFouls ? { home: 0, away: 0 } : game.teamFouls,
        clock: applyStamp(game.clock, stamp, false),
        stintStart: {},
    };
}

function shouldResetFouls(
    kind: 'period' | 'half',
    period: number,
    regulationPeriods: number,
    overtime: boolean,
): boolean {
    if (kind === 'period' || overtime) return true;
    return isHalfTime(period, regulationPeriods);
}
