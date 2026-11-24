/**
 * Per-article keyword list. Derived from the article text so every article
 * has keywords to show, with the reader's learned weight attached to each.
 * Learned words (positive or deranked) sort first, then by frequency.
 */
import { extractWords } from './interesting-words';

export interface ArticleKeyword {
    word: string;
    score: number;
}

const MAX_KEYWORDS = 16;
const MAX_TEXT = 20_000;

export function articleKeywordsOf(
    title: string,
    summary: string | undefined,
    content: string | undefined,
    wordMap: Record<string, number>,
    max = MAX_KEYWORDS,
): ArticleKeyword[] {
    const raw = `${title} ${summary ?? ''} ${(content ?? '').replace(/<[^>]+>/g, ' ')}`.slice(0, MAX_TEXT);
    const counts = new Map<string, number>();
    for (const word of extractWords(raw)) counts.set(word, (counts.get(word) ?? 0) + 1);
    return [...counts.entries()]
        .map(([word, count]) => ({ word, count, score: wordMap[word] ?? 0 }))
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, max)
        .map(({ word, score }) => ({ word, score }));
}
