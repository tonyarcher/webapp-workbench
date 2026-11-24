import './test-setup';
import { expect } from '@esm-bundle/chai';
import { cardRowTemplate, detailRowTemplate } from '../src/web-components/article-list/article-list-render';
import type { Article } from '../src/types';

const article: Article = {
    id: 'a1',
    feedId: 'f1',
    title: 'A story',
    link: 'https://example.com/a1',
    guid: 'g1',
    summary: 'short summary',
    published: Date.now(),
    fetchedAt: Date.now(),
    read: 0,
    starred: false,
    popularity: 0,
    hot: 0,
};

function mount(node: Node): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    host.appendChild(node);
    return host;
}

describe('article-list excerpts', () => {
    let host: HTMLElement | undefined;

    afterEach(() => {
        host?.remove();
        host = undefined;
    });

    it('marks a detail row so the visibility observer can find it', () => {
        host = mount(
            detailRowTemplate(
                article,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
            ),
        );
        const row = host.querySelector<HTMLElement>('[data-article-id]');
        expect(row?.dataset['articleId']).to.equal('a1');
        expect(host.querySelector('.row-excerpt')).to.equal(null);
    });

    it('shows an excerpt only after one has loaded', () => {
        host = mount(
            detailRowTemplate(
                article,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
                undefined,
                'more text',
            ),
        );
        expect(host.querySelector('.row-excerpt')?.textContent).to.equal('more text');
    });

    it('marks and fills card rows the same way', () => {
        host = mount(
            cardRowTemplate(
                article,
                false,
                undefined,
                undefined,
                false,
                false,
                () => {},
                () => {},
                'card text',
            ),
        );
        expect(host.querySelector<HTMLElement>('[data-article-id]')?.dataset['articleId']).to.equal('a1');
        expect(host.querySelector('.row-excerpt')?.textContent).to.equal('card text');
    });
});
