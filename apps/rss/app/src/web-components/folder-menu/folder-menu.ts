import { syncMenuPopover } from '../source-list/menu-popover';
import styles from './folder-menu.css?inline';

export class FolderMenu extends HTMLElement {
    private _folder: { id: string; title: string } | null = null;
    private _open = false;
    private _anchor: { x: number; y: number } | null = null;
    private _unreadOnly = false;
    private _shadow = false;
    private root: HTMLDivElement | null = null;

    get folder() {
        return this._folder;
    }
    set folder(v) {
        this._folder = v;
        this.paint();
    }
    get open() {
        return this._open;
    }
    set open(v) {
        this._open = v;
        this.paint();
    }
    get anchor() {
        return this._anchor;
    }
    set anchor(v) {
        this._anchor = v;
        this.paint();
    }
    get unreadOnly() {
        return this._unreadOnly;
    }
    set unreadOnly(v) {
        this._unreadOnly = v;
        this.paint();
    }
    get shadow() {
        return this._shadow;
    }
    set shadow(v) {
        this._shadow = v;
        this.paint();
    }

    connectedCallback() {
        const sh = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        sh.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'menu';
        sh.appendChild(this.root);
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        const open = this._open && this._folder !== null;
        syncMenuPopover(this.root, open, this._anchor, () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        this.root.replaceChildren();
        if (!open) return;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const refresh = document.createElement('button');
        refresh.className = 'action';
        refresh.textContent = 'Refresh folder';
        refresh.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true })),
        );
        actions.appendChild(refresh);
        const toggleUnread = document.createElement('label');
        toggleUnread.className = 'action';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this._unreadOnly;
        cb.addEventListener('change', () =>
            this.dispatchEvent(
                new CustomEvent('unread-only-change', {
                    bubbles: true,
                    composed: true,
                    detail: { checked: cb.checked },
                }),
            ),
        );
        toggleUnread.appendChild(cb);
        toggleUnread.appendChild(document.createTextNode(' Hide read'));
        actions.appendChild(toggleUnread);
        const toggleShadow = document.createElement('label');
        toggleShadow.className = 'action';
        const cb2 = document.createElement('input');
        cb2.type = 'checkbox';
        cb2.checked = this._shadow;
        cb2.addEventListener('change', () =>
            this.dispatchEvent(
                new CustomEvent('shadow-change', { bubbles: true, composed: true, detail: { checked: cb2.checked } }),
            ),
        );
        toggleShadow.appendChild(cb2);
        toggleShadow.appendChild(document.createTextNode(' Interesting in folder'));
        actions.appendChild(toggleShadow);
        const del = document.createElement('button');
        del.className = 'action danger';
        del.textContent = 'Delete folder';
        del.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true })),
        );
        actions.appendChild(del);
        this.root.appendChild(actions);
    }
}

customElements.define('folder-menu', FolderMenu);
