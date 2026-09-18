import {getRulebook, offensiveHoop, stampFromClock} from 'basketball-core';
import type {ClockStamp, GameState, Point, ScoringEvent, ShotEvent, TeamId} from 'basketball-core';
import {between, chance, mixSeed, mulberry32} from './rng';
import {
    pickOnCourt,
    pickPasser,
    pickShooter,
    pickZone,
    ratingsFor,
    shouldAssist,
    shouldSub,
    type ShotZone,
} from './coach';
import type {SimRatings} from './types';

export function rngForEngine(seed: number, game: GameState, eventCount: number): () => number {
    return mulberry32(mixSeed(
        seed,
        eventCount,
        game.clock.period,
        game.clock.gameClockSeconds,
        game.score.home,
        game.score.away,
    ));
}

export function nextEvent(
    game: GameState,
    random: () => number,
    ratings?: Record<string, SimRatings>,
): ScoringEvent {
    if (game.clock.gameClockSeconds <= 0) return {type: 'period_end'};
    if (game.pendingFt) return freeThrow(game, random, ratings);
    const reboundEvent = followRebound(game, random, ratings);
    if (reboundEvent) return reboundEvent;
    const sub = shouldSub(game, game.possession, random);
    if (sub) return {type: 'substitution', team: game.possession, outId: sub.outId, inId: sub.inId};
    if (chance(random, 0.03) && teamTimeouts(game, game.possession) > 0) {
        return {type: 'timeout', team: game.possession};
    }
    if (chance(random, 0.08)) return turnover(game, random, ratings);
    if (chance(random, 0.07)) return foul(game, random, ratings);
    return shot(game, random, ratings);
}

function followRebound(
    game: GameState,
    random: () => number,
    ratings?: Record<string, SimRatings>,
): ScoringEvent | null {
    const last = game.shots[game.shots.length - 1];
    if (!last || last.made || last.team !== game.possession) return null;
    const offensive = chance(random, 0.32);
    const team = offensive ? last.team : (last.team === 'home' ? 'away' : 'home');
    return {
        type: 'rebound',
        team,
        playerId: pickOnCourt(game, team, random, ratings, 'rebounding'),
        offensive,
        clock: stampFromClock(game.clock),
    };
}

function teamTimeouts(game: GameState, team: TeamId): number {
    return team === 'home' ? game.home.timeouts : game.away.timeouts;
}

function freeThrow(game: GameState, random: () => number, ratings?: Record<string, SimRatings>): ScoringEvent {
    const pending = game.pendingFt;
    if (!pending) return {type: 'period_end'};
    const skill = ratingsFor(pending.shooterId, ratings).shooting;
    return {
        type: 'free_throw',
        shooterId: pending.shooterId,
        made: chance(random, 0.68 + skill / 400),
        clock: stampFromClock(game.clock),
    };
}

function turnover(game: GameState, random: () => number, ratings?: Record<string, SimRatings>): ScoringEvent {
    const team = game.possession;
    const playerId = pickShooter(game, team, random, ratings);
    const defense = team === 'home' ? 'away' : 'home';
    const thief = chance(random, 0.45) ? pickOnCourt(game, defense, random, ratings, 'defense') : undefined;
    const clock = burnClock(game, random, 6, 16);
    const event: ScoringEvent = {type: 'turnover', team, playerId, clock};
    if (thief) return {...event, stealPlayerId: thief};
    return event;
}

function foul(game: GameState, random: () => number, ratings?: Record<string, SimRatings>): ScoringEvent {
    const offense = game.possession;
    const defense = offense === 'home' ? 'away' : 'home';
    const shooting = chance(random, 0.4);
    return {
        type: 'foul',
        team: defense,
        playerId: pickOnCourt(game, defense, random, ratings, 'defense'),
        fouledId: pickShooter(game, offense, random, ratings),
        shooting,
        clock: stampFromClock(game.clock),
    };
}

function shot(game: GameState, random: () => number, ratings?: Record<string, SimRatings>): ShotEvent {
    const team = game.possession;
    const shooterId = pickShooter(game, team, random, ratings);
    const skill = ratingsFor(shooterId, ratings);
    const zone = pickZone(random, skill);
    const loc = shotLocation(game, zone, random);
    const made = chance(random, makeChance(zone, skill));
    const clock = burnClock(game, random, 8, 24);
    const event: ShotEvent = {
        type: 'shot',
        team,
        shooterId,
        xFeet: loc.x,
        yFeet: loc.y,
        made,
        clock,
    };
    if (made) {
        const passerId = pickPasser(game, team, shooterId, random, ratings);
        const passer = passerId ? ratingsFor(passerId, ratings) : undefined;
        if (passerId && passer && shouldAssist(random, passer)) event.assistId = passerId;
    }
    if (!made && chance(random, 0.06)) event.shootingFoul = true;
    return event;
}

function makeChance(zone: ShotZone, skill: SimRatings): number {
    if (zone === 'three') return 0.28 + skill.three / 280;
    if (zone === 'mid') return 0.36 + skill.shooting / 260;
    return 0.52 + skill.shooting / 280;
}

function shotLocation(game: GameState, zone: ShotZone, random: () => number): Point {
    const spec = getRulebook(game.rulebookId).court;
    const hoop = offensiveHoop(game.homeAttacksLeft, game.possession, spec);
    const dir = hoop.x < spec.length / 2 ? 1 : -1;
    const dist = zoneDist(zone, spec.threeArcRadius, random);
    const spread = zone === 'paint' ? 4 : 10;
    const y = clampCourt(hoop.y + between(random, -spread, spread), 1, spec.width - 1);
    const x = clampCourt(hoop.x + dir * dist, 1, spec.length - 1);
    return {x, y};
}

function zoneDist(zone: ShotZone, arc: number, random: () => number): number {
    if (zone === 'paint') return between(random, 3, 8);
    if (zone === 'mid') return between(random, 12, 18);
    return between(random, Math.round(arc) + 1, Math.round(arc) + 4);
}

function clampCourt(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function burnClock(game: GameState, random: () => number, min: number, max: number): ClockStamp {
    const burn = between(random, min, max);
    return {
        period: game.clock.period,
        gameClockSeconds: Math.max(0, game.clock.gameClockSeconds - burn),
        shotClockSeconds: Math.max(0, game.clock.shotClockSeconds - burn),
    };
}
