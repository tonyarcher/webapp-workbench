import './test-setup';
import { expect } from '@esm-bundle/chai';
import { buildTodaySections } from '../src/services/today';
import type { Article, Feed, Folder } from '../src/types';

const folderA: Folder = { id: 'fa', title: 'World', createdAt: 1 };
const folderB: Folder = { id: 'fb', title: 'Tech', createdAt: 2 };
const feedA: Feed = {
    id: 'feeda',
    title: 'Reuters',
    url: 'https://example.com/a',
    folderIds: ['fa'],
    unread: 0,
    addedAt: 1,
};
const feedB: Feed = {
    id: 'feedb',
    title: 'The Verge',
    url: 'https://example.com/b',
    folderIds: ['fb'],
    unread: 0,
    addedAt: 1,
};

function article(id: string, feedId: string, hot: number, published: number): Article {
    return {
        id,
        feedId,
        guid: id,
        title: `Story ${id}`,
        read: 0,
        starred: false,
        popularity: 0,
        hot,
        published,
        fetchedAt: published,
    };
}

describe('today sections', () => {
    it('groups by folder in sidebar order with a per-folder cap', () => {
        const articles = [
            article('a1', 'feeda', 5, 3),
            article('a2', 'feeda', 9, 2),
            article('a3', 'feeda', 1, 1),
            article('b1', 'feedb', 4, 2),
        ];
        const sections = buildTodaySections(articles, [feedA, feedB], [folderA, folderB], [], 2);

        expect(sections.map((s) => s.folder.title)).to.deep.equal(['World', 'Tech']);
        expect(sections[0]!.articles.map((a) => a.id)).to.deep.equal(['a2', 'a1']);
        expect(sections[1]!.articles.map((a) => a.id)).to.deep.equal(['b1']);
    });

    it('drops excluded folders and read articles when unread-only', () => {
        const articles = [
            article('a1', 'feeda', 5, 2),
            { ...article('a2', 'feeda', 9, 1), read: 1 as const },
            article('b1', 'feedb', 4, 1),
        ];
        const sections = buildTodaySections(articles, [feedA, feedB], [folderA, folderB], ['fb'], 5, true);

        expect(sections.length).to.equal(1);
        expect(sections[0]!.articles.map((a) => a.id)).to.deep.equal(['a1']);
    });

    it('omits folders with no articles', () => {
        const sections = buildTodaySections([article('b1', 'feedb', 4, 1)], [feedA, feedB], [folderA, folderB], [], 5);

        expect(sections.map((s) => s.folder.title)).to.deep.equal(['Tech']);
    });
});
