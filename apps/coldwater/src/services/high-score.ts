const KEY = 'coldwater:high-score:v1';

export function readHighScore(): number {
    try {
        const raw = globalThis.localStorage?.getItem(KEY);
        if (!raw) return 0;
        const value = Number.parseInt(raw, 10);
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
        return 0;
    }
}

export function writeHighScore(score: number): void {
    try {
        const next = Math.max(0, Math.floor(score));
        if (next <= readHighScore()) return;
        globalThis.localStorage?.setItem(KEY, String(next));
    } catch {
        // A browser can deny storage. A lost high score is better than a crash.
    }
}
