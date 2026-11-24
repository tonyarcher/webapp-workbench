import { fetchLibrary } from '../../query';
import { requestAddFeed } from '../../services/add-feed-intent';
import { importOpmlFile, syncAllFeeds } from '../../mutations';
import { navigate } from '../../router';
import { deleteFolder, renameFolder, reorderFolders, setFeedFolderMembership } from '../../mutations';
import { addFolder } from '../../services/api';
import type { Feed, Folder } from '../../types';
import { anchorFromEvent, syncMenuPopover, type MenuAnchor } from '../menu-popover';
import { movedFolderOrder } from './organize-view-helpers';
import styles from './organize-view.css?inline';

export class OrganizeView extends HTMLElement {
    private folders: Folder[] = [];
    private feeds: Feed[] = [];
    private root: HTMLDivElement | null = null;
    private popoverEl: HTMLDivElement | null = null;
    private popoverFeedId: string | null = null;
    private popoverOpen = false;
    private popoverAnchor: MenuAnchor | null = null;
    private status = '';
    private statusError = false;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        this.popoverEl = document.createElement('div');
        this.popoverEl.className = 'folders-popover';
        shadow.append(this.root, this.popoverEl);
        void this.load();
    }

    private async load() {
        try {
            const lib = await fetchLibrary();
            this.folders = lib.folders;
            this.feeds = lib.feeds;
        } catch {
            this.folders = [];
            this.feeds = [];
            this.fail('Could not load folders.');
            return;
        }
        this.paint();
    }

    private feedsFor(folderId: string | null): Feed[] {
        if (folderId === null) return this.feeds.filter((f) => !f.folderIds.length);
        return this.feeds.filter((f) => f.folderIds.includes(folderId));
    }

    private announce(text: string, error = false): void {
        this.status = text;
        this.statusError = error;
        this.paint();
    }

    private fail(message: string): void {
        this.announce(message, true);
    }

    private async onCreateFolder() {
        const title = window.prompt('New folder name');
        if (!title?.trim()) return;
        try {
            await addFolder(title.trim());
            this.status = `Created ${title.trim()}.`;
            this.statusError = false;
            await this.load();
        } catch {
            this.fail('Could not create the folder.');
        }
    }

    private async onRenameFolder(folder: Folder) {
        const title = window.prompt('Rename folder', folder.title);
        if (!title?.trim() || title.trim() === folder.title) return;
        try {
            await renameFolder(folder.id, title.trim());
            this.status = `Renamed to ${title.trim()}.`;
            this.statusError = false;
            await this.load();
        } catch {
            this.fail('Could not rename the folder.');
        }
    }

    private async onDeleteFolder(id: string) {
        if (!window.confirm('Delete this folder? Feeds stay in Uncategorized.')) return;
        try {
            await deleteFolder(id);
            this.status = 'Folder deleted.';
            this.statusError = false;
            await this.load();
        } catch {
            this.fail('Could not delete the folder.');
        }
    }

    /** A feed can sit in any number of folders; no folders means Uncategorized. */
    private async onToggleMembership(feed: Feed, folderId: string, checked: boolean) {
        const next = new Set(feed.folderIds);
        if (checked) next.add(folderId);
        else next.delete(folderId);
        try {
            await setFeedFolderMembership(feed.id, [...next]);
            this.status = `${feed.title} folders saved.`;
            this.statusError = false;
            await this.load();
        } catch {
            this.fail(`Could not save ${feed.title} folders.`);
        }
    }

    private async onReorder(index: number, delta: -1 | 1) {
        const ids = this.folders.map((f) => f.id);
        const next = movedFolderOrder(ids, index, delta);
        if (next.join('\0') === ids.join('\0')) return;
        try {
            await reorderFolders(next);
            this.status = 'Folder order saved.';
            this.statusError = false;
            await this.load();
        } catch {
            this.fail('Could not save the folder order.');
        }
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Organize';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.textContent = 'New folder';
        addBtn.setAttribute('data-setting', 'new-folder');
        addBtn.addEventListener('click', () => void this.onCreateFolder());
        const feedBtn = document.createElement('button');
        feedBtn.className = 'btn primary';
        feedBtn.textContent = 'Add feed';
        feedBtn.setAttribute('aria-label', 'Add feed');
        feedBtn.addEventListener('click', requestAddFeed);
        toolbar.append(h, addBtn, feedBtn);
        this.root.appendChild(toolbar);
        if (this.status) {
            const status = document.createElement('p');
            status.className = this.statusError ? 'status error' : 'status';
            status.setAttribute('role', 'status');
            status.textContent = this.status;
            this.root.appendChild(status);
        }
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        body.setAttribute('data-setting', 'folders');
        body.appendChild(this.renderFolderSection('Uncategorized', this.feedsFor(null)));
        this.folders.forEach((folder, index) => {
            body.appendChild(this.renderFolderSection(folder.title, this.feedsFor(folder.id), folder, index));
        });
        body.appendChild(this.renderFeedManagement());
        this.root.appendChild(body);
        this.paintPopover();
    }

    private renderFeedManagement(): HTMLElement {
        const section = document.createElement('section');
        section.className = 'feed-management';
        const head = document.createElement('h3');
        head.textContent = 'Feed management';
        section.appendChild(head);
        const intro = document.createElement('p');
        intro.className = 'intro';
        intro.textContent = 'Import and export your subscriptions, then check which feeds are healthy.';
        section.appendChild(intro);
        const actions = document.createElement('div');
        actions.className = 'actions';
        const importBtn = document.createElement('button');
        importBtn.className = 'btn';
        importBtn.textContent = 'Import OPML';
        const file = document.createElement('input');
        file.type = 'file';
        file.accept = '.opml,.xml,text/xml';
        file.hidden = true;
        file.addEventListener('change', () => void this.importOpml(file));
        importBtn.addEventListener('click', () => file.click());
        const healthBtn = document.createElement('button');
        healthBtn.className = 'btn';
        healthBtn.textContent = 'Feed health';
        healthBtn.addEventListener('click', () => navigate({ kind: 'settings', section: 'feed-health' }));
        actions.append(importBtn, healthBtn, file);
        section.appendChild(actions);
        return section;
    }

    private async importOpml(input: HTMLInputElement): Promise<void> {
        const file = input.files?.[0];
        if (!file) return;
        try {
            await importOpmlFile(await file.text());
            this.status = 'Imported subscriptions. Syncing.';
            await syncAllFeeds();
            await this.load();
        } catch (err) {
            this.fail(err instanceof Error ? err.message : 'Import failed');
        }
        input.value = '';
    }

    private renderFolderSection(title: string, feeds: Feed[], folder?: Folder, index?: number): HTMLElement {
        const section = document.createElement('section');
        const head = document.createElement('div');
        head.className = 'folder-head';
        const h = document.createElement('h3');
        h.textContent = `${title} (${feeds.length})`;
        head.appendChild(h);
        if (folder && index !== undefined) {
            const actions = document.createElement('div');
            actions.className = 'folder-actions';
            actions.append(
                this.actionButton('Rename', `Rename ${folder.title}`, () => void this.onRenameFolder(folder)),
                this.actionButton(
                    'Move up',
                    `Move ${folder.title} up`,
                    () => void this.onReorder(index, -1),
                    index === 0,
                ),
                this.actionButton(
                    'Move down',
                    `Move ${folder.title} down`,
                    () => void this.onReorder(index, 1),
                    index === this.folders.length - 1,
                ),
                this.actionButton('Delete folder', `Delete ${folder.title}`, () => void this.onDeleteFolder(folder.id)),
            );
            head.appendChild(actions);
        }
        section.appendChild(head);
        const ul = document.createElement('ul');
        ul.className = 'feed-list';
        for (const feed of feeds) ul.appendChild(this.feedItem(feed));
        if (feeds.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = 'No feeds here yet.';
            ul.appendChild(empty);
        }
        section.appendChild(ul);
        return section;
    }

    private actionButton(label: string, ariaLabel: string, onClick: () => void, disabled = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = label === 'Delete folder' ? 'btn danger' : 'btn';
        button.textContent = label;
        button.setAttribute('aria-label', ariaLabel);
        button.disabled = disabled;
        button.addEventListener('click', onClick);
        return button;
    }

    private folderLabels(feed: Feed): string {
        if (feed.folderIds.length === 0) return 'Uncategorized';
        return feed.folderIds
            .map((id) => this.folders.find((f) => f.id === id)?.title)
            .filter((title): title is string => !!title)
            .join(', ');
    }

    private feedItem(feed: Feed): HTMLElement {
        const li = document.createElement('li');
        li.className = 'feed-item';
        const title = document.createElement('span');
        title.className = 'feed-title';
        title.textContent = feed.title;
        const folders = document.createElement('button');
        folders.className = 'btn folders-btn';
        folders.textContent = this.folderLabels(feed);
        folders.setAttribute('aria-label', `Folders for ${feed.title}`);
        folders.addEventListener('click', (event) => {
            event.stopPropagation();
            this.popoverFeedId = feed.id;
            this.popoverAnchor = anchorFromEvent(event);
            this.popoverOpen = true;
            this.paintPopover();
        });
        li.append(title, folders);
        return li;
    }

    private paintPopover(): void {
        if (!this.popoverEl) return;
        const feed = this.feeds.find((f) => f.id === this.popoverFeedId);
        const open = this.popoverOpen && feed !== undefined;
        this.popoverEl.replaceChildren();
        if (open && feed) {
            const heading = document.createElement('h3');
            heading.textContent = feed.title;
            this.popoverEl.appendChild(heading);
            for (const folder of this.folders) {
                const label = document.createElement('label');
                label.className = 'folder-choice';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = feed.folderIds.includes(folder.id);
                input.addEventListener('change', () => void this.onToggleMembership(feed, folder.id, input.checked));
                label.append(input, document.createTextNode(folder.title));
                this.popoverEl.appendChild(label);
            }
            const hint = document.createElement('p');
            hint.className = 'folders-hint';
            hint.textContent = 'None selected means Uncategorized.';
            this.popoverEl.appendChild(hint);
        }
        // Measure after the rows exist, so a tall list is clamped correctly.
        syncMenuPopover(this.popoverEl, open, this.popoverAnchor, () => {
            this.popoverOpen = false;
            this.popoverFeedId = null;
            this.paintPopover();
        });
    }
}

customElements.define('organize-view', OrganizeView);
