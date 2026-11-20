// The sidebar's reading order, in a real DOM. The settings panels used to be
// rows above the feed tree, so "Interesting" and the first feeds sat nineteen
// rows down. This pins the order a reader actually walks: Interesting, feeds,
// then the views, then one Settings row.
import './test-setup';
import { expect } from '@esm-bundle/chai';
import { renderNav, type SourceListRenderHost } from '../src/web-components/source-list/source-list-render';
import type { Feed, Folder } from '../src/types';

const folder: Folder = { id: 'f1', title: 'Tech', createdAt: 1 };
const feed: Feed = {
    id: 'fd1',
    title: 'Ars Technica',
    url: 'https://example.test/rss',
    folderIds: ['f1'],
    unread: 3,
    addedAt: 1,
};

/** Only the surface renderNav reads; the rest of the host is not exercised here. */
function host(overrides: Record<string, unknown> = {}): SourceListRenderHost {
    return {
        library: { error: undefined },
        libraryData: { savedSearches: [] },
        interestingShadow: {},
        interestingOrder: [],
        collapsed: {},
        totalUnread: 0,
        interestingCount: () => 0,
        isActive: () => false,
        select: () => {},
        onDragStart: () => {},
        folderUnread: () => 0,
        folderFeeds: () => [],
        toggleFolder: () => {},
        icon: () => document.createElement('span'),
        menuIcon: () => document.createElement('span'),
        ...overrides,
    } as unknown as SourceListRenderHost;
}

function render(hostArg: SourceListRenderHost): HTMLElement {
    const root = document.createElement('div');
    root.append(renderNav(hostArg, [folder], []));
    document.body.append(root);
    return root;
}

function rowLabels(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('.item .label')).map((node) => node.textContent ?? '');
}

describe('source-list nav order', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('puts Interesting and the feed tree above the views, with one Settings row last', () => {
        const root = render(
            host({
                interestingShadow: { f1: true },
                folderFeeds: () => [feed],
            }),
        );
        const text = root.textContent ?? '';
        const at = (needle: string) => text.indexOf(needle);
        expect(at('Interesting')).to.be.greaterThan(-1);
        expect(at('Interesting')).to.be.lessThan(at('Tech'));
        expect(at('Ars Technica')).to.be.lessThan(at('All'));
        expect(at('All')).to.be.lessThan(at('Today'));
        expect(at('Today')).to.be.lessThan(at('Front Page'));
        expect(rowLabels(root).at(-1)).to.equal('Settings');
    });

    it('keeps the settings panels out of the sidebar', () => {
        const root = render(
            host({
                interestingShadow: { f1: true },
                folderFeeds: () => [feed],
            }),
        );
        const text = root.textContent ?? '';
        for (const gone of ['Stats', 'Privacy', 'Glossary', 'Organize', 'Mute filters']) {
            expect(text).not.to.include(gone);
        }
    });

    it('honours the persisted Interesting collapse', () => {
        const root = render(
            host({
                interestingShadow: { f1: true },
                collapsed: { __interesting__: true },
                folderFeeds: () => [feed],
            }),
        );
        const toggle = root.querySelector<HTMLButtonElement>('.section-label-btn')!;
        expect(toggle.getAttribute('aria-expanded')).to.equal('false');
        expect(root.textContent).not.to.include('Interesting in Tech');
    });
});
