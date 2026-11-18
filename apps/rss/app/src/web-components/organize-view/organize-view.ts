import { fetchLibrary } from '../../query';
import { addFolder, deleteFolder } from '../../services/api';
import type { Feed, Folder } from '../../types';
import styles from './organize-view.css?inline';

export class OrganizeView extends HTMLElement {
    private folders: Folder[] = [];
    private feeds: Feed[] = [];
    private root: HTMLDivElement | null = null;

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
        }
        this.paint();
    }

    private feedsFor(folderId: string | null): Feed[] {
        if (folderId === null) return this.feeds.filter((f) => !f.folderIds.length);
        return this.feeds.filter((f) => f.folderIds.includes(folderId));
    }

    private async onCreateFolder() {
        const title = window.prompt('New folder name');
        if (!title?.trim()) return;
        await addFolder(title.trim());
        await this.load();
    }

    private async onDeleteFolder(id: string) {
        if (!window.confirm('Delete this folder?')) return;
        await deleteFolder(id);
        await this.load();
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
        addBtn.addEventListener('click', () => void this.onCreateFolder());
        toolbar.appendChild(h);
        toolbar.appendChild(addBtn);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        // Uncategorized
        const uncSection = this.renderFolderSection(null, 'Uncategorized', this.feedsFor(null));
        body.appendChild(uncSection);
        for (const f of this.folders) {
            body.appendChild(this.renderFolderSection(f.id, f.title, this.feedsFor(f.id), f));
        }
        this.root.appendChild(body);
    }

    private renderFolderSection(_folderId: string | null, title: string, feeds: Feed[], folder?: Folder): HTMLElement {
        const section = document.createElement('section');
        const head = document.createElement('div');
        head.className = 'folder-head';
        const h = document.createElement('h3');
        h.textContent = `${title} (${feeds.length})`;
        head.appendChild(h);
        if (folder) {
            const del = document.createElement('button');
            del.className = 'btn danger';
            del.textContent = 'Delete folder';
            del.addEventListener('click', () => void this.onDeleteFolder(folder.id));
            head.appendChild(del);
        }
        section.appendChild(head);
        const ul = document.createElement('ul');
        ul.className = 'feed-list';
        for (const feed of feeds) {
            const li = document.createElement('li');
            li.textContent = feed.title;
            ul.appendChild(li);
        }
        section.appendChild(ul);
        return section;
    }
}

customElements.define('organize-view', OrganizeView);
