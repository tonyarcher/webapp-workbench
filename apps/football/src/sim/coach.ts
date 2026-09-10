import type {GameState, HashMark, PlayConcept, PlayFamily, Situation} from 'football-core';
import {chance} from './rng';

export interface SimCall {
    family: PlayFamily;
    concept?: PlayConcept;
    hash?: HashMark;
}

const HASHES: HashMark[] = ['left', 'middle', 'right'];

export function chooseHash(random: () => number): HashMark {
    return HASHES[Math.min(2, Math.floor(random() * 3))] ?? 'middle';
}

export function chooseCall(game: GameState, random: () => number): SimCall {
    const hash = chooseHash(random);
    if (game.kickoffPending) return {family: 'kickoff', hash};
    if (game.pendingTry) return tryCall(random, hash);
    return scrimmageCall(game.situation, random, hash);
}

function tryCall(random: () => number, hash: HashMark): SimCall {
    return chance(random, 0.08) ? {family: 'two_point', hash} : {family: 'extra_point', hash};
}

function scrimmageCall(situation: Situation, random: () => number, hash: HashMark): SimCall {
    const {down, distance, yardline100} = situation;
    if (down === 4) return fourthDownCall(yardline100, distance, random, hash);
    if (isLong(down, distance)) {
        return {family: 'scrimmage', concept: chance(random, 0.2) ? 'play_action' : 'dropback', hash};
    }
    if (chance(random, down === 1 ? 0.58 : 0.48)) {
        return {family: 'scrimmage', concept: chance(random, 0.4) ? 'outside_zone' : 'inside_zone', hash};
    }
    return {family: 'scrimmage', concept: 'dropback', hash};
}

function isLong(down: number, distance: number): boolean {
    return distance >= 8 || (down === 3 && distance >= 5);
}

function fourthDownCall(
    yardline100: number,
    distance: number,
    random: () => number,
    hash: HashMark,
): SimCall {
    const fgRange = yardline100 <= 42;
    if (distance <= 2 && yardline100 <= 50 && chance(random, 0.4)) {
        return {family: 'scrimmage', concept: 'qb_sneak', hash};
    }
    if (fgRange && (distance > 2 || chance(random, 0.7))) {
        return {family: 'field_goal', hash};
    }
    if (!fgRange) return {family: 'punt', hash};
    return {family: 'field_goal', hash};
}
