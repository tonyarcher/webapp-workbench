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
    summary:
        'A calm, readable summary that gives the story room to breathe. It keeps going for several sentences so the collapsed state has something meaningful to hide behind the chevron handle, and the reader can switch between the compact and full versions without losing their place.',
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
            const read = { ...article, id: 'read-1', guid: 'read-1', title: 'Already read', read: 1 as const };
            const short = {
                ...article,
                id: 'short-1',
                guid: 'short-1',
                title: 'A very short story',
                summary: 'Short. Read More',
            };
            if (url.includes('/articles?')) return json({ items: [article, read, short], nextCursor: null });
            if (url.includes('/excerpt')) return json({ excerpt: '' });
            return json({});
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        localStorage.removeItem('times-up.auth.tokens');
        localStorage.removeItem('times-up:today-settings');
        localStorage.removeItem('times-up:today-medium-migrated');
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
            expect(root.querySelector('.unread-toggle')).to.equal(null);
            expect(root.querySelectorAll('.medium-row').length).to.equal(2);
            expect(root.textContent).to.not.contain('Already read');
            expect(root.textContent).to.not.contain('Read More');
            await waitFor(() => !(root.querySelector<HTMLButtonElement>('.expand-handle')?.disabled ?? true));
            const row = root.querySelector('.medium-row')!;
            const handles = [...root.querySelectorAll<HTMLButtonElement>('.expand-handle')];
            expect(handles.length).to.equal(2);
            expect(handles[1]?.disabled).to.equal(true);
            const handle = handles[0]!;
            expect(handle.getAttribute('aria-label')).to.equal('Show more');
            expect(handle.getAttribute('aria-expanded')).to.equal('false');
            expect(handle.dataset['direction']).to.equal('down');
            expect(handle.querySelector('path')?.getAttribute('d')).to.equal('M4 6.5 8 10.5 12 6.5');
            handle.click();
            expect(row.classList.contains('expanded')).to.equal(true);
            expect(handle.getAttribute('aria-label')).to.equal('Show less');
            expect(handle.getAttribute('aria-expanded')).to.equal('true');
            expect(handle.dataset['direction']).to.equal('up');
            expect(handle.querySelector('path')?.getAttribute('d')).to.equal('M4 9.5 8 5.5 12 9.5');
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
