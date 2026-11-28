// O4 stats export. Aggregate-only output: no article titles, URLs, ids, or
// reading timestamps leave the browser in the downloadable report.

import { readMinutes } from '../util';
import type { Article } from '../types';

export interface StatsSummary {
    exportedAt: string;
    minutesRead: number;
    finishRate: number;
    articlesRead: number;
    articlesTotal: number;
    focusStreak: number;
    topicMix: Array<{ topic: string; count: number }>;
}

export function summarizeStats(articles: Article[], focusStreak: number, now = new Date()): StatsSummary {
    const read = articles.filter((article) => article.read === 1);
    const minutesRead = read.reduce((sum, article) => sum + readMinutes(article.content, article.summary), 0);
    const topics = new Map<string, number>();
    for (const article of read) {
        const topic = article.scores?.topic ?? 'untagged';
        topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
    return {
        exportedAt: now.toISOString(),
        minutesRead,
        finishRate: articles.length ? read.length / articles.length : 0,
        articlesRead: read.length,
        articlesTotal: articles.length,
        focusStreak,
        topicMix: [...topics.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count),
    };
}

export function statsJson(summary: StatsSummary): string {
    return JSON.stringify(summary, null, 2);
}

function csvCell(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function statsCsv(summary: StatsSummary): string {
    const rows: Array<[string, string]> = [
        ['exportedAt', summary.exportedAt],
        ['minutesRead', String(summary.minutesRead)],
        ['finishRate', String(summary.finishRate)],
        ['articlesRead', String(summary.articlesRead)],
        ['articlesTotal', String(summary.articlesTotal)],
        ['focusStreak', String(summary.focusStreak)],
        ...summary.topicMix.map(({ topic, count }): [string, string] => [`topic:${topic}`, String(count)]),
    ];
    return rows.map(([key, value]) => `${csvCell(key)},${csvCell(value)}`).join('\n');
}
