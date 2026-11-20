import { syncMenuPopover, type MenuAnchor } from '../menu-popover';
import styles from './today-menu.css?inline';

export class TodayMenu extends HTMLElement {
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
        this.root.replaceChildren();
        if (!open) return;
        const actions = document.createElement('div');
        actions.className = 'actions';
        const close = document.createElement('button');
        close.className = 'action';
        close.textContent = 'Close';
        close.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        actions.appendChild(close);
        this.root.appendChild(actions);
        syncMenuPopover(this.root, open, this._anchor, () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
    }
}

customElements.define('today-menu', TodayMenu);
