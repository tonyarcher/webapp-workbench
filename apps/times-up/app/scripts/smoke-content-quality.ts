// B3 smoke: conservative unreadable-content markers and clean rows.
import { assert } from './smoke-assert';
import { contentQuality } from '../src/services/content-quality';
import type { Article } from '../src/types';

function article(content: string, summary = ''): Article {
    return { id: 'a', title: 'Example', content, summary } as Article;
}

assert(
    contentQuality(article('<p>Subscribe to continue reading.</p>'))?.kind === 'paywall',
    'subscribe walls are labeled',
);
assert(
    contentQuality(article('Become a member to unlock full access.'))?.kind === 'paywall',
    'member walls are labeled',
);
assert(contentQuality(article('Sign in to read the full article.'))?.kind === 'paywall', 'sign-in walls are labeled');
assert(contentQuality(article('<h1>404</h1><p>Page not found</p>'))?.kind === 'error', '404 pages are labeled');
assert(contentQuality(article('403 Forbidden'))?.kind === 'error', 'forbidden pages are labeled');
assert(
    contentQuality(article('This is the full article...')) === null,
    'a routine excerpt ellipsis is not a truncation badge',
);
assert(contentQuality(article('[truncated]'))?.kind === 'truncated', 'explicit truncation is labeled');
assert(
    contentQuality(article('Article truncated by the publisher.'))?.kind === 'truncated',
    'explicit article truncation is labeled',
);
assert(contentQuality(article('A normal article with enough text.')) === null, 'clean copy gets no badge');
assert(
    contentQuality(article('', 'The publisher reported a subscriber-only story.'))?.kind === 'paywall',
    'summary markers are used when body text is absent',
);

console.log('ok: unreadable-content quality labels');
