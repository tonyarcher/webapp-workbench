export type Rotation = 'power' | 'current' | 'recurrent' | 'gold';

export type Era = 'current' | 'recurrent' | 'gold-2000s' | 'gold-1990s';

export interface Weights {
    hitGravity: number;
    goldLeak: number;
    temperature: number;
    separation: number;
    powerOrbitMin: number;
}

export interface Station {
    id: string;
    name: string;
    format: string;
}

export interface Playlist {
    id: string;
    stationId: string;
    stationName: string;
    seed: string;
    startsAt: number;
    durationMs: number;
    weights: Weights;
    createdAt: number;
}

export interface PlaylistEntry {
    idx: number;
    trackId: string;
    artist: string;
    title: string;
    startsAt: number;
    durationMs: number;
    rotation: Rotation;
    era: Era;
}

export interface GenerateBody {
    stationId?: string;
    seed?: string;
    startsAt?: number;
    weights?: Partial<Weights>;
}

export interface GenerateResult {
    playlist: Playlist;
    entries: PlaylistEntry[];
}

export interface SavedSession {
    version: 1;
    playlistId: string;
    seed: string;
    weights: Weights;
    startsAt: number;
}

export type DayFilter = 'all' | string;

export type ListItem =
    | {kind: 'day'; key: string; label: string; day: string}
    | {kind: 'hour'; key: string; label: string}
    | {kind: 'track'; key: string; entry: PlaylistEntry};
