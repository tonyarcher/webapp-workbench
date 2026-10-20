import type { Encounter, EncounterId, EscapeRoutes, FoodId, Species, SpeciesId } from './types';

export const FOOD_IDS: readonly FoodId[] = ['algae', 'plankton', 'insects', 'bottom-life'];

export const SPECIES_LIST: readonly Species[] = [
    {
        id: 'chub',
        name: 'Chub',
        size: 'tiny',
        depth: 'both',
        canShallow: true,
        canDeep: true,
        eats: ['algae', 'plankton', 'insects'],
        predators: ['rainbow', 'dolly', 'mackinaw', 'walleye', 'otter', 'osprey'],
        fact: 'A quick little minnow that picks at algae and insects in the shallows.',
        art: 'chub',
    },
    {
        id: 'whitefish',
        name: 'Mountain whitefish',
        size: 'small',
        depth: 'deep',
        canShallow: true,
        canDeep: true,
        eats: ['plankton', 'insects', 'bottom-life'],
        predators: ['mackinaw', 'walleye', 'otter', 'osprey'],
        fact: 'A silver bottom-feeder with a small mouth. It grubs through silt for insects.',
        art: 'whitefish',
    },
    {
        id: 'rainbow',
        name: 'Rainbow trout',
        size: 'medium',
        depth: 'both',
        canShallow: true,
        canDeep: true,
        eats: ['insects', 'plankton', 'chub'],
        predators: ['mackinaw', 'otter', 'osprey'],
        fact: 'A bright-sided hunter that takes insects at the surface and small fish when it can.',
        art: 'rainbow',
    },
    {
        id: 'blueback',
        name: 'Blueback salmon',
        size: 'small',
        depth: 'shallow',
        canShallow: true,
        canDeep: true,
        eats: ['plankton', 'insects'],
        predators: ['mackinaw', 'walleye', 'otter', 'osprey'],
        fact: 'A sleek plankton feeder that travels in loose schools near the surface.',
        art: 'blueback',
    },
    {
        id: 'dolly',
        name: 'Dolly Varden',
        size: 'medium',
        depth: 'both',
        canShallow: true,
        canDeep: true,
        eats: ['chub', 'insects', 'plankton'],
        predators: ['mackinaw', 'otter', 'osprey'],
        fact: 'A spotted char that patrols the cool edges of the lake.',
        art: 'dolly',
    },
    {
        id: 'mackinaw',
        name: 'Mackinaw',
        size: 'huge',
        depth: 'deep',
        canShallow: false,
        canDeep: true,
        eats: ['chub', 'whitefish', 'rainbow', 'blueback', 'dolly', 'walleye'],
        predators: [],
        fact: 'The lake’s largest trout. It hunts deep water and rarely rises into the warm shallows.',
        art: 'mackinaw',
    },
    {
        id: 'walleye',
        name: 'Walleye',
        size: 'large',
        depth: 'deep',
        canShallow: true,
        canDeep: true,
        eats: ['chub', 'whitefish', 'blueback', 'insects'],
        predators: ['mackinaw', 'otter', 'osprey'],
        fact: 'A low-light hunter with milky eyes. It ambushes smaller fish near the bottom.',
        art: 'walleye',
    },
];

const ESCAPE_BOTH: EscapeRoutes = { shallow: true, deep: true };
const ESCAPE_SURFACE: EscapeRoutes = { shallow: false, deep: true };
const ESCAPE_DEEP: EscapeRoutes = { shallow: true, deep: false };

