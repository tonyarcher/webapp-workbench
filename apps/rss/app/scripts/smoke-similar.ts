import { similarArticles } from '../src/services/similar';
import type { Article, Feed } from '../src/types';
import { assert } from './smoke-assert';

const feed = (id: string, title: string): Feed => ({
    id,
    title,
    url: `https://${id}.example/feed`,
    folderIds: [],
    unread: 0,
    addedAt: 0,
});
const article = (id: string, feedId: string, title: string, link?: string): Article => ({
    id,
    feedId,
    guid: id,
    title,
    link,
    summary: '',
    published: Number(id.slice(1)) || 0,
    fetchedAt: 0,
    read: 0,
    starred: false,
    popularity: 0,
    hot: 0,
});

const target = article('t0', 'f1', 'Battery grid storage', 'https://example.com/original');
const wordMatch = article('a1', 'f2', 'Battery grid storage rollout', 'https://other.example/story');
const sameFeed = article('a2', 'f1', 'Unrelated hardware note', 'https://example.com/hardware');
const syndicated = article('a3', 'f3', 'Wire story', 'https://www.example.com/original?utm_source=wire');
const syndicatedCopy = article('a4', 'f4', 'Another wire', 'https://example.com/original');
const noise = article('a5', 'f5', 'Gardening advice', 'https://garden.example/news');
const corpus = [target, wordMatch, sameFeed, syndicated, syndicatedCopy, noise];
const feeds = [
    feed('f1', 'Energy'),
    feed('f2', 'Policy'),
    feed('f3', 'Wire'),
    feed('f4', 'Mirror'),
    feed('f5', 'Home'),
];

const results = similarArticles(target, corpus, feeds, { battery: 8, grid: 6 });
assert(results[0]?.article.id === 'a1', 'word overlap ranks related stories first');
assert(
    results.some(
        (result) => result.article.id === 'a2' && result.reasons.some((reason) => reason.includes('Also in Energy')),
    ),
    'shared-feed stories carry a reason',
);
assert(
    results.some(
        (result) =>
            result.article.id === 'a3' && result.reasons.some((reason) => reason.includes('Carried by 3 feeds')),
    ),
    'syndicated stories carry a cluster reason',
);
assert(!results.some((result) => result.article.id === 'a5'), 'unrelated stories are excluded');
assert(!results.some((result) => result.article.id === 't0'), 'the target never appears in its own results');

console.log('smoke-similar: ok');
