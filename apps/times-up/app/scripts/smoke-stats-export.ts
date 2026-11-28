// O4 smoke: aggregate-only stats export and CSV escaping.
import { assert } from './smoke-assert';
import { statsCsv, statsJson, summarizeStats } from '../src/services/stats-export';
import type { Article } from '../src/types';

function article(id: string, read: 0 | 1, topic: string, words: number): Article {
    return {
        id,
        title: `Private title ${id}`,
        link: `https://example.com/${id}`,
        read,
        content: Array.from({ length: words }, () => 'word').join(' '),
        summary: '',
        scores: { topic },
    } as Article;
}

const summary = summarizeStats(
    [article('a', 1, 'World', 400), article('b', 1, 'World, "quoted"', 200), article('c', 0, 'Tech', 400)],
    3,
    new Date('2026-11-27T12:00:00Z'),
);
assert(summary.minutesRead === 3, 'minutes read sums only read articles');
assert(summary.articlesRead === 2 && summary.articlesTotal === 3, 'read and total counts are aggregate');
assert(summary.finishRate === 2 / 3, 'finish rate is read over total');
assert(summary.focusStreak === 3, 'focus streak is included');
assert(summary.topicMix[0]?.topic === 'World' && summary.topicMix[0]?.count === 1, 'topic mix counts read articles');

const json = statsJson(summary);
const csv = statsCsv(summary);
for (const forbidden of ['Private title', 'https://example.com', '"id"', 'articleId']) {
    assert(!json.includes(forbidden) && !csv.includes(forbidden), `export carries no ${forbidden}`);
}
assert(csv.includes('"topic:World, ""quoted""",1'), 'CSV escapes commas and quotes');
assert(summarizeStats([], 0).finishRate === 0, 'an empty library has a zero finish rate');

console.log('ok: aggregate-only stats export');
