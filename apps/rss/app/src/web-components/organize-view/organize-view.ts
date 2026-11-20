import { fetchLibrary } from '../../query';
import { deleteFolder, moveFeed, renameFolder, reorderFolders } from '../../mutations';
import { addFolder } from '../../services/api';
import type { Feed, Folder } from '../../types';
import { movedFolderOrder } from './organize-view-helpers';
import styles from './organize-view.css?inline';

export class OrganizeView extends HTMLElement {
    private folders: Folder[] = [];
    private feeds: Feed[] = [];
    private root: HTMLDivElement | null = null;
    private status = '';
    private statusError = false;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
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

    private folderTitle(id: string | null): string {
        return id === null ? 'Uncategorized' : (this.folders.find((f) => f.id === id)?.title ?? 'Uncategorized');
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

    private async onMoveFeed(feed: Feed, folderId: string | null) {
        try {
            await moveFeed(feed.id, folderId);
            this.status = `${feed.title} moved to ${this.folderTitle(folderId)}.`;
            this.statusError = false;
            await this.load();
        } catch {
            this.fail(`Could not move ${feed.title}.`);
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
        toolbar.append(h, addBtn);
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
        this.root.appendChild(body);
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

    private feedItem(feed: Feed): HTMLElement {
        const li = document.createElement('li');
        li.className = 'feed-item';
        const title = document.createElement('span');
        title.className = 'feed-title';
        title.textContent = feed.title;
        const move = document.createElement('select');
        move.setAttribute('aria-label', `Move ${feed.title} to folder`);
        const uncategorized = document.createElement('option');
        uncategorized.value = '';
        uncategorized.textContent = 'Uncategorized';
        move.appendChild(uncategorized);
        for (const folder of this.folders) {
            const option = document.createElement('option');
            option.value = folder.id;
            option.textContent = folder.title;
            move.appendChild(option);
        }
        move.value = feed.folderIds[0] ?? '';
        move.addEventListener('change', () => void this.onMoveFeed(feed, move.value === '' ? null : move.value));
        li.append(title, move);
        return li;
    }
}

customElements.define('organize-view', OrganizeView);
