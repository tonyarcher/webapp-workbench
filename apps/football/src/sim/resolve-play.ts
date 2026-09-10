import type {GameState, PlayInput, ScoringEvent} from 'football-core';
import {chooseCall} from './coach';
import {between, chance, clamp, mixSeed, mulberry32} from './rng';

export function rngForEngine(seed: number, game: GameState, eventCount: number): () => number {
    return mulberry32(
        mixSeed(
            seed,
            eventCount,
            game.clock.period,
            game.clock.gameClockSeconds,
            game.situation.down,
            game.situation.distance,
            game.situation.yardline100,
            game.score.home,
            game.score.away,
            game.kickoffPending ? 1 : 0,
            game.pendingTry ? 1 : 0,
        ),
    );
}

export function nextEvent(game: GameState, random: () => number): ScoringEvent {
    if (clockExpired(game)) return {type: 'period_end'};
    const call = chooseCall(game, random);
    const snap = game.clock.gameClockSeconds;
    const input = fillPlay(game, call.family, call.concept, call.hash, snap, random);
    return {type: 'play', input};
}

function clockExpired(game: GameState): boolean {
    if (game.pendingTry || game.kickoffPending || game.clock.untimed) return false;
    return game.clock.gameClockSeconds <= 0;
}

function fillPlay(
    game: GameState,
    family: PlayInput['family'],
    concept: PlayInput['concept'],
    hash: PlayInput['hash'],
    snap: number,
    random: () => number,
): PlayInput {
    const burn = clockBurn(family, random);
    const dead = game.clock.untimed ? snap : Math.max(0, snap - burn);
    const base: PlayInput = {family, concept, hash, snapClock: snap, deadClock: dead};
    if (family === 'kickoff') return kickoffInput(base, random);
    if (family === 'extra_point') return {...base, extraPointMade: chance(random, 0.93)};
    if (family === 'two_point') return {...base, twoPointMade: chance(random, 0.48)};
    if (family === 'punt') return puntInput(game, base, random);
    if (family === 'field_goal') return fgInput(game, base, random);
    return scrimmageInput(game, base, random);
}

function clockBurn(family: PlayInput['family'], random: () => number): number {
    if (family === 'kickoff' || family === 'punt' || family === 'field_goal') return between(random, 4, 8);
    if (family === 'extra_point' || family === 'two_point') return 0;
    return between(random, 6, 38);
}

function kickoffInput(base: PlayInput, random: () => number): PlayInput {
    if (chance(random, 0.62)) return {...base, touchback: true, yards: 25};
    if (chance(random, 0.08)) return {...base, touchback: false, outOfBounds: true, yards: 35};
    return {...base, touchback: false, yards: between(random, 15, 40)};
}

function puntInput(game: GameState, base: PlayInput, random: () => number): PlayInput {
    const yards = between(random, 32, 52);
    const touchback = game.situation.yardline100 - yards <= 0;
    return {...base, yards, touchback};
}

function fgInput(game: GameState, base: PlayInput, random: () => number): PlayInput {
    const dist = game.situation.yardline100 + 17;
    const make = dist <= 30 ? 0.96 : dist <= 40 ? 0.88 : dist <= 50 ? 0.72 : 0.48;
    return {...base, fieldGoalMade: chance(random, make)};
}

function scrimmageInput(game: GameState, base: PlayInput, random: () => number): PlayInput {
    const pass = base.concept === 'dropback' || base.concept === 'play_action' || base.concept === 'screen';
    if (pass) return passInput(game, base, random);
    return runInput(game, base, random);
}

function runInput(game: GameState, base: PlayInput, random: () => number): PlayInput {
    const toGoal = game.situation.yardline100;
    let yards = clamp(between(random, -3, 18) + (chance(random, 0.12) ? between(random, 8, 28) : 0), -8, toGoal);
    if (chance(random, 0.015)) return {...base, yards: Math.min(yards, toGoal - 1), fumbleLost: true};
    const touchdown = yards >= toGoal;
    if (touchdown) yards = toGoal;
    const safety = !touchdown && toGoal - yards >= 100;
    return {...base, yards, touchdown, safety};
}

function passInput(game: GameState, base: PlayInput, random: () => number): PlayInput {
    const toGoal = game.situation.yardline100;
    if (chance(random, 0.07)) {
        return {...base, sack: true, yards: -between(random, 4, 12)};
    }
    if (chance(random, 0.03)) return {...base, interception: true, yards: between(random, 0, 12)};
    if (chance(random, 0.32)) return {...base, incomplete: true, yards: 0};
    let yards = clamp(between(random, 3, 22), 0, toGoal);
    const touchdown = yards >= toGoal;
    if (touchdown) yards = toGoal;
    return {...base, yards, touchdown};
}
