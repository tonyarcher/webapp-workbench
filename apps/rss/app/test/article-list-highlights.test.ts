import './test-setup';
import { render } from 'lit';
import { expect } from '@esm-bundle/chai';
import { detailRowTemplate, headlineRowTemplate } from '../src/web-components/article-list/article-list-render';
import type { Article, RowHighlight } from '../src/types';

const longArticle: Article = {
    id: 'a1',
    feedId: 'f1',
    title: 'Long read',
    link: 'https://example.com/a1',
    guid: 'g1',
    author: 'A',
    summary: 'summary '.repeat(200),
    content: '<p>' + 'content '.repeat(1200) + '</p>',
    published: Date.now(),
    fetchedAt: Date.now(),
    read: 0,
    starred: false,
    popularity: 0,
    hot: 0,
};

const shortArticle: Article = { ...longArticle, id: 'a2', summary: 'short', content: '<p>short</p>' };

const highlight: RowHighlight = {
    available: true,
    interesting: 0.82,
    spam: 0.1,
    excerpts: [
        { index: 1, text: 'First key line.', score: 0.9 },
        { index: 3, text: 'Second key line.', score: 0.8 },
    ],
};

function mount(template: unknown): HTMLElement {
    const host = document.createElement('div');
    document.body.append(host);
    render(template as any, host);
    return host;
}

describe('article-list row highlights (N1)', () => {
    let host: HTMLElement | undefined;

    afterEach(() => {
        host?.remove();
        host = undefined;
    });

    it('shows a key-lines toggle for long articles when enabled', async () => {
        let toggled = 0;
        host = mount(
            detailRowTemplate(
                longArticle,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
                {
                    enabled: true,
                    open: false,
                    loading: false,
                    result: undefined,
                    onToggle: () => {
                        toggled++;
                    },
                },
            ),
        );
        const btn = host.querySelector<HTMLButtonElement>('.row-highlight-toggle');
        expect(btn).to.exist;
        expect(btn!.textContent).to.contain('Key lines');
        btn!.click();
        expect(toggled).to.equal(1);
    });

    it('does not show a toggle for short articles', async () => {
        host = mount(
            detailRowTemplate(
                shortArticle,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
                {
                    enabled: true,
                    open: false,
                    loading: false,
                    result: undefined,
                    onToggle: () => {},
                },
            ),
        );
        expect(host.querySelector('.row-highlight-toggle')).to.equal(null);
    });

    it('renders excerpts and why line when expanded', async () => {
        host = mount(
            detailRowTemplate(
                longArticle,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
                {
                    enabled: true,
                    open: true,
                    loading: false,
                    result: highlight,
                    onToggle: () => {},
                },
            ),
        );
        const block = host.querySelector('.row-highlights');
        expect(block).to.exist;
        const items = block!.querySelectorAll('li blockquote');
        expect(items.length).to.equal(2);
        expect(items[0]!.textContent).to.equal('First key line.');
        expect(items[1]!.textContent).to.equal('Second key line.');
        expect(block!.querySelector('.row-why')!.textContent).to.contain('Why:');
        expect(block!.querySelector('.row-why')!.textContent).to.contain('Jev interest 82%');
    });

    it('renders empty state when expanded with no excerpts', async () => {
        host = mount(
            detailRowTemplate(
                longArticle,
                false,
                undefined,
                undefined,
                () => {},
                () => {},
                {
                    enabled: true,
                    open: true,
                    loading: false,
                    result: { available: true, excerpts: [], interesting: null, spam: null },
                    onToggle: () => {},
                },
            ),
        );
        expect(host.querySelector('.row-highlights')!.textContent).to.contain('No key lines found');
    });

    it('headline rows can expand key lines', async () => {
        host = mount(
            headlineRowTemplate(
                longArticle,
                false,
                undefined,
                () => {},
                () => {},
                {
                    enabled: true,
                    open: true,
                    loading: false,
                    result: highlight,
                    onToggle: () => {},
                },
            ),
        );
        expect(host.querySelector('.row-highlight-toggle')).to.exist;
        expect(host.querySelector('.row-highlights')).to.exist;
        expect(host.querySelectorAll('li blockquote').length).to.equal(2);
    });
});
