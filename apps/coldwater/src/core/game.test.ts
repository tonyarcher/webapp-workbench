import { describe, expect, it } from 'vitest';
import {
    ENCOUNTERS_PER_FISH,
    POINTS_TIME_MS,
    availableActions,
    chooseAction,
    continueRun,
    currentEncounter,
    currentSpecies,
    startRun,
    tick,
} from './game';
import { SPECIES_LIST, speciesById } from './data';
import { randomAt } from './rng';
import type { EncounterId, RunState } from './types';

function atEncounter(state: RunState, encounterId: EncounterId): RunState {
    return { ...state, encounterId };
}

function resolvedAt(encounterId: EncounterId, mode: 'practice' | 'points' = 'practice'): RunState {
    const base = startRun(mode, 'walleye', 7);
    return chooseAction(atEncounter(base, encounterId), 'ignore', 0);
}

describe('run state', () => {
    it('starts a practice run with the chosen fish', () => {
        const run = startRun('practice', 'walleye', 123);
        expect(run.mode).toBe('practice');
        expect(run.speciesId).toBe('walleye');
        expect(run.phase).toBe('choosing');
        expect(run.score).toBe(0);
        expect(run.timeLeftMs).toBe(POINTS_TIME_MS);
        expect(currentSpecies(run).name).toBe('Walleye');
        expect(currentEncounter(run).id).toBe(run.encounterId);
        expect(run.bag.length).toBeGreaterThan(0);
    });

    it('picks a real fish for a points run', () => {
        const run = startRun('points', 'chub', 99);
        expect(SPECIES_LIST.map((species) => species.id)).toContain(run.speciesId);
        expect(run.mode).toBe('points');
    });

    it('resolves an action and scores it', () => {
        const run = atEncounter(startRun('practice', 'walleye', 7), 'chub');
        const resolved = chooseAction(run, 'eat', 0);
        expect(resolved.phase).toBe('resolved');
        expect(resolved.score).toBe(5);
        expect(resolved.timeLeftMs).toBe(0);
        expect(resolved.outcome?.tone).toBe('good');
        expect(chooseAction(resolved, 'eat', 0)).toBe(resolved);
    });

    it('ends the run when a predator wins', () => {
        const run = atEncounter(startRun('practice', 'walleye', 7), 'otter');
        const dead = chooseAction(run, 'ignore', 0);
        expect(dead.phase).toBe('dead');
        expect(dead.outcome?.survived).toBe(false);
        expect(continueRun(dead)).toBe(dead);
    });

    it('does not allow a mackinaw to choose a shallow escape', () => {
        const run = atEncounter(startRun('practice', 'mackinaw', 7), 'chub');
        expect(availableActions(run)).toEqual(['eat', 'chase', 'ignore', 'deep']);
        expect(chooseAction(run, 'shallow', 0)).toBe(run);
    });

    it('returns no actions once an outcome is showing', () => {
        expect(availableActions(resolvedAt('chub'))).toEqual([]);
    });

    it('advances to a new encounter without repeating the last one', () => {
        const resolved = resolvedAt('chub');
        const next = continueRun(resolved);
        expect(next.phase).toBe('choosing');
        expect(next.totalEncounters).toBe(1);
        expect(next.timeLeftMs).toBe(POINTS_TIME_MS);
        expect(next.encounterId).not.toBe('chub');
        expect(next.lastEncounterId).toBe('chub');
    });

    it('keeps the same fish in practice mode', () => {
        let run = atEncounter(startRun('practice', 'walleye', 7), 'chub');
        for (let index = 0; index < ENCOUNTERS_PER_FISH; index += 1) {
            run = continueRun(chooseAction(atEncounter(run, 'chub'), 'eat', 0));
        }
        expect(run.speciesId).toBe('walleye');
        expect(run.encountersThisFish).toBe(ENCOUNTERS_PER_FISH);
    });

    it('rotates to a different fish after five encounters in points mode', () => {
        let run = atEncounter(startRun('points', 'walleye', 42), 'chub');
        const firstSpecies = run.speciesId;
        for (let index = 0; index < ENCOUNTERS_PER_FISH; index += 1) {
            run = continueRun(chooseAction(atEncounter(run, 'chub'), 'eat', 0));
        }
        expect(run.speciesId).not.toBe(firstSpecies);
        expect(run.encountersThisFish).toBe(0);
        expect(run.bag.length).toBeGreaterThan(0);
    });

    it('builds a fresh bag for the fish that rotates in', () => {
        // A hand-built fifth resolved turn: points mode picks its species from
        // the seed, so the outgoing fish is pinned here to make the rotating-in
        // fish deterministic across seeds. The bag holds one stale item from the
        // outgoing fish, so a reused bag is distinguishable from a rebuilt one.
        const base = startRun('points', 'walleye', 0);
        let next: RunState | null = null;
        for (let seed = 0; seed < 100 && next === null; seed += 1) {
            const readyToRotate: RunState = {
                ...base,
                seed,
                speciesId: 'mackinaw',
                encountersThisFish: ENCOUNTERS_PER_FISH - 1,
                phase: 'resolved',
                bag: ['whitefish'],
                lastEncounterId: base.encounterId,
            };
            const candidate = continueRun(readyToRotate);
            if (candidate.speciesId === 'chub') next = candidate;
        }
        if (next === null) throw new Error('no seed rotated into a chub');
        const chub = speciesById('chub');
        const allowed = new Set<EncounterId>([...chub.eats, ...chub.predators, 'angler-bait', 'angler-fly']);
        expect(next.encounterId).not.toBe('whitefish');
        expect(next.bag.length).toBeGreaterThan(0);
        for (const id of [...next.bag, next.encounterId]) {
            expect(allowed.has(id)).toBe(true);
        }
    });

    it('ticks a points clock down and resolves at zero', () => {
        const run = startRun('points', 'walleye', 7);
        const partially = tick(run, 250);
        expect(partially.timeLeftMs).toBe(POINTS_TIME_MS - 250);
        const expired = tick(partially, POINTS_TIME_MS);
        expect(expired.phase === 'resolved' || expired.phase === 'dead').toBe(true);
        expect(expired.timeLeftMs).toBe(0);
        expect(expired.outcome).not.toBeNull();
    });

    it('does not tick practice mode or a resolved run', () => {
        const practice = startRun('practice', 'walleye', 7);
        expect(tick(practice, 250)).toBe(practice);
        const resolved = resolvedAt('chub');
        expect(tick(resolved, 250)).toBe(resolved);
        expect(tick(practice, 0)).toBe(practice);
    });

    it('keeps scores non-negative', () => {
        const run = atEncounter(startRun('practice', 'walleye', 7), 'algae');
        const resolved = chooseAction(run, 'eat', 0);
        expect(resolved.score).toBe(0);
        expect(resolved.outcome?.points).toBe(-4);
    });

    it('uses a stable seeded roll', () => {
        expect(randomAt(123, 4)).toBe(randomAt(123, 4));
        expect(randomAt(123, 4)).toBeGreaterThanOrEqual(0);
        expect(randomAt(123, 4)).toBeLessThan(1);
        expect(randomAt(123, 4)).not.toBe(randomAt(124, 4));
    });
});
