/** Pure helpers for speed-read chunking and pacing. No DOM, no timers. */
export function chunkWords(text: string, chunkSize: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const size = Math.max(1, Math.floor(chunkSize));
    const out: string[] = [];
    for (let i = 0; i < words.length; i += size) {
        out.push(words.slice(i, i + size).join(' '));
    }
    return out;
}

export function msPerChunk(wpm: number, chunkSize: number): number {
    const wordsPerMinute = Math.max(60, wpm);
    const wordsPerMs = wordsPerMinute / 60000;
    const msPerWord = 1 / wordsPerMs;
    return Math.round(msPerWord * Math.max(1, chunkSize));
}

export function pauseMultiplier(chunk: string): number {
    const last = chunk.trim().slice(-1);
    if (last === '.' || last === '!' || last === '?') return 2.0;
    if (last === ',' || last === ';' || last === ':') return 1.4;
    return 1.0;
}

export function nextDelay(wpm: number, chunkSize: number, chunk: string): number {
    return Math.round(msPerChunk(wpm, chunkSize) * pauseMultiplier(chunk));
}
