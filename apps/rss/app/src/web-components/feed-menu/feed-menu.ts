import styles from './feed-menu.css?inline';

export interface MenuAnchor {
    x: number;
    y: number;
}

export class FeedMenu extends HTMLElement {
    private feed: { id: string; title: string } | null = null;
    private open = false;
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
        this.root.replaceChildren();
        if (!this.open || !this.feed) {
            this.root.style.display = 'none';
            return;
        }
        this.root.style.display = '';
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
