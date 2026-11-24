import styles from './command-palette.css?inline';

interface Command {
    id: string;
    title: string;
    group: string;
    hint: string;
    run: () => void;
}

export class CommandPalette extends HTMLElement {
    private _open = false;
    private _commands: Command[] = [];
    private _query = '';
    private _activeIndex = 0;
    private pointerDownInside = false;
    private updateResolvers: Array<(value: boolean) => void> = [];
    private root: HTMLDivElement | null = null;

    get open() {
        return this._open;
    }
    set open(v: boolean) {
        this._open = v;
        this.paint();
        this.resolveUpdate();
    }

    get commands() {
        return this._commands;
    }
    set commands(v: Command[]) {
        this._commands = v;
        this.paint();
        this.resolveUpdate();
    }

    get updateComplete(): Promise<boolean> {
        return new Promise((resolve) => {
            this.updateResolvers.push(resolve);
            setTimeout(() => {
                const idx = this.updateResolvers.indexOf(resolve);
                if (idx >= 0) {
                    this.updateResolvers.splice(idx, 1);
                    resolve(true);
                }
            }, 0);
        });
    }

    private resolveUpdate() {
        const resolvers = this.updateResolvers.splice(0);
        for (const r of resolvers) r(true);
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        shadow.appendChild(this.root);
        this.paint();
    }

    private filtered(): Command[] {
        const q = this._query.trim().toLowerCase();
        if (!q) return this._commands;
        return this._commands.filter((c) => c.title.toLowerCase().includes(q));
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        if (!this._open) {
            this.root.style.display = 'none';
            this.resolveUpdate();
            return;
        }
        this.root.style.display = '';
        const dialog = document.createElement('dialog');
        dialog.setAttribute('aria-label', 'Command palette');
        dialog.open = true;
        dialog.setAttribute('open', '');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search commands';
        input.setAttribute('aria-label', 'Search command query');
        input.addEventListener('input', (e) => {
            this._query = (e.target as HTMLInputElement).value;
            this._activeIndex = 0;
            this.paint();
        });
        input.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent));
        dialog.appendChild(input);
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'listbox');
        ul.setAttribute('aria-label', 'Commands');
        ul.tabIndex = 0;
        const matches = this.filtered();
        matches.forEach((c, i) => {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.textContent = c.title;
            if (i === this._activeIndex) li.setAttribute('aria-selected', 'true');
            li.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('run', { bubbles: true, composed: true, detail: c }));
            });
            ul.appendChild(li);
        });
        dialog.appendChild(ul);
        dialog.addEventListener('pointerdown', (e) => {
            this.pointerDownInside = e.target !== dialog;
        });
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog && !this.pointerDownInside) {
                this._open = false;
                this.paint();
                this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
                this.resolveUpdate();
            }
            this.pointerDownInside = false;
        });
        this.root.appendChild(dialog);
        input.focus();
        this.resolveUpdate();
    }

    private onKey(e: KeyboardEvent) {
        const matches = this.filtered();
        if (e.key === 'Escape') {
            this._open = false;
            this.paint();
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
            this.resolveUpdate();
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowDown') {
            this._activeIndex = Math.min(this._activeIndex + 1, matches.length - 1);
            this.paint();
            this.resolveUpdate();
            e.preventDefault();
            return;
        }
        if (e.key === 'ArrowUp') {
            this._activeIndex = Math.max(this._activeIndex - 1, 0);
            this.paint();
            this.resolveUpdate();
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter') {
            const c = matches[this._activeIndex];
            if (c) {
                this.dispatchEvent(new CustomEvent('run', { bubbles: true, composed: true, detail: c }));
            }
            e.preventDefault();
        }
    }
}

customElements.define('command-palette', CommandPalette);
