/**
 * Small deterministic generator. The game keeps a step counter, so tests and
 * replays get the same rolls from the same seed without carrying a mutable
 * generator through every state transition.
 */
export function randomAt(seed: number, step: number): number {
    let value = (seed + Math.imul(step, 0x9e3779b9)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

export function randomIndex(seed: number, step: number, length: number): number {
    if (length <= 0) return 0;
    return Math.min(length - 1, Math.floor(randomAt(seed, step) * length));
}

export function shuffle<T>(items: readonly T[], seed: number): T[] {
    const out = [...items];
    let state = seed >>> 0 || 1;
    for (let index = out.length - 1; index > 0; index -= 1) {
        state ^= state << 13;
        state >>>= 0;
        state ^= state >>> 17;
        state ^= state << 5;
        state >>>= 0;
        const swapIndex = state % (index + 1);
        const left = out[index];
        const right = out[swapIndex];
        if (left !== undefined && right !== undefined) {
            out[index] = right;
            out[swapIndex] = left;
        }
    }
    return out;
}
