import { FOOD_IDS, SPECIES_LIST, encounterById, isFood, speciesById } from './data';
import { randomAt, randomIndex, shuffle } from './rng';
import { availableActionsFor, resolveEncounter } from './resolve';
import type { Action, Encounter, EncounterId, Mode, RunState, Species, SpeciesId } from './types';

export const POINTS_TIME_MS = 10_000;
export const ENCOUNTERS_PER_FISH = 5;

function buildBag(species: Species, seed: number): EncounterId[] {
    const pool: EncounterId[] = [];
    for (const food of FOOD_IDS) {
        if (species.eats.includes(food)) pool.push(food, food);
    }
    for (const prey of species.eats) {
        if (!isFood(prey)) pool.push(prey, prey);
    }
    for (const predator of species.predators) pool.push(predator);
    pool.push('angler-bait', 'angler-fly');
    return shuffle(pool, seed);
}

function drawEncounter(
    species: Species,
    seed: number,
    currentBag: readonly EncounterId[],
    lastEncounterId: EncounterId | null,
): { encounterId: EncounterId; bag: EncounterId[] } {
    let bag = currentBag.length > 0 ? [...currentBag] : buildBag(species, seed);
    let encounterId = bag.shift();
    if (encounterId === undefined) {
        throw new Error('The encounter bag is empty');
    }
    if (encounterId === lastEncounterId && bag.length > 0) {
        const alternative = bag.shift();
        if (alternative !== undefined) {
            bag.push(encounterId);
            encounterId = alternative;
        }
    }
    return { encounterId, bag };
}

function choosePointsSpecies(seed: number): SpeciesId {
    const index = randomIndex(seed, 0, SPECIES_LIST.length);
    const species = SPECIES_LIST[index];
    if (!species) throw new Error('No species available');
    return species.id;
}

export function startRun(mode: Mode, speciesId: SpeciesId, seed: number): RunState {
    const chosenId = mode === 'points' ? choosePointsSpecies(seed) : speciesId;
    const species = speciesById(chosenId);
    const draw = drawEncounter(species, seed, [], null);
    return {
        mode,
        seed,
        step: 0,
        speciesId: chosenId,
        score: 0,
        encountersThisFish: 0,
        totalEncounters: 0,
        phase: 'choosing',
        encounterId: draw.encounterId,
        timeLeftMs: POINTS_TIME_MS,
        outcome: null,
        bag: draw.bag,
        lastEncounterId: null,
    };
}

export function currentSpecies(state: RunState): Species {
    return speciesById(state.speciesId);
}

export function currentEncounter(state: RunState): Encounter {
    return encounterById(state.encounterId);
}

export function availableActions(state: RunState): readonly Action[] {
    if (state.phase !== 'choosing') return [];
    return availableActionsFor(currentSpecies(state));
}

export function chooseAction(state: RunState, action: Action, roll: number): RunState {
    if (state.phase !== 'choosing') return state;
    if (!availableActionsFor(currentSpecies(state)).includes(action)) return state;
    const result = resolveEncounter(state.speciesId, state.encounterId, action, roll);
    return {
        ...state,
        step: state.step + 1,
        score: Math.max(0, state.score + result.points),
        phase: result.survived ? 'resolved' : 'dead',
        timeLeftMs: 0,
        outcome: result,
    };
}

/**
 * Points mode runs on a clock. Passing zero time out is the same as choosing to
 * ignore the encounter: the lake does not wait forever.
 */
export function tick(state: RunState, deltaMs: number): RunState {
    if (state.mode !== 'points' || state.phase !== 'choosing' || deltaMs <= 0) return state;
    const remaining = state.timeLeftMs - deltaMs;
    if (remaining > 0) {
        return { ...state, timeLeftMs: remaining };
    }
    return chooseAction({ ...state, timeLeftMs: 0 }, 'ignore', randomAt(state.seed, state.step));
}

function nextFish(state: RunState, totalEncounters: number): { speciesId: SpeciesId; encountersThisFish: number } {
    if (state.mode !== 'points' || state.encountersThisFish + 1 < ENCOUNTERS_PER_FISH) {
        return { speciesId: state.speciesId, encountersThisFish: state.encountersThisFish + 1 };
    }
    const candidates = SPECIES_LIST.filter((species) => species.id !== state.speciesId);
    const next = candidates[randomIndex(state.seed, state.step + totalEncounters, candidates.length)];
    if (!next) throw new Error('No species available for rotation');
    return { speciesId: next.id, encountersThisFish: 0 };
}

export function continueRun(state: RunState): RunState {
    if (state.phase !== 'resolved') return state;
    const totalEncounters = state.totalEncounters + 1;
    const { speciesId, encountersThisFish } = nextFish(state, totalEncounters);
    const bag = speciesId === state.speciesId ? state.bag : [];
    const draw = drawEncounter(speciesById(speciesId), state.seed + totalEncounters, bag, state.lastEncounterId);
    return {
        ...state,
        speciesId,
        encountersThisFish,
        totalEncounters,
        phase: 'choosing',
        encounterId: draw.encounterId,
        timeLeftMs: POINTS_TIME_MS,
        outcome: null,
        bag: draw.bag,
        lastEncounterId: state.encounterId,
    };
}
