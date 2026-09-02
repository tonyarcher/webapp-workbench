export type Rotation = 'power' | 'current' | 'recurrent' | 'gold';

export type Era = 'current' | 'recurrent' | 'gold-2000s' | 'gold-1990s';

export interface Weights {
    hitGravity: number;
    goldLeak: number;
    temperature: number;
    separation: number;
    powerOrbitMin: number;
}

export interface Track {
    id: string;
    artist: string;
    title: string;
    durationMs: number;
    year: number;
    genre: string;
    era: Era;
    rotation: Rotation;
    rank: number;
    explicit: boolean;
    radioEdit: boolean;
    mbid?: string;
}

export interface Station {
    id: string;
    name: string;
    format: string;
}

export interface ScheduledEntry {
    trackId: string;
    artist: string;
    title: string;
    startsAtMs: number;
    durationMs: number;
    rotation: Rotation;
    era: Era;
    rank: number;
}

export interface PlaylistRow {
    id: string;
    stationId: string;
    stationName: string;
    seed: string;
    startsAt: number;
    durationMs: number;
    weights: Weights;
    createdAt: number;
}

export interface PlaylistEntryRow {
    idx: number;
    trackId: string;
    artist: string;
    title: string;
    startsAt: number;
    durationMs: number;
    rotation: Rotation;
    era: Era;
}
