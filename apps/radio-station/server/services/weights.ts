import type {Weights} from '../types.js';

export const DEFAULT_WEIGHTS: Weights = {
    hitGravity: 70,
    goldLeak: 15,
    temperature: 40,
    separation: 60,
    powerOrbitMin: 90,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}

export function canonicalizeWeights(raw: unknown): Weights {
    const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
        hitGravity: clampInt(o.hitGravity, 0, 100, DEFAULT_WEIGHTS.hitGravity),
        goldLeak: clampInt(o.goldLeak, 0, 100, DEFAULT_WEIGHTS.goldLeak),
        temperature: clampInt(o.temperature, 0, 100, DEFAULT_WEIGHTS.temperature),
        separation: clampInt(o.separation, 0, 100, DEFAULT_WEIGHTS.separation),
        powerOrbitMin: clampInt(o.powerOrbitMin, 60, 150, DEFAULT_WEIGHTS.powerOrbitMin),
    };
}

export function weightsJson(weights: Weights): string {
    return JSON.stringify({
        hitGravity: weights.hitGravity,
        goldLeak: weights.goldLeak,
        temperature: weights.temperature,
        separation: weights.separation,
        powerOrbitMin: weights.powerOrbitMin,
    });
}
