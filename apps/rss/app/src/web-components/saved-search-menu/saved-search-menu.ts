import styles from './saved-search-menu.css?inline';

export class SavedSearchMenu extends HTMLElement {
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
        if (!this.open) {
            this.root.style.display = 'none';
            return;
        }
        this.root.style.display = '';
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
