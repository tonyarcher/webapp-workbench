/**
 * Starred-word map for per-folder "interesting shadow" views.
 *
 * Pure and testable: no DOM, no network. The map learns which title words
 * the reader cares about from explicit signals only (stars weigh 4, matching
 * the affinity precedent in mutations.ts where a star records affinity 4 and
 * a read records 1). Folder articles then rank by their average word weight.
 *
 * `toJevState` is the documented Jev attach point: it serializes a
 * bounded candidate set plus the learned scores so a future `jev_ask` call
 * can rank or explain the shadow list. It never fetches.
 */

export const STAR_WORD_WEIGHT = 4;
export const READ_WORD_WEIGHT = 1;

/**
 * Small English stopword set: function words that carry no topic signal
 * (articles, prepositions, pronouns, auxiliaries). Kept small on purpose —
 * topic words must survive, so only the most frequent glue words are here.
 * Tokens shorter than 3 letters are dropped separately by extractWords.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'of',
    'to',
    'in',
    'on',
    'for',
    'with',
    'at',
    'by',
    'from',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'it',
    'its',
    'this',
    'that',
    'these',
    'those',
    'you',
    'your',
    'we',
    'our',
    'he',
    'she',
    'they',
    'their',
    'his',
    'her',
    'but',
    'not',
    'no',
    'so',
    'if',
    'then',
    'than',
    'too',
    'very',
    'can',
    'will',
    'just',
    'about',
    'into',
    'over',
    'after',
    'before',
    'up',
    'out',
    'off',
    'vs',
]);

/**
 * Lowercase title tokens with stopwords and short tokens removed.
 * Splits on non-letters so punctuation and numbers never become words.
 */
export function extractWords(title: string): string[] {
    return title
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Starred titles weigh STAR_WORD_WEIGHT each, read titles READ_WORD_WEIGHT. */
export function buildWordMap(
    starred: Array<{ title: string }>,
    read: Array<{ title: string }>,
): Record<string, number> {
    const map: Record<string, number> = {};
    addTitles(map, starred, STAR_WORD_WEIGHT);
    addTitles(map, read, READ_WORD_WEIGHT);
    return map;
}

function addTitles(map: Record<string, number>, articles: Array<{ title: string }>, weight: number): void {
    for (const article of articles) {
        for (const word of extractWords(article.title)) {
            map[word] = (map[word] ?? 0) + weight;
        }
    }
}

/**
 * Average word weight over the title's tokens. Normalized by token count so
 * long titles do not outrank short ones by word volume alone. 0 when the
 * title has no tokens or none of its words are known.
 */
export function interestingScore(article: { title: string }, wordMap: Record<string, number>): number {
    const tokens = extractWords(article.title);
    if (!tokens.length) return 0;
    let sum = 0;
    for (const token of tokens) sum += wordMap[token] ?? 0;
    return sum / tokens.length;
}

export interface ScoredWord {
    word: string;
    score: number;
}

/** Top n words by weight desc, ties broken alphabetically (deterministic). */
export function topWords(wordMap: Record<string, number>, n: number): ScoredWord[] {
    if (n <= 0) return [];
    return Object.entries(wordMap)
        .map(([word, score]) => ({ word, score }))
        .sort((a, b) => b.score - a.score || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0))
        .slice(0, n);
}

/**
 * Rank articles by their interestingScore desc, ties broken on id
 * (deterministic). Returns a new array; the input is never mutated.
 */
export function rankInteresting<T extends { id: string; title: string }>(
    articles: T[],
    wordMap: Record<string, number>,
): T[] {
    return [...articles].sort(
        (a, b) =>
            interestingScore(b, wordMap) - interestingScore(a, wordMap) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

export interface JevCandidateInput {
    id: string;
    title: string;
    feedId: string;
    hot: number;
}

/**
 * Bounded JSON state for a future jev_ask ranking call.
 * Shape: {candidates:[{id,title,feed,hot}], wordScores, affinity}.
 * Never exceeds maxChars and never truncates mid-article: over-budget
 * output drops whole trailing candidates first, then word scores, then
 * affinity entries. Always returns valid JSON.
 */
export function toJevState(
    articles: JevCandidateInput[],
    wordMap: Record<string, number>,
    affinity: Record<string, number>,
    maxChars: number,
): string {
    let candidates = articles.map((a) => ({ id: a.id, title: a.title, feed: a.feedId, hot: a.hot }));
    const words: Record<string, number> = {};
    for (const { word, score } of topWords(wordMap, 50)) words[word] = score;
    const aff: Record<string, number> = { ...affinity };
    const encode = () => JSON.stringify({ candidates, wordScores: words, affinity: aff });
    let out = encode();
    while (out.length > maxChars && candidates.length > 0) {
        candidates = candidates.slice(0, -1);
        out = encode();
    }
    while (out.length > maxChars && dropLastKey(words)) out = encode();
    while (out.length > maxChars && dropLastKey(aff)) out = encode();
    return out;
}

function dropLastKey(obj: Record<string, number>): boolean {
    const keys = Object.keys(obj);
    const last = keys[keys.length - 1];
    if (last === undefined) return false;
    delete obj[last];
    return true;
}
