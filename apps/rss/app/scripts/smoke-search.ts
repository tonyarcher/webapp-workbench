import { assert } from './smoke-assert';
import {
    clearRecentSearches,
    loadRecentSearches,
    parseSearchInput,
    parseSearchQuery,
    saveRecentSearch,
    searchArticles,
} from '../src/services/search';
import type { Article, Feed, Folder } from '../src/types';

if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
    };
}

const folders: Folder[] = [
    { id: 'fold1', title: 'Energy', createdAt: 0 },
    { id: 'fold2', title: 'Food', createdAt: 0 },
];

const feeds: Feed[] = [
    {
        id: 'f1',
        title: 'Grid News',
        url: 'https://grid.example/rss',
        folderIds: ['fold1'],
        unread: 0,
        addedAt: 0,
    },
    { id: 'f2', title: 'Cooking', url: 'https://cook.example/rss', folderIds: ['fold2'], unread: 0, addedAt: 0 },
];

function article(
    id: string,
    feedId: string,
    title: string,
    opts: Partial<Article> & { summary?: string; author?: string } = {},
): Article {
    return {
        id,
        feedId,
        guid: id,
        title,
        summary: opts.summary ?? '',
        content: opts.content ?? '',
        author: opts.author ?? '',
        link: opts.link,
        published: opts.published ?? (Number(id.replace(/\D/g, '')) || 1),
        fetchedAt: 1,
        read: opts.read ?? 0,
        starred: opts.starred ?? false,
        popularity: 0,
        hot: 0,
    };
}

const jan10 = Date.parse('2026-01-10T12:00:00Z');
const mar10 = Date.parse('2026-03-10T12:00:00Z');
const longText = Array(800).fill('word').join(' '); // ~3-4 min

const articles: Article[] = [
    article('a1', 'f1', 'Grid storage batteries surge in March', {
        summary: 'lithium and grid',
        author: 'Ada',
        published: mar10,
        starred: true,
    }),
    article('a2', 'f2', 'Best battery for kitchen scale', { summary: 'cooking tips', published: jan10, read: 1 }),
    article('a3', 'f1', 'Solar panels and storage', { summary: 'renewable grid', published: jan10 }),
    article('a4', 'f1', 'Watch this grid explainer', {
        summary: 'video',
        link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        published: mar10,
        content: longText,
    }),
];

{
    assert(
        parseSearchQuery('  Grid  STORAGE!! ').join(',') === 'grid,storage',
        'parseSearchQuery tokenizes and lowercases',
    );
    assert(parseSearchQuery('a i').length === 0, 'parseSearchQuery drops short tokens');
    assert(parseSearchQuery('author:ada battery').join(',') === 'battery', 'parseSearchQuery excludes operators');

    const parsed = parseSearchInput('author:Ada feed:"Grid News" is:starred after:2026-03-01 battery');
    assert(parsed.operators.authors[0] === 'Ada', 'parseSearchInput captures author');
    assert(parsed.operators.feeds[0] === 'Grid News', 'parseSearchInput captures quoted feed');
    assert(parsed.operators.isStarred === true, 'parseSearchInput captures is:starred');
    assert(parsed.operators.after !== undefined, 'parseSearchInput captures after date');
    assert(parsed.tokens.join(',') === 'battery', 'parseSearchInput keeps text tokens');

    const results = searchArticles('battery grid', { articles, feeds, folders });
    assert(
        results.length === 1 && results[0]!.article.id === 'a1',
        'search matches all tokens and ranks best hit first',
    );

    const feedName = searchArticles('cooking', { articles, feeds, folders });
    assert(feedName.length === 1 && feedName[0]!.article.id === 'a2', 'search matches feed names');

    const scoped = searchArticles('battery', { articles, feeds, folders, folderFeedIds: ['f2'] });
    assert(scoped.length === 1 && scoped[0]!.article.id === 'a2', 'search respects folder scope');

    assert(searchArticles('', { articles, feeds, folders }).length === 0, 'empty query returns no results');

    // operator filters
    assert(searchArticles('author:ada', { articles, feeds, folders }).length === 1, 'author operator filters');
    assert(
        searchArticles('author:ada', { articles, feeds, folders })[0]!.article.id === 'a1',
        'author operator matches author',
    );
    assert(searchArticles('is:starred', { articles, feeds, folders })[0]!.article.id === 'a1', 'is:starred filters');
    assert(
        searchArticles('is:unread', { articles, feeds, folders }).every((r) => r.article.read === 0),
        'is:unread filters read articles',
    );
    assert(searchArticles('feed:cooking', { articles, feeds, folders }).length === 1, 'feed name operator filters');
    assert(searchArticles('folder:energy', { articles, feeds, folders }).length === 3, 'folder name operator filters');
    assert(
        searchArticles('after:2026-02-01', { articles, feeds, folders }).every(
            (r) => r.article.published >= Date.parse('2026-02-01T00:00:00Z'),
        ),
        'after date operator filters',
    );
    assert(
        searchArticles('before:2026-02-01', { articles, feeds, folders }).every(
            (r) => r.article.published <= Date.parse('2026-02-01T23:59:59.999Z'),
        ),
        'before date operator filters',
    );
    assert(searchArticles('has:video', { articles, feeds, folders })[0]!.article.id === 'a4', 'has:video filters');
    assert(
        searchArticles('min:readtime:2', { articles, feeds, folders }).some((r) => r.article.id === 'a4'),
        'min:readtime filters by estimated read time',
    );
}

{
    try {
        localStorage.removeItem('rss-reader:recent-searches');
    } catch {
        // ignore
    }
    clearRecentSearches();
    assert(loadRecentSearches().length === 0, 'recent searches start empty');
    saveRecentSearch('batteries');
    saveRecentSearch('grid');
    saveRecentSearch('batteries');
    const recent = loadRecentSearches();
    assert(
        recent[0] === 'batteries' && recent[1] === 'grid',
        'recent searches dedupe case-insensitively and keep newest first',
    );
    clearRecentSearches();
    assert(loadRecentSearches().length === 0, 'recent searches clear');
}

console.log('smoke-search: ok');
