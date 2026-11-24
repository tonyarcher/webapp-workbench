import './test-setup';
import { expect } from '@esm-bundle/chai';
import { FeedFoldersMenu } from '../src/web-components/feed-folders-menu/feed-folders-menu';
import { libraryKey, queryClient } from '../src/query';
import type { Folder, Feed } from '../src/types';

const folders: Folder[] = [
    { id: 'f1', title: 'World', createdAt: 1 },
    { id: 'f2', title: 'Tech', createdAt: 2 },
];
const feeds: Feed[] = [
    { id: 'feed1', title: 'Example', url: 'https://example.com', folderIds: ['f1'], unread: 0, addedAt: 1 },
];

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

    it('shows an empty message without folders', () => {
        queryClient.setQueryData(libraryKey, { folders: [], feeds, savedSearches: [] });
        menu = new FeedFoldersMenu();
        document.body.append(menu);
        menu.feedId = 'feed1';
        menu.open = true;
        expect(menu.shadowRoot?.querySelector('.menu-empty')?.textContent).to.contain('No folders yet');
    });
});
