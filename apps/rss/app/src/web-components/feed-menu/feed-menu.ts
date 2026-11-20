import { syncMenuPopover } from '../menu-popover';
import styles from './feed-menu.css?inline';

export interface MenuAnchor {
    x: number;
    y: number;
}

export class FeedMenu extends HTMLElement {
    private feed: { id: string; title: string } | null = null;
    private open = false;
    private _anchor: MenuAnchor | null = null;

    get anchor() {
        return this._anchor;
    }
    set anchor(v: MenuAnchor | null) {
        this._anchor = v;
        this.paint();
    }
    private root: HTMLDivElement | null = null;

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
        const open = this.open && this.feed !== null;
        syncMenuPopover(this.root, open, this._anchor, () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        this.root.replaceChildren();
        if (!open) return;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const refresh = document.createElement('button');
        refresh.className = 'action';
        refresh.textContent = 'Refresh feed';
        refresh.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true })),
        );
        actions.appendChild(refresh);
        const del = document.createElement('button');
        del.className = 'action danger';
        del.textContent = 'Unfollow';
        del.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true })),
        );
        actions.appendChild(del);
        this.root.appendChild(actions);
    }
}

customElements.define('feed-menu', FeedMenu);
