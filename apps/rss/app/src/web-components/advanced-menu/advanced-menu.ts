import styles from './advanced-menu.css?inline';

export class AdvancedMenu extends HTMLElement {
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
        const close = document.createElement('button');
        close.className = 'action';
        close.textContent = 'Close';
        close.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        actions.appendChild(close);
        this.root.appendChild(actions);
    }
}

customElements.define('advanced-menu', AdvancedMenu);
