import './test-setup';
import { expect } from '@esm-bundle/chai';
import '../src/web-components/today-view/today-view';
import type { Article, Feed, Folder } from '../src/types';

const folder: Folder = { id: 'f1', title: 'Tech', createdAt: 1 };
const feed: Feed = {
    id: 'feed1',
    title: 'Example Feed',
    url: 'https://example.com/rss',
    folderIds: ['f1'],
    unread: 1,
    addedAt: 1,
};
const article: Article = {
    id: 'a1',
    feedId: feed.id,
    guid: 'g1',
    title: 'A considered story',
    link: 'https://example.com/story',
    summary: 'A calm, readable summary that gives the story room to breathe.',
    content: '<p><img src="https://example.com/story.jpg" alt=""></p><p>Some article text.</p>',
    published: Date.now(),
    fetchedAt: Date.now(),
    read: 0,
    starred: false,
    popularity: 3,
    hot: 5,
};

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function waitFor(done: () => boolean): Promise<void> {
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
        if (done()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('timed out waiting for Today view');
}

describe('today reading view', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        localStorage.setItem(
            'times-up.auth.tokens',
            JSON.stringify({ access: 't', refresh: 'r', exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
        localStorage.setItem(
            'times-up:today-settings',
            JSON.stringify({ excludedFolderIds: [], perFolder: 5, unreadOnly: false, listView: 'medium' }),
        );
        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/library/folders')) return json({ folders: [folder], savedSearches: [] });
            if (url.includes('/library/feeds')) return json({ feeds: [feed] });
            if (url.includes('/library/counts')) return json({ counts: {} });
            if (url.includes('/articles?')) return json({ items: [article], nextCursor: null });
            if (url.includes('/excerpt')) return json({ excerpt: '' });
            return json({});
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        localStorage.removeItem('times-up.auth.tokens');
        localStorage.removeItem('times-up:today-settings');
    });

    it('renders sectioned medium rows with image, summary, and source controls', async () => {
        const view = document.createElement('today-view');
        document.body.appendChild(view);
        try {
            await waitFor(() => Boolean(view.shadowRoot?.querySelector('.medium-row')));
            const root = view.shadowRoot!;
            expect(root.querySelectorAll('.today-section').length).to.equal(1);
            expect(root.querySelector('.section-head')?.textContent).to.equal('Tech');
            expect(root.querySelector('.medium-title')?.textContent).to.equal(article.title);
            expect(root.querySelector('.medium-summary')?.textContent).to.equal(article.summary);
            expect(root.querySelector('.medium-img')).to.not.equal(null);
            expect(root.querySelector('.feed-label')?.textContent).to.equal(feed.title);
            expect(root.querySelector('.star')?.getAttribute('aria-label')).to.equal('Star');
            expect(root.querySelector<HTMLSelectElement>('.view-mode select')?.value).to.equal('medium');
        } finally {
            view.remove();
        }
    });

    it('keeps the other view modes available', async () => {
        const view = document.createElement('today-view');
        document.body.appendChild(view);
        try {
            await waitFor(() => Boolean(view.shadowRoot?.querySelector('.medium-row')));
            const select = view.shadowRoot!.querySelector<HTMLSelectElement>('.view-mode select')!;
            select.value = 'detailed';
            select.dispatchEvent(new Event('change'));
            await waitFor(() => Boolean(view.shadowRoot?.querySelector('.detail-body')));
            expect(view.shadowRoot!.querySelector('.medium-row')).to.equal(null);
        } finally {
            view.remove();
        }
    });
});
