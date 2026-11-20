import { syncMenuPopover, type MenuAnchor } from '../source-list/menu-popover';
import styles from './saved-search-menu.css?inline';

export class SavedSearchMenu extends HTMLElement {
    private open = false;
    private _anchor: MenuAnchor | null = null;
    private root: HTMLDivElement | null = null;

    get anchor() {
        return this._anchor;
    }
    set anchor(v: MenuAnchor | null) {
        this._anchor = v;
        this.paint();
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'menu';
        shadow.appendChild(this.root);
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        const open = this.open;
        syncMenuPopover(this.root, open, this._anchor, () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        this.root.replaceChildren();
        if (!open) return;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const rename = document.createElement('button');
        rename.className = 'action';
        rename.textContent = 'Rename';
        rename.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('rename', { bubbles: true, composed: true })),
        );
        actions.appendChild(rename);
        const del = document.createElement('button');
        del.className = 'action danger';
        del.textContent = 'Delete';
        del.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true })),
        );
        actions.appendChild(del);
        this.root.appendChild(actions);
    }
}

customElements.define('saved-search-menu', SavedSearchMenu);
