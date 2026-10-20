import { encounterById, speciesById } from './data';
import type { Action, Encounter, EncounterId, Outcome, Species, SpeciesId } from './types';

export type Relationship = 'prey' | 'predator' | 'food' | 'hazard' | 'neutral';

const BASE_ACTIONS: readonly Action[] = ['eat', 'chase', 'ignore'];

export function relationshipFor(species: Species, encounter: Encounter): Relationship {
    if (encounter.kind === 'hazard') return 'hazard';
    if (species.eats.includes(encounter.id)) return 'prey';
    if (species.predators.includes(encounter.id)) return 'predator';
    if (encounter.kind === 'food') return 'food';
    return 'neutral';
}

export function availableActionsFor(species: Species): readonly Action[] {
    const actions: Action[] = [...BASE_ACTIONS];
    if (species.canShallow) actions.push('shallow');
    if (species.canDeep) actions.push('deep');
    return actions;
}

function outcome(tone: Outcome['tone'], title: string, detail: string, points: number, survived: boolean): Outcome {
    return { tone, title, detail, points, survived };
}

function eatPrey(encounter: Encounter, roll: number): Outcome {
    if (encounter.kind === 'food') {
        return outcome(
            'good',
            'Food found',
            `You graze on the ${encounter.name.toLowerCase()}.`,
            encounter.points,
            true,
        );
    }
    if (roll < 0.82) {
        return outcome('good', 'Caught it', `You catch the ${encounter.name.toLowerCase()}.`, encounter.points, true);
    }
    return outcome('neutral', 'It slips away', 'A flick of the tail and the fish is gone.', 0, true);
}

function eatPredator(encounter: Encounter): Outcome {
    return outcome('fatal', 'You are eaten', `The ${encounter.name.toLowerCase()} is a hunter, not a meal.`, 0, false);
}

function eatHazard(): Outcome {
    return outcome(
        'fatal',
        'The line goes taut',
        'You took the bait. Somewhere above, an angler lifts the rod.',
        0,
        false,
    );
}

function eatWrongFood(encounter: Encounter): Outcome {
    return outcome(
        'bad',
        'Wrong food',
        `The ${encounter.name.toLowerCase()} does not sit well. You spit it out and lose points.`,
        -4,
        true,
    );
}

function eatOther(): Outcome {
    return outcome('neutral', 'Nothing to eat', 'You mouth it, then let it go.', 0, true);
}

function eat(relationship: Relationship, encounter: Encounter, roll: number): Outcome {
    switch (relationship) {
        case 'prey':
            return eatPrey(encounter, roll);
        case 'predator':
            return eatPredator(encounter);
        case 'hazard':
            return eatHazard();
        case 'food':
            return eatWrongFood(encounter);
        default:
            return eatOther();
    }
}

function chase(relationship: Relationship, encounter: Encounter, roll: number): Outcome {
    if (relationship === 'prey') {
        return outcome('neutral', 'Driven off', 'You chase it away. No meal, but no danger.', 0, true);
    }
    if (relationship === 'predator') {
        if (roll < 0.12) {
            return outcome('good', 'It veers away', 'A sudden rush makes the hunter think twice.', 0, true);
        }
        return outcome(
            'fatal',
            'The hunter turns',
            `You challenged the ${encounter.name.toLowerCase()} and lost.`,
            0,
            false,
        );
    }
    if (relationship === 'hazard') {
        return outcome('fatal', 'The line jerks', 'The bait was attached to more than a meal.', 0, false);
    }
    return outcome('neutral', 'Nothing happens', 'You dart at it, but there is nothing to chase.', 0, true);
}

function ignore(relationship: Relationship, encounter: Encounter): Outcome {
    if (relationship === 'predator') {
        return outcome(
            'fatal',
            'It closed in',
            `You gave the ${encounter.name.toLowerCase()} time to strike.`,
            0,
            false,
        );
    }
    if (relationship === 'hazard') {
        return outcome(
            'good',
            'Left it alone',
            'You let the bait drift past. The angler waits for another fish.',
            1,
            true,
        );
    }
    return outcome('neutral', 'Let it pass', 'You hold your place and watch it go.', 0, true);
}

function escapePredator(action: 'shallow' | 'deep', encounter: Encounter): Outcome {
    const safe = encounter.escape?.[action] ?? false;
    if (safe) {
        return outcome(
            'good',
            'You leave it behind',
            `The ${encounter.name.toLowerCase()} loses you in the water.`,
            2,
            true,
        );
    }
    return outcome(
        'fatal',
        'It follows you',
        `The ${encounter.name.toLowerCase()} knows this water better than you do.`,
        0,
        false,
    );
}

function escape(
    action: 'shallow' | 'deep',
    relationship: Relationship,
    species: Species,
    encounter: Encounter,
): Outcome {
    const canMove = action === 'shallow' ? species.canShallow : species.canDeep;
    if (!canMove) {
        return outcome('neutral', 'You cannot go that way', 'Your body is built for another depth.', 0, true);
    }
    switch (relationship) {
        case 'predator':
            return escapePredator(action, encounter);
        case 'hazard':
            return outcome('good', 'Clear of the line', 'You swim away before the hook can set.', 1, true);
        default:
            return outcome('neutral', 'A change of depth', 'You move through the water and wait.', 0, true);
    }
}

/**
 * Pure outcome for one encounter. `roll` is a number in [0, 1); callers pass a
 * seeded value so replays and tests are stable.
 */
export function resolveEncounter(
    speciesId: SpeciesId,
    encounterId: EncounterId,
    action: Action,
    roll: number,
): Outcome {
    const species = speciesById(speciesId);
    const encounter = encounterById(encounterId);
    const relationship = relationshipFor(species, encounter);
    const safeRoll = Math.min(1, Math.max(0, roll));

    switch (action) {
        case 'eat':
            return eat(relationship, encounter, safeRoll);
        case 'chase':
            return chase(relationship, encounter, safeRoll);
        case 'ignore':
            return ignore(relationship, encounter);
        case 'shallow':
        case 'deep':
            return escape(action, relationship, species, encounter);
    }
}
