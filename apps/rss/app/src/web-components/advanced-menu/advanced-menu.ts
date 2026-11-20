import type { MenuAnchor } from '../feed-menu/feed-menu';
import styles from './advanced-menu.css?inline';

const HOUR = 3_600_000;

const AGE_OPTIONS: { label: string; age: number | null }[] = [
    { label: 'Older than 1 hour', age: HOUR },
    { label: 'Older than 12 hours', age: 12 * HOUR },
    { label: 'Older than 1 day', age: 24 * HOUR },
    { label: 'Older than 3 days', age: 3 * 24 * HOUR },
    { label: 'Older than 7 days', age: 7 * 24 * HOUR },
    { label: 'Older than 30 days', age: 30 * 24 * HOUR },
    { label: 'All time', age: null },
];

export class AdvancedMenu extends HTMLElement {
    private _open = false;
    private _anchor: MenuAnchor | null = null;
    private _unreadOnly = false;
    private _markOnScroll = false;
    private _scopeLabel = '';
    private _marking = false;
    private menuEl: HTMLDivElement | null = null;

    get open(): boolean {
        return this._open;
    }
    set open(value: boolean) {
        if (this._open === value) return;
        this._open = value;
        this.syncPopover();
    }

    get anchor(): MenuAnchor | null {
        return this._anchor;
    }
    set anchor(value: MenuAnchor | null) {
        this._anchor = value;
        if (this._open) this.openPopover();
    }

    get unreadOnly(): boolean {
        return this._unreadOnly;
    }
    set unreadOnly(value: boolean) {
        if (this._unreadOnly === value) return;
        this._unreadOnly = value;
        if (this.isConnected) this.render();
    }

    get markOnScroll(): boolean {
        return this._markOnScroll;
    }
    set markOnScroll(value: boolean) {
        if (this._markOnScroll === value) return;
        this._markOnScroll = value;
        if (this.isConnected) this.render();
    }

    get scopeLabel(): string {
        return this._scopeLabel;
    }
    set scopeLabel(value: string) {
        if (this._scopeLabel === value) return;
        this._scopeLabel = value;
        if (this.isConnected) this.render();
    }

    get marking(): boolean {
        return this._marking;
    }
    set marking(value: boolean) {
        if (this._marking === value) return;
        this._marking = value;
        if (this.isConnected) this.render();
    }

    connectedCallback() {
        if (!this.shadowRoot) {
            const shadow = this.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            style.textContent = styles;
            shadow.appendChild(style);
            this.menuEl = document.createElement('div');
            this.menuEl.setAttribute('popover', '');
            shadow.appendChild(this.menuEl);
        }
        document.addEventListener('click', this.onDocClick);
        document.addEventListener('keydown', this.onKeyDown);
        this.render();
        this.syncPopover();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.onDocClick);
        document.removeEventListener('keydown', this.onKeyDown);
    }

    private onDocClick = (e: MouseEvent): void => {
        if (!this._open) return;
        const target = e.composedPath()[0] as Node | null;
        if (target && this.menuEl?.contains(target)) return;
        this.emitClose();
    };

    private onKeyDown = (e: KeyboardEvent): void => {
        if (this._open && e.key === 'Escape') this.emitClose();
    };

    private emitClose(): void {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }

    private syncPopover(): void {
        if (!this.menuEl) return;
        if (this._open) this.openPopover();
        else if (this.menuEl.matches(':popover-open'))
            (this.menuEl as HTMLElement & { hidePopover(): void }).hidePopover();
    }

    private openPopover(): void {
        if (!this.menuEl) return;
        this.menuEl.style.left = `${this._anchor?.x ?? 0}px`;
        this.menuEl.style.top = `${this._anchor?.y ?? 0}px`;
        const pop = this.menuEl as HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
        if (!this.menuEl.matches(':popover-open') && typeof pop.showPopover === 'function') pop.showPopover();
        this.clampPosition();
    }

    private clampPosition(): void {
        const el = this.menuEl;
        if (!el) return;
        const margin = 8;
        const rect = el.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;
        if (rect.right > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - rect.width - margin);
        }
        if (rect.bottom > window.innerHeight - margin) {
            top = Math.max(margin, (this._anchor?.y ?? top) - rect.height - 10);
        }
        if (left !== rect.left) el.style.left = `${left}px`;
        if (top !== rect.top) el.style.top = `${top}px`;
    }

    private render(): void {
        if (!this.menuEl) return;
        this.menuEl.replaceChildren(this.renderFilter(), this.renderMark(), this.renderDefaults());
    }

    private renderFilter(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'section';
        const h = document.createElement('h3');
        h.textContent = 'Filter';
        section.appendChild(h);

        const unread = document.createElement('label');
        unread.className = 'filter';
        const unreadInput = document.createElement('input');
        unreadInput.type = 'checkbox';
        unreadInput.checked = this._unreadOnly;
        unreadInput.addEventListener('change', (e) => {
            this.dispatchEvent(
                new CustomEvent('unread-change', {
                    detail: (e.target as HTMLInputElement).checked,
                    bubbles: true,
                    composed: true,
                }),
            );
        });
        unread.append(unreadInput, document.createTextNode(' Unread only'));
        section.appendChild(unread);

        const markScroll = document.createElement('label');
        markScroll.className = 'filter';
        const markScrollInput = document.createElement('input');
        markScrollInput.type = 'checkbox';
        markScrollInput.checked = this._markOnScroll;
        markScrollInput.addEventListener('change', (e) => {
            this.dispatchEvent(
                new CustomEvent('mark-scroll-change', {
                    detail: (e.target as HTMLInputElement).checked,
                    bubbles: true,
                    composed: true,
                }),
            );
        });
        const span = document.createElement('span');
        span.title = 'Mark articles as read once scrolled past';
        span.textContent = 'Mark as read on scroll';
        markScroll.append(markScrollInput, span);
        section.appendChild(markScroll);
        return section;
    }

    private renderDefaults(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'section';
        const h = document.createElement('h3');
        h.textContent = 'Defaults';
        const button = document.createElement('button');
        button.className = 'mark-opt';
        button.textContent = 'Apply this view to all views';
        button.title = 'Make this layout and sort the default for every view';
        button.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('apply-all', { bubbles: true, composed: true }));
        });
        section.append(h, button);
        return section;
    }

    private renderMark(): HTMLElement {
        const section = document.createElement('div');
        section.className = 'section';
        const title = this._scopeLabel ? `Mark as read in ${this._scopeLabel}` : 'Mark as read';
        const h = document.createElement('h3');
        h.title = title;
        h.textContent = title;
        section.appendChild(h);

        const options = document.createElement('div');
        options.className = 'mark-options';
        for (const opt of AGE_OPTIONS) {
            const button = document.createElement('button');
            button.className = 'mark-opt';
            button.disabled = this._marking;
            button.textContent = this._marking ? 'Marking…' : opt.label;
            button.addEventListener('click', () => {
                this.dispatchEvent(
                    new CustomEvent('mark-before', {
                        detail: opt.age === null ? null : Date.now() - opt.age,
                        bubbles: true,
                        composed: true,
                    }),
                );
            });
            options.appendChild(button);
        }
        section.appendChild(options);
        return section;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'advanced-menu': AdvancedMenu;
    }
}

customElements.define('advanced-menu', AdvancedMenu);
