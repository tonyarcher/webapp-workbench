/** Mulberry32 — tiny, seedable, enough entropy for a radio clock. */
export function hashSeed(seed: string): number {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
}

export type Rng = () => number;

export function createRng(seed: string): Rng {
    let a = hashSeed(seed);
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function pickWeighted<T>(rng: Rng, items: T[], weights: number[]): T {
    let total = 0;
    for (const w of weights) total += w;
    if (items.length === 0 || total <= 0) {
        throw new Error('pickWeighted: empty');
    }
    let roll = rng() * total;
    for (let i = 0; i < items.length; i++) {
        roll -= weights[i] ?? 0;
        if (roll < 0) {
            const item = items[i];
            if (item !== undefined) return item;
        }
    }
    return items[items.length - 1] as T;
}

export function pickUniform<T>(rng: Rng, items: T[]): T {
    if (items.length === 0) throw new Error('pickUniform: empty');
    return items[Math.floor(rng() * items.length)] as T;
}
