import './test-setup';
import { expect } from '@esm-bundle/chai';
import { FeedFoldersMenu } from '../src/web-components/feed-folders-menu/feed-folders-menu';
import { mountFeedFoldersMenu } from '../src/web-components/article-list/article-list-feed-folders';
import { cardRowTemplate } from '../src/web-components/article-list/article-list-render-rows';
import { libraryKey, queryClient } from '../src/query';
import type { Article, Folder, Feed } from '../src/types';

const folders: Folder[] = [
    { id: 'f1', title: 'World', createdAt: 1 },
    { id: 'f2', title: 'Tech', createdAt: 2 },
];
const feeds: Feed[] = [
    { id: 'feed1', title: 'Example', url: 'https://example.com', folderIds: ['f1'], unread: 0, addedAt: 1 },
];
const article: Article = {
    id: 'a1',
    feedId: 'feed1',
    guid: 'g1',
    title: 'Example article',
    published: 1,
    fetchedAt: 1,
    read: 0,
    starred: false,
    popularity: 0,
    hot: 0,
};

describe('feed-folders-menu', () => {
    let menu: FeedFoldersMenu | undefined;

    beforeEach(() => {
        queryClient.setQueryData(libraryKey, { folders, feeds, savedSearches: [] });
    });

    afterEach(() => {
        menu?.remove();
        menu = undefined;
    });

    it('lists folders with the feed membership checked', () => {
        menu = new FeedFoldersMenu();
        document.body.append(menu);
        menu.feedId = 'feed1';
        menu.open = true;
        const boxes = menu.shadowRoot?.querySelectorAll<HTMLInputElement>('.folder-option input') ?? [];
        expect(boxes.length).to.equal(2);
        expect([...boxes].map((b) => b.checked)).to.deep.equal([true, false]);
    });

    it('closes the same card and switches directly to another card', () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        menu = mountFeedFoldersMenu(host, shadow);
        const press = (articleId: string) =>
            host.dispatchEvent(new CustomEvent('card-menu-pointerdown', { detail: { articleId } }));
        const cancel = (articleId: string) =>
            host.dispatchEvent(new CustomEvent('card-menu-pointercancel', { detail: { articleId } }));
        const open = (articleId: string) =>
            host.dispatchEvent(
                new CustomEvent('open-feed-folders', {
                    detail: { feedId: 'feed1', anchor: { x: 10, y: 20 }, articleId },
                }),
            );
        press('a1');
        open('a1');
        expect(menu.open).to.equal(true);
        press('a1');
        menu.dispatchEvent(new CustomEvent('close'));
        open('a1');
        expect(menu.open).to.equal(false);

        open('a1');
        press('a2');
        menu.dispatchEvent(new CustomEvent('close'));
        cancel('a2');
        open('a1');
        expect(menu.open).to.equal(true);

        press('a2');
        menu.dispatchEvent(new CustomEvent('close'));
        open('a2');
        expect(menu.open).to.equal(true);

        menu.dispatchEvent(new CustomEvent('close'));
        open('a2');
        expect(menu.open).to.equal(true);

        press('a2');
        menu.dispatchEvent(new CustomEvent('close'));
        cancel('a2');
        open('a2');
        expect(menu.open).to.equal(true);
        host.remove();
    });

    it('keeps the same-card menu closed when pointerup precedes click', () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        menu = mountFeedFoldersMenu(host, shadow);
        shadow.append(
            cardRowTemplate(
                article,
                false,
                undefined,
                undefined,
                false,
                false,
                () => {},
                () => {},
            ),
        );
        const more = shadow.querySelector<HTMLButtonElement>('[aria-label="Manage feed folders"]')!;
        more.click();
        expect(menu.open).to.equal(true);
        more.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
        menu.dispatchEvent(new CustomEvent('close'));
        more.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true }));
        more.click();
        expect(menu.open).to.equal(false);
        host.remove();
    });

    it('shows an empty message without folders', () => {
        queryClient.setQueryData(libraryKey, { folders: [], feeds, savedSearches: [] });
        menu = new FeedFoldersMenu();
        document.body.append(menu);
        menu.feedId = 'feed1';
        menu.open = true;
        expect(menu.shadowRoot?.querySelector('.menu-empty')?.textContent).to.contain('No folders yet');
    });
});
