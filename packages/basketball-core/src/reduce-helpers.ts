import {applyStamp, elapsedSeconds, isValidStamp, stampFromClock} from './clock';
import {getRulebook, oppositeTeam} from './rulebook';
import type {
    ClockStamp,
    GameState,
    PlayerStatLine,
    StatKey,
    TeamId,
    TeamSide,
} from './types';

const ZERO_STATS: Omit<PlayerStatLine, 'playerId'> = {
    seconds: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    ast: 0,
    orb: 0,
    drb: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    pts: 0,
};

export function emptyStat(playerId: string): PlayerStatLine {
    return {playerId, ...ZERO_STATS};
}

export function teamSide(game: GameState, team: TeamId): TeamSide {
    return team === 'home' ? game.home : game.away;
}

export function withTeam(game: GameState, team: TeamId, side: TeamSide): GameState {
    return team === 'home' ? {...game, home: side} : {...game, away: side};
}

export function addStat(game: GameState, playerId: string, key: StatKey, amount: number): GameState {
    const row = game.stats[playerId];
    if (!row) return game;
    return {
        ...game,
        stats: {...game.stats, [playerId]: {...row, [key]: row[key] + amount}},
    };
}

export function resetShotClock(game: GameState, seconds: number): GameState {
    return {...game, clock: {...game.clock, shotClockSeconds: seconds}};
}

export function setPossession(game: GameState, team: TeamId): GameState {
    const rb = getRulebook(game.rulebookId);
    return {
        ...game,
        possession: team,
        pendingFt: null,
        clock: {...game.clock, shotClockSeconds: rb.shotClockSeconds, running: false},
    };
}

export function creditStints(game: GameState, until: ClockStamp): GameState {
    if (!isValidStamp(until)) return game;
    const stats = {...game.stats};
    const stintStart = {...game.stintStart};
    for (const id of [...game.home.onCourt, ...game.away.onCourt]) {
        const start = stintStart[id];
        const row = stats[id];
        if (!start || !row) continue;
        stats[id] = {...row, seconds: row.seconds + elapsedSeconds(start, until)};
        stintStart[id] = until;
    }
    return {
        ...game,
        stats,
        stintStart,
        clock: applyStamp(game.clock, until, game.clock.running),
    };
}

export function startStint(game: GameState, playerId: string): GameState {
    return {
        ...game,
        stintStart: {...game.stintStart, [playerId]: stampFromClock(game.clock)},
    };
}

export function stopStint(game: GameState, playerId: string): GameState {
    const {[playerId]: _dropped, ...rest} = game.stintStart;
    return {...game, stintStart: rest};
}

export function flipPossession(game: GameState): GameState {
    return setPossession(game, oppositeTeam(game.possession));
}


