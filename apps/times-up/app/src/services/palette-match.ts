/**
 * Subsequence fuzzy scoring for the command palette. Pure and DOM-free so
 * the smoke suite can pin the ranking. A query matches when its characters
 * appear in order in the target; the score rewards consecutive runs, word
 * starts, earlier matches, and shorter targets.
 */
export interface PaletteMatch {
    score: number;
    /** Indices into the target that matched, for highlight. */
    indices: number[];
}

const WORD_BOUNDARY = /[\s:/-]/;

export function fuzzyScore(query: string, target: string): PaletteMatch | null {
    const q = query.trim().toLowerCase();
    const t = target.toLowerCase();
    if (!q) return { score: 0, indices: [] };
    const indices: number[] = [];
    let qi = 0;
    let score = 0;
    let last = -2;
    let run = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] !== q[qi]) continue;
        indices.push(ti);
        run = ti === last + 1 ? run + 1 : 1;
        const wordStart = ti === 0 || WORD_BOUNDARY.test(t[ti - 1] ?? '');
        score += 10 + run * 4 + (wordStart ? 8 : 0);
        last = ti;
        qi++;
    }
    if (qi < q.length) return null;
    score += Math.max(0, 40 - t.length);
    score += Math.max(0, 20 - (indices[0] ?? 0));
    return { score, indices };
}
