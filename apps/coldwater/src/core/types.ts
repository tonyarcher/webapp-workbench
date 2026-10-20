export type Mode = 'practice' | 'points';

export type Action = 'eat' | 'chase' | 'ignore' | 'shallow' | 'deep';

export type Depth = 'shallow' | 'deep';

export type Size = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

export type Tone = 'good' | 'neutral' | 'bad' | 'fatal';

export type Phase = 'choosing' | 'resolved' | 'dead';

export type ArtKey =
    | 'chub'
    | 'whitefish'
    | 'rainbow'
    | 'blueback'
    | 'dolly'
    | 'mackinaw'
    | 'walleye'
    | 'otter'
    | 'osprey'
    | 'bait'
    | 'fly'
    | 'algae'
    | 'plankton'
    | 'insects'
    | 'bottom-life';

export type SpeciesId = 'chub' | 'whitefish' | 'rainbow' | 'blueback' | 'dolly' | 'mackinaw' | 'walleye';

export type EncounterId =
    SpeciesId | 'otter' | 'osprey' | 'angler-bait' | 'angler-fly' | 'algae' | 'plankton' | 'insects' | 'bottom-life';

export type FoodId = 'algae' | 'plankton' | 'insects' | 'bottom-life';

export interface Species {
    readonly id: SpeciesId;
    readonly name: string;
    readonly size: Size;
    readonly depth: Depth | 'both';
    readonly canShallow: boolean;
    readonly canDeep: boolean;
    readonly eats: readonly EncounterId[];
    readonly predators: readonly EncounterId[];
    readonly fact: string;
    readonly art: ArtKey;
}

export interface EscapeRoutes {
    readonly shallow: boolean;
    readonly deep: boolean;
}

export interface Encounter {
    readonly id: EncounterId;
    readonly name: string;
    readonly kind: 'fish' | 'predator' | 'food' | 'hazard';
    readonly depth: Depth | 'both';
    readonly points: number;
    readonly clue: string;
    readonly description: string;
    readonly art: ArtKey;
    readonly escape: EscapeRoutes | null;
}

export interface Outcome {
    readonly tone: Tone;
    readonly title: string;
    readonly detail: string;
    readonly points: number;
    readonly survived: boolean;
}

export interface RunState {
    readonly mode: Mode;
    readonly seed: number;
    readonly step: number;
    readonly speciesId: SpeciesId;
    readonly score: number;
    readonly encountersThisFish: number;
    readonly totalEncounters: number;
    readonly phase: Phase;
    readonly encounterId: EncounterId;
    readonly timeLeftMs: number;
    readonly outcome: Outcome | null;
    readonly bag: EncounterId[];
    readonly lastEncounterId: EncounterId | null;
}
