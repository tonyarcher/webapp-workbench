import { navigate } from '../../router';
import { syncMenuPopover, type MenuAnchor } from '../menu-popover';
import styles from './account-menu.css?inline';

export interface AccountMenuHost {
    username: string | null;
    openPalette(): void;
    onShowShortcuts(): void;
    onSignOut(): void;
}

/** Google-style account chip: identity and account actions in one top-right menu. */
export class AccountMenu extends HTMLElement {
    private _open = false;
    private _anchor: MenuAnchor | null = null;
    private _host: AccountMenuHost | null = null;
    private menuEl: HTMLDivElement | null = null;
    private root: HTMLDivElement | null = null;

    get host(): AccountMenuHost | null {
        return this._host;
    }
    set host(value: AccountMenuHost | null) {
        this._host = value;
        this.paint();
    }

    get open(): boolean {
        return this._open;
    }
    set open(value: boolean) {
        if (this._open === value) return;
        this._open = value;
        this.paint();
    }

    get anchor(): MenuAnchor | null {
        return this._anchor;
    }
    set anchor(value: MenuAnchor | null) {
        this._anchor = value;
        this.paint();
    }

    connectedCallback(): void {
        if (this.root) return;
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'account';
        shadow.appendChild(this.root);
        this.paint();
    }

    private close(): void {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }

    private action(label: string, glyph: string, run: () => void): HTMLElement {
        const button = document.createElement('button');
        button.className = 'action';
        button.type = 'button';
        button.append(document.createTextNode(`${glyph}  ${label}`));
        button.addEventListener('click', () => {
            this.close();
            run();
        });
        return button;
    }

    private paint(): void {
        if (!this.root) return;
        this.root.replaceChildren();
        const name = this._host?.username ?? '';
        const trigger = document.createElement('button');
        trigger.className = 'chip';
        trigger.type = 'button';
        trigger.setAttribute('aria-label', `Account${name ? `: ${name}` : ''}`);
        trigger.setAttribute('aria-expanded', String(this._open));
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.textContent = (name.trim()[0] ?? '?').toUpperCase();
        const label = document.createElement('span');
        label.className = 'name';
        label.textContent = name || 'Account';
        trigger.append(avatar, label);
        trigger.addEventListener('click', (e) => {
            this.dispatchEvent(
                new CustomEvent('open-account', {
                    detail: {
                        x: (e as MouseEvent).clientX,
                        y: (e as MouseEvent).clientY,
                    },
                    bubbles: true,
                    composed: true,
                }),
            );
        });
        this.root.appendChild(trigger);

        if (!this._open) {
            if (this.menuEl) syncMenuPopover(this.menuEl, false, null, () => this.close());
            return;
        }
        const menu = document.createElement('div');
        menu.className = 'menu';
        const head = document.createElement('div');
        head.className = 'menu-head';
        head.append(avatar.cloneNode(true), document.createTextNode(name || 'Account'));
        menu.appendChild(head);
        menu.appendChild(this.action('Settings', '⚙', () => navigate({ kind: 'settings', section: 'general' })));
        menu.appendChild(this.action('Commands', '⌘', () => this._host?.openPalette()));
        menu.appendChild(this.action('Keyboard shortcuts', '?', () => this._host?.onShowShortcuts()));
        const signOut = this.action('Sign out', '↪', () => this._host?.onSignOut());
        signOut.classList.add('danger');
        menu.appendChild(signOut);
        this.root.appendChild(menu);
        this.menuEl = menu;
        syncMenuPopover(menu, true, this._anchor, () => this.close());
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'account-menu': AccountMenu;
    }
}

customElements.define('account-menu', AccountMenu);
