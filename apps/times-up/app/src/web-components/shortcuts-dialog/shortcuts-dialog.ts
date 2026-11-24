import { LIST_SHORTCUTS_HELP, OVERLAY_SHORTCUTS_HELP, type ShortcutHelp } from '../../services/shortcuts';
import styles from './shortcuts-dialog.css?inline';

/** Short views guide plus the shortcut tables shared with handlers and tests. */
const VIEWS: ShortcutHelp[] = [
    { keys: 'All', action: 'The full article list, with sort and view controls.' },
    { keys: 'Today', action: 'One capped section per folder for today’s articles.' },
    { keys: 'Alerts', action: 'Unread hits for saved searches you flagged as alerts.' },
    { keys: 'Feed health', action: 'Status, recent volume and removal for your feeds.' },
    { keys: 'Search', action: 'Full article list filtered by words, with a headline-only scope.' },
    { keys: 'Organize', action: 'Folders, feeds, import and three export formats.' },
];

export class ShortcutsDialog extends HTMLElement {
    private _open = false;
    private root: HTMLDivElement | null = null;

    get open(): boolean {
        return this._open;
    }
    set open(value: boolean) {
        if (this._open === value) return;
        this._open = value;
        if (value) this.setAttribute('open', '');
        else this.removeAttribute('open');
        if (this.isConnected) this.paint();
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.key !== 'Escape' || !this._open) return;
        e.stopPropagation();
        this.close();
    };

    private onClick = (e: MouseEvent): void => {
        if (!this._open) return;
        const path = e.composedPath();
        const panel = this.shadowRoot?.querySelector('.dialog');
        if (panel && path.includes(panel)) return;
        this.close();
    };

    private close(): void {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }

    connectedCallback(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'dialog';
        shadow.appendChild(this.root);
        document.addEventListener('keydown', this.onKeyDown, true);
        this.addEventListener('click', this.onClick);
        this.paint();
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.onKeyDown, true);
        this.removeEventListener('click', this.onClick);
    }

    private rows(title: string, items: ShortcutHelp[]): HTMLElement {
        const section = document.createElement('section');
        section.className = 'section';
        const h = document.createElement('h3');
        h.textContent = title;
        section.appendChild(h);
        for (const item of items) {
            const row = document.createElement('div');
            row.className = 'row';
            const key = document.createElement('kbd');
            key.textContent = item.keys;
            const action = document.createElement('span');
            action.textContent = item.action;
            row.append(key, action);
            section.appendChild(row);
        }
        return section;
    }

    private paint(): void {
        if (!this.root) return;
        this.root.replaceChildren();
        if (!this._open) {
            this.root.style.display = 'none';
            return;
        }
        this.root.style.display = '';
        const h = document.createElement('h2');
        h.textContent = 'Help & shortcuts';
        this.root.appendChild(h);
        this.root.appendChild(this.rows('Views', VIEWS));
        this.root.appendChild(this.rows('Article list', LIST_SHORTCUTS_HELP));
        this.root.appendChild(this.rows('Open article', OVERLAY_SHORTCUTS_HELP));
        const foot = document.createElement('div');
        foot.className = 'foot';
        const close = document.createElement('button');
        close.className = 'btn primary';
        close.textContent = 'Close';
        close.addEventListener('click', () => this.close());
        foot.appendChild(close);
        this.root.appendChild(foot);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'shortcuts-dialog': ShortcutsDialog;
    }
}

customElements.define('shortcuts-dialog', ShortcutsDialog);
