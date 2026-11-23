import './test-setup';
import { expect } from '@esm-bundle/chai';
import { rowArticlesFromEvent } from '../src/web-components/article-list/article-list-dwell';
import type { Article } from '../src/types';

function article(id: string): Article {
    return {
        id,
        feedId: 'f',
        guid: id,
        title: `Story ${id}`,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
        published: 1,
        fetchedAt: 1,
    };
}

const items = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'].map(article);

function rowEvent(row: HTMLElement): Event {
    const target = document.createElement('span');
    row.appendChild(target);
    return { target } as unknown as Event;
}

describe('dwell row attribution', () => {
    it('prefers data-row so a card row credits all of its articles', () => {
        const root = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'row cards';
        row.setAttribute('data-row', '1');
        row.setAttribute('data-index', '1');
        root.appendChild(row);

        const hit = rowArticlesFromEvent(rowEvent(row), items, 3, root);

        expect(hit.map((a) => a.id)).to.deep.equal(['a3', 'a4', 'a5']);
    });

    it('falls back to data-index for a list row', () => {
        const root = document.createElement('div');
        const row = document.createElement('div');
        row.className = 'row';
        row.setAttribute('data-index', '2');
        root.appendChild(row);

        const hit = rowArticlesFromEvent(rowEvent(row), items, 3, root);

        expect(hit.map((a) => a.id)).to.deep.equal(['a2']);
    });
});
