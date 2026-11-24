import type { Article } from '../types';

export function extractTerms(text: string): string[] {
    const acronyms = text.match(/\b[A-Z]{2,6}\b/g) ?? [];
    const unique = [...new Set(acronyms)];
    return unique.filter((t) => !COMMON_STOPWORDS.has(t));
}

const COMMON_STOPWORDS = new Set([
    'THE',
    'AND',
    'FOR',
    'ARE',
    'BUT',
    'NOT',
    'YOU',
    'ALL',
    'CAN',
    'HER',
    'WAS',
    'ONE',
    'OUR',
    'OUT',
    'DAY',
    'GET',
    'HAS',
    'HIM',
    'HIS',
    'HOW',
    'MAN',
    'NEW',
    'NOW',
    'OLD',
    'SEE',
    'TWO',
    'WAY',
    'WHO',
    'BOY',
    'DID',
    'ITS',
    'LET',
    'PUT',
    'SAY',
    'SHE',
    'TOO',
    'USE',
    'CEO',
    'CFO',
    'CTO',
]);

export function termContext(articles: Article[], term: string): string {
    for (const a of articles) {
        const text = a.content ?? a.summary ?? '';
        const idx = text.indexOf(term);
        if (idx >= 0) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(text.length, idx + term.length + 60);
            return text.slice(start, end).replace(/\s+/g, ' ').trim();
        }
    }
    return '';
}
