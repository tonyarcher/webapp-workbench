import { assert } from './smoke-assert';
import {
    clearRecentSearches,
    loadRecentSearches,
    parseSearchQuery,
    saveRecentSearch,
    searchArticles,
} from '../src/services/search';
import type { Article, Feed } from '../src/types';

if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
    };
}

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

function article(id: string, feedId: string, title: string, summary = '', author = ''): Article {
    return {
        id,
        feedId,
        guid: id,
        title,
        summary,
        content: '',
        author,
        published: Number(id.replace(/\D/g, '')) || 1,
        fetchedAt: 1,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
    };
}

const articles: Article[] = [
    article('a1', 'f1', 'Grid storage batteries surge in March', 'lithium and grid', 'Ada'),
    article('a2', 'f2', 'Best battery for kitchen scale', 'cooking tips'),
    article('a3', 'f1', 'Solar panels and storage', 'renewable grid'),
];

{
    assert(
        parseSearchQuery('  Grid  STORAGE!! ').join(',') === 'grid,storage',
        'parseSearchQuery tokenizes and lowercases',
    );
    assert(parseSearchQuery('a i').length === 0, 'parseSearchQuery drops short tokens');

    const results = searchArticles('battery grid', { articles, feeds });
    assert(
        results.length === 1 && results[0]!.article.id === 'a1',
        'search matches all tokens and ranks best hit first',
    );

    const feedName = searchArticles('cooking', { articles, feeds });
    assert(feedName.length === 1 && feedName[0]!.article.id === 'a2', 'search matches feed names');

    const scoped = searchArticles('battery', { articles, feeds, folderFeedIds: ['f2'] });
    assert(scoped.length === 1 && scoped[0]!.article.id === 'a2', 'search respects folder scope');

    const empty = searchArticles('', { articles, feeds });
    assert(empty.length === 0, 'empty query returns no results');
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
