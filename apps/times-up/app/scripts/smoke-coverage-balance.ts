// N4 smoke: local outlet-breadth meter and broadening suggestions.
import { assert } from './smoke-assert';
import { coverageBalance } from '../src/services/coverage-balance';
import type { Article, Feed } from '../src/types';

function feed(id: string, domain: string, unread = 0): Feed {
    return { id, title: id, url: `https://${domain}/feed`, folderIds: [], unread, addedAt: 0 };
}

function article(id: string, feedId: string, domain: string, topic = 'Energy'): Article {
    return { id, feedId, link: `https://${domain}/${id}`, scores: { topic } } as Article;
}

const feeds = [feed('a', 'feeds.a.com', 1), feed('b', 'b.com', 5), feed('c', 'c.com', 3)];
const oneOutlet = coverageBalance([article('1', 'a', 'a.com'), article('2', 'a', 'a.com')], feeds);
assert(oneOutlet?.outlets === 1 && oneOutlet.label === 'One outlet', 'one outlet is called out');
assert(
    oneOutlet?.suggestions.map((s) => s.feedId).join(',') === 'b,c',
    'suggestions exclude the current outlet and favor unread feeds',
);

const broad = coverageBalance(
    [article('1', 'a', 'a.com'), article('2', 'b', 'b.com'), article('3', 'c', 'c.com'), article('4', 'a', 'a.com')],
    feeds,
);
assert(broad?.outlets === 3 && broad.label === 'Broad coverage', 'three balanced outlets need no nudge');
assert(broad?.suggestions.length === 0, 'broad coverage offers no broadening suggestions');

const skewed = coverageBalance(
    [article('1', 'a', 'a.com'), article('2', 'a', 'a.com'), article('3', 'a', 'a.com'), article('4', 'b', 'b.com')],
    feeds,
);
assert(skewed?.label === 'Mostly one outlet', 'a dominant outlet is called out even with two outlets');
assert(coverageBalance([article('1', 'a', 'a.com', '')], feeds) === null, 'rows without a topic do not invent a meter');

console.log('ok: local coverage-balance meter');
