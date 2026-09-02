import type {Rotation, Track, Weights} from '../types.js';
import {WEEK_MS} from '../env.js';

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export interface BucketMix {
    power: number;
    current: number;
    recurrent: number;
}

export function bucketMix(hitGravity: number): BucketMix {
    const t = hitGravity / 100;
    return {
        power: lerp(0.15, 0.45, t),
        current: lerp(0.25, 0.45, t),
        recurrent: lerp(0.50, 0.10, t),
    };
}

export interface SeparationWindows {
    artistMs: number;
    titleMs: Record<Rotation, number>;
}

export function separationWindows(separation: number): SeparationWindows {
    const t = separation / 100;
    return {
        artistMs: lerp(8, 45, t) * 60_000,
        titleMs: {
            power: lerp(40, 100, t) * 60_000,
            current: lerp(2 * 60, 5 * 60, t) * 60_000,
            recurrent: lerp(6 * 60, 14 * 60, t) * 60_000,
            gold: lerp(8 * 60, 24 * 60, t) * 60_000,
        },
    };
}

export function dueScore(track: Track, now: number, lastPlay: number | undefined): number {
    const wait = lastPlay == null ? WEEK_MS : now - lastPlay;
    return wait * (1 + 1 / track.rank);
}

export interface OrbitPolicy {
    minMs: number;
    forceMs: number;
}

export function orbitPolicy(weights: Weights): OrbitPolicy {
    const orbitMs = weights.powerOrbitMin * 60_000;
    return {
        minMs: 0.7 * orbitMs,
        forceMs: 0.85 * orbitMs,
    };
}
