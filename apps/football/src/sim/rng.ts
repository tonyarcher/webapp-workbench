export function mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export function mixSeed(...parts: number[]): number {
    let hash = 2166136261;
    for (const part of parts) {
        hash ^= part >>> 0;
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function chance(random: () => number, probability: number): boolean {
    return random() < probability;
}

export function between(random: () => number, min: number, max: number): number {
    return min + Math.floor(random() * (max - min + 1));
}
