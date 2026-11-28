// N4 coverage-balance meter. Outlet breadth is computed from the rows already
// loaded for a Today section; nothing is uploaded and no article text is read.

import { domainOf } from '../util';
import type { Article, Feed } from '../types';

export interface CoverageSuggestion {
    feedId: string;
    title: string;
}

export interface CoverageBalance {
    topic: string;
    outlets: number;
    label: string;
    suggestions: CoverageSuggestion[];
}

function dominantTopic(articles: Article[]): string | null {
    const counts = new Map<string, number>();
    for (const article of articles) {
        const topic = article.scores?.topic;
        if (!topic) continue;
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function outletOf(article: Article, feed: Feed | undefined): string {
    return domainOf(article.link) || domainOf(feed?.url) || feed?.title || 'unknown';
}

/** A gentle, local nudge when one section is too dependent on one outlet. */
export function coverageBalance(articles: Article[], feeds: Feed[]): CoverageBalance | null {
    const topic = dominantTopic(articles);
    if (!topic) return null;
    const byId = new Map(feeds.map((feed) => [feed.id, feed]));
    const presentFeeds = new Set(articles.map((article) => article.feedId));
    const counts = new Map<string, number>();
    for (const article of articles) {
        const outlet = outletOf(article, byId.get(article.feedId));
        counts.set(outlet, (counts.get(outlet) ?? 0) + 1);
    }
    const outlets = counts.size;
    const topShare = Math.max(...counts.values()) / articles.length;
    const narrow = outlets < 3 || topShare >= 0.75;
    const label =
        outlets === 1
            ? 'One outlet'
            : topShare >= 0.75
              ? 'Mostly one outlet'
              : outlets < 3
                ? 'Limited breadth'
                : 'Broad coverage';
    const suggestions = narrow
        ? feeds
              .filter((feed) => !presentFeeds.has(feed.id) && !counts.has(domainOf(feed.url) || feed.title))
              .sort((a, b) => (b.unread ?? 0) - (a.unread ?? 0))
              .slice(0, 2)
              .map((feed) => ({ feedId: feed.id, title: feed.title }))
        : [];
    return { topic, outlets, label, suggestions };
}
