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

    it('puts Save for later on the card image and targets that article', () => {
        let savedId: string | undefined;
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
                null,
                false,
                (_e, saved) => {
                    savedId = saved.id;
                },
            ),
        );
        const save = host.querySelector<HTMLButtonElement>('.card-actions [aria-label="Save for later"]');
        expect(save).not.to.equal(null);
        save!.click();
        expect(savedId).to.equal('a1');
    });

    it('fills the saved bookmark and keeps it beside the far-right menu', () => {
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
                null,
                true,
                () => {},
            ),
        );
        const actions = host.querySelector<HTMLElement>('.card-actions')!;
        expect(
            [...actions.querySelectorAll('button')].map((button) => button.getAttribute('aria-label')),
        ).to.deep.equal(['Not interesting', 'Star', 'Save for later', 'Manage feed folders']);
        const save = actions.querySelector<HTMLButtonElement>('[aria-label="Save for later"]')!;
        expect(save.getAttribute('aria-pressed')).to.equal('true');
        expect(save.querySelector('path')?.getAttribute('fill')).to.equal('currentColor');
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
