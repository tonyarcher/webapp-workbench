// B4 smoke: the must-read lane combines interest, worthiness, and recency.
import { assert } from './smoke-assert';
import { isPriorityArticle, partitionPriorityArticles, priorityScore } from '../src/services/priority-inbox';
import type { Article } from '../src/types';

const now = new Date('2026-11-27T12:00:00Z').getTime();
function article(interest: number, worthy: number, ageDays: number): Article {
    return {
        id: 'a',
        published: now - ageDays * 86_400_000,
        scores: { interest, worthy },
    } as Article;
}

const strong = article(0.9, 0.9, 0);
const weak = article(0.1, 0.1, 20);
assert(priorityScore(strong, now) > priorityScore(weak, now), 'strong fresh rows outrank weak old rows');
assert(isPriorityArticle(strong, now), 'a strong fresh row enters the must-read lane');
assert(!isPriorityArticle(weak, now), 'a weak old row stays outside the lane');
assert(
    priorityScore(article(0.8, 0.8, 0), now) > priorityScore(article(0.8, 0.8, 10), now),
    'recency breaks similar scores',
);
const mixed = partitionPriorityArticles([strong, weak], now);
assert(mixed.keep.length === 1 && mixed.keep[0] === strong, 'the lane keeps only must-read rows');
assert(mixed.hidden.length === 1 && mixed.hidden[0] === weak, 'other rows are counted as hidden');

console.log('ok: priority inbox scoring');
