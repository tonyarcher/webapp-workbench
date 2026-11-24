import { libraryKey, queryClient, type LibraryData } from '../../query';
import { setFeedFolderMembership } from '../../mutations';
import { syncMenuPopover, type MenuAnchor } from '../menu-popover';
import styles from './feed-folders-menu.css?inline';

/**
 * "..." menu for one article's feed. Ticking folders moves that feed (not the
 * article): every article from it appears in the chosen folders. Writes go
 * through the shared membership mutation, which invalidates the library cache
 * so both views repaint from the same source.
 */
export class FeedFoldersMenu extends HTMLElement {
    private _open = false;
    private _anchor: MenuAnchor | null = null;
    private _feedId = '';
    private root: HTMLDivElement | null = null;

    get open(): boolean {
        return this._open;
    }
    set open(value: boolean) {
        this._open = value;
        this.paint();
    }

    get anchor(): MenuAnchor | null {
        return this._anchor;
    }
    set anchor(value: MenuAnchor | null) {
        this._anchor = value;
        this.paint();
    }

    get feedId(): string {
        return this._feedId;
    }
    set feedId(value: string) {
        if (this._feedId === value) return;
        this._feedId = value;
        this.paint();
    }

    connectedCallback(): void {
        if (this.root) return;
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'menu';
        shadow.appendChild(this.root);
        this.paint();
    }

    private library(): LibraryData | undefined {
        return queryClient.getQueryData<LibraryData>(libraryKey);
    }

    private async toggle(folderId: string, checked: boolean): Promise<void> {
        const lib = this.library();
        const feed = lib?.feeds.find((f) => f.id === this._feedId);
        if (!feed) return;
        const next = checked
            ? [...new Set([...feed.folderIds, folderId])]
            : feed.folderIds.filter((id) => id !== folderId);
        this.paint();
        try {
            await setFeedFolderMembership(this._feedId, next);
        } finally {
            this.open = false;
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        }
    }

    private paint(): void {
        if (!this.root) return;
        const root = this.root;
        root.replaceChildren();
        const open = this._open && !!this._feedId;
        if (!open) {
            syncMenuPopover(root, false, null, () => this.dispatchEvent(new CustomEvent('close')));
            return;
        }
        const lib = this.library();
        const feed = lib?.feeds.find((f) => f.id === this._feedId);
        const folders = lib?.folders ?? [];
        const title = document.createElement('div');
        title.className = 'menu-title';
        title.textContent = feed?.title ?? 'Feed folders';
        root.appendChild(title);
        if (!feed || !folders.length) {
            const empty = document.createElement('div');
            empty.className = 'menu-empty';
            empty.textContent = 'No folders yet. Create one in the sidebar.';
            root.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.className = 'folder-list';
            for (const folder of folders) {
                const label = document.createElement('label');
                label.className = 'folder-option';
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.checked = feed.folderIds.includes(folder.id);
                box.addEventListener('change', () => void this.toggle(folder.id, box.checked));
                label.appendChild(box);
                label.appendChild(document.createTextNode(folder.title));
                list.appendChild(label);
            }
            root.appendChild(list);
        }
        syncMenuPopover(root, true, this._anchor, () => this.dispatchEvent(new CustomEvent('close')));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'feed-folders-menu': FeedFoldersMenu;
    }
}

customElements.define('feed-folders-menu', FeedFoldersMenu);