const ENCOUNTER_LIST: readonly Encounter[] = [
    {
        id: 'chub',
        name: 'Chub',
        kind: 'fish',
        depth: 'both',
        points: 5,
        clue: 'A tiny silver fish darts through the light.',
        description: 'A chub nips at something in the shallows.',
        art: 'chub',
        escape: null,
    },
    {
        id: 'whitefish',
        name: 'Mountain whitefish',
        kind: 'fish',
        depth: 'deep',
        points: 8,
        clue: 'A pale fish noses through the silt.',
        description: 'A whitefish works the bottom with its small mouth.',
        art: 'whitefish',
        escape: null,
    },
    {
        id: 'rainbow',
        name: 'Rainbow trout',
        kind: 'fish',
        depth: 'both',
        points: 10,
        clue: 'A bright flank flashes in the current.',
        description: 'A rainbow trout turns broadside, watching you.',
        art: 'rainbow',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'blueback',
        name: 'Blueback salmon',
        kind: 'fish',
        depth: 'shallow',
        points: 8,
        clue: 'A slim fish holds near the surface with its school.',
        description: 'A blueback salmon drifts with a loose school.',
        art: 'blueback',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'dolly',
        name: 'Dolly Varden',
        kind: 'fish',
        depth: 'both',
        points: 12,
        clue: 'A spotted char hovers beside a sunken log.',
        description: 'A Dolly Varden patrols the cool edge of the drop-off.',
        art: 'dolly',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'mackinaw',
        name: 'Mackinaw',
        kind: 'fish',
        depth: 'deep',
        points: 25,
        clue: 'A long, dark shape rises from the deep.',
        description: 'A mackinaw cruises out of the cold dark.',
        art: 'mackinaw',
        escape: ESCAPE_DEEP,
    },
    {
        id: 'walleye',
        name: 'Walleye',
        kind: 'fish',
        depth: 'deep',
        points: 15,
        clue: 'A bronze fish with pale eyes hangs near the bottom.',
        description: 'A walleye watches from the edge of the light.',
        art: 'walleye',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'otter',
        name: 'River otter',
        kind: 'predator',
        depth: 'shallow',
        points: 0,
        clue: 'A brown shape rolls at the surface.',
        description: 'A river otter cuts through the surface, whiskers forward.',
        art: 'otter',
        escape: ESCAPE_SURFACE,
    },
    {
        id: 'osprey',
        name: 'Osprey',
        kind: 'predator',
        depth: 'shallow',
        points: 0,
        clue: 'A broad shadow falls across the surface.',
        description: 'An osprey folds its wings and drops toward the water.',
        art: 'osprey',
        escape: ESCAPE_SURFACE,
    },
    {
        id: 'angler-bait',
        name: 'Baited line',
        kind: 'hazard',
        depth: 'both',
        points: 0,
        clue: 'Something wriggles under a float.',
        description: 'A plump chub hangs under a float, tethered by a fine line.',
        art: 'bait',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'angler-fly',
        name: 'Angler’s fly',
        kind: 'hazard',
        depth: 'shallow',
        points: 0,
        clue: 'A speck dances on the water.',
        description: 'A bright fly skates across the surface.',
        art: 'fly',
        escape: ESCAPE_BOTH,
    },
    {
        id: 'algae',
        name: 'Algae',
        kind: 'food',
        depth: 'shallow',
        points: 3,
        clue: 'Green strands drift in the light.',
        description: 'Green algae coats a sunken branch.',
        art: 'algae',
        escape: null,
    },
    {
        id: 'plankton',
        name: 'Plankton',
        kind: 'food',
        depth: 'both',
        points: 2,
        clue: 'A pale cloud hangs in the water.',
        description: 'A cloud of plankton drifts in the open water.',
        art: 'plankton',
        escape: null,
    },
    {
        id: 'insects',
        name: 'Insects and larvae',
        kind: 'food',
        depth: 'both',
        points: 4,
        clue: 'Small shapes squirm in the silt.',
        description: 'Mayfly larvae wiggle near the bottom.',
        art: 'insects',
        escape: null,
    },
    {
        id: 'bottom-life',
        name: 'Bottom life',
        kind: 'food',
        depth: 'deep',
        points: 4,
        clue: 'The lake bed is alive with small movements.',
        description: 'Crayfish and snails work through the bottom debris.',
        art: 'bottom-life',
        escape: null,
    },
];

const SPECIES_BY_ID: ReadonlyMap<SpeciesId, Species> = new Map(SPECIES_LIST.map((species) => [species.id, species]));
const ENCOUNTER_BY_ID: ReadonlyMap<EncounterId, Encounter> = new Map(
    ENCOUNTER_LIST.map((encounter) => [encounter.id, encounter]),
);

export function speciesById(id: SpeciesId): Species {
    const species = SPECIES_BY_ID.get(id);
    if (!species) throw new Error(`Unknown species: ${id}`);
    return species;
}

export function encounterById(id: EncounterId): Encounter {
    const encounter = ENCOUNTER_BY_ID.get(id);
    if (!encounter) throw new Error(`Unknown encounter: ${id}`);
    return encounter;
}

export function allEncounters(): readonly Encounter[] {
    return ENCOUNTER_LIST;
}

export function isFood(id: EncounterId): id is FoodId {
    return (FOOD_IDS as readonly EncounterId[]).includes(id);
}
