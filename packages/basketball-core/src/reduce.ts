import {stampFromClock} from './clock';
import {defaultOnCourt, generateRoster} from './default-roster';
import {isValidOnCourt} from './lineup';
import {getRulebook} from './rulebook';
import {emptyStat, startStint} from './reduce-helpers';
import {applyPeriodEnd, applyFoul, applySetClock, applyTimeout, applyTurnover} from './reduce-clock';
import {applySetLineup, applySubstitution} from './reduce-lineup';
import {applyFreeThrow, applyRebound, applyShot} from './reduce-shots';
import type {GameSetup, GameState, Player, PlayerStatLine, ScoringEvent, TeamId} from './types';

export function createGame(setup: GameSetup): GameState {
    const rb = getRulebook(setup.rulebookId);
    const homeRoster = setup.homeRoster?.length ? setup.homeRoster : generateRoster('home');
    const awayRoster = setup.awayRoster?.length ? setup.awayRoster : generateRoster('away');
    const homeOnCourt = resolveOnCourt(homeRoster, setup.homeOnCourt);
    const awayOnCourt = resolveOnCourt(awayRoster, setup.awayOnCourt);
    const home = team('home', setup.homeName, homeRoster, homeOnCourt, rb.timeoutsPerGame);
    const away = team('away', setup.awayName, awayRoster, awayOnCourt, rb.timeoutsPerGame);
    let game = blankGame(setup, rb, home, away, [...homeRoster, ...awayRoster]);
    for (const id of [...homeOnCourt, ...awayOnCourt]) {
        game = startStint(game, id);
    }
    return game;
}

function blankGame(
    setup: GameSetup,
    rb: ReturnType<typeof getRulebook>,
    home: GameState['home'],
    away: GameState['away'],
    players: Player[],
): GameState {
    return {
        rulebookId: setup.rulebookId,
        home,
        away,
        clock: openingClock(rb),
        possession: setup.openingPossession,
        openingPossession: setup.openingPossession,
        homeAttacksLeft: false,
        score: {home: 0, away: 0},
        teamFouls: {home: 0, away: 0},
        pendingFt: null,
        shots: [],
        stats: statsFor(players),
        stintStart: {},
        over: false,
        nextShotId: 1,
    };
}

function openingClock(rb: ReturnType<typeof getRulebook>): GameState['clock'] {
    return {
        period: 1,
        gameClockSeconds: rb.periodLengthSeconds,
        shotClockSeconds: rb.shotClockSeconds,
        running: false,
    };
}

function team(
    id: TeamId,
    name: string,
    roster: Player[],
    onCourt: string[],
    timeouts: number,
): GameState['home'] {
    return {id, name, roster, onCourt, timeouts};
}

function resolveOnCourt(roster: Player[], requested: string[] | undefined): string[] {
    if (requested && isValidOnCourt(requested, roster)) return [...requested];
    return defaultOnCourt(roster);
}

function statsFor(players: Player[]): Record<string, PlayerStatLine> {
    const stats: Record<string, PlayerStatLine> = {};
    for (const player of players) stats[player.id] = emptyStat(player.id);
    return stats;
}

export function reduce(game: GameState, event: ScoringEvent): GameState {
    if (game.over) return game;
    return dispatchLive(game, event) ?? dispatchAdmin(game, event);
}

function dispatchLive(game: GameState, event: ScoringEvent): GameState | null {
    if (event.type === 'shot') return applyShot(game, event);
    if (event.type === 'free_throw') return applyFreeThrow(game, event);
    if (event.type === 'rebound') return applyRebound(game, event);
    if (event.type === 'turnover') return applyTurnover(game, event);
    if (event.type === 'foul') return applyFoul(game, event);
    return null;
}

function dispatchAdmin(game: GameState, event: ScoringEvent): GameState {
    if (event.type === 'substitution') return applySubstitution(game, event);
    if (event.type === 'timeout') return applyTimeout(game, event);
    if (event.type === 'period_end') return applyPeriodEnd(game);
    if (event.type === 'set_clock') return applySetClock(game, event);
    if (event.type === 'set_lineup') return applySetLineup(game, event);
    return game;
}

export function replay(setup: GameSetup, events: ScoringEvent[]): GameState {
    return events.reduce(reduce, createGame(setup));
}

export function currentStamp(game: GameState): ReturnType<typeof stampFromClock> {
    return stampFromClock(game.clock);
}
