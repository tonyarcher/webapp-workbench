import styles from './shortcuts-dialog.css?inline';

export class ShortcutsDialog extends HTMLElement {
    private open = false;
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'dialog';
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
        const h = document.createElement('h2');
        h.textContent = 'Keyboard shortcuts';
        this.root.appendChild(h);
        const close = document.createElement('button');
        close.textContent = 'Close';
        close.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        this.root.appendChild(close);
    }
}

customElements.define('shortcuts-dialog', ShortcutsDialog);
