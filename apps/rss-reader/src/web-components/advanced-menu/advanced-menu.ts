import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import styles from './advanced-menu.css?inline';

const HOUR = 3_600_000;

const AGE_OPTIONS: { label: string; age: number | null }[] = [
    {label: 'Older than 1 hour', age: HOUR},
    {label: 'Older than 12 hours', age: 12 * HOUR},
    {label: 'Older than 1 day', age: 24 * HOUR},
    {label: 'Older than 3 days', age: 3 * 24 * HOUR},
    {label: 'Older than 7 days', age: 7 * 24 * HOUR},
    {label: 'Older than 30 days', age: 30 * 24 * HOUR},
    {label: 'All time', age: null},
];

@customElement('advanced-menu')
export class AdvancedMenu extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) open = false;
    @property({attribute: false}) anchor: MenuAnchor | null = null;
    @property({attribute: false}) unreadOnly = false;
    @property({attribute: false}) scopeLabel = '';

    private menuEl: HTMLElement | null = null;

    override connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this.onDocClick);
        document.addEventListener('keydown', this.onKeyDown);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onDocClick);
        document.removeEventListener('keydown', this.onKeyDown);
    }

    override firstUpdated() {
        this.menuEl = this.shadowRoot?.querySelector('[popover]') ?? null;
    }

    override updated(changed: Map<string, unknown>) {
        this.syncPopover(changed);
    }

    private syncPopover(changed: Map<string, unknown>) {
        if (!changed.has('open') && !changed.has('anchor')) return;
        if (this.open && this.menuEl) this.openPopover();
        else if (this.menuEl?.matches(':popover-open')) this.menuEl.hidePopover();
    }

    private openPopover() {
        if (!this.menuEl) return;
        this.menuEl.style.left = `${this.anchor?.x ?? 0}px`;
        this.menuEl.style.top = `${this.anchor?.y ?? 0}px`;
        if (!this.menuEl.matches(':popover-open')) this.menuEl.showPopover();
        this.clampPosition();
    }

    override render() {
        return html`<div popover>${this.renderFilter()}${this.renderMark()}</div>`;
    }

    private renderFilter() {
        return html`
                <div class="section">
                    <h3>Filter</h3>
                    <label class="filter">
                        <input type="checkbox" .checked=${this.unreadOnly} @change=${this.onUnreadChange} />
                        Unread only
                    </label>
                </div>`;
    }

    private renderMark() {
        const title = this.scopeLabel ? `Mark as read in ${this.scopeLabel}` : 'Mark as read';
        return html`
                <div class="section">
                    <h3 title="${title}">${title}</h3>
                    <div class="mark-options">${AGE_OPTIONS.map((o) => this.renderMarkOpt(o))}</div>
                </div>`;
    }

    private renderMarkOpt(opt: { label: string; age: number | null }) {
        return html`<button class="mark-opt" @click=${() => this.emitMarkBefore(opt.age)}>${opt.label}</button>`;
    }

    private clampPosition() {
        const el = this.menuEl;
        if (!el) return;
        const margin = 8;
        const rect = el.getBoundingClientRect();
        let {left, top} = rect;
        if (rect.right > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - rect.width - margin);
        }
        if (rect.bottom > window.innerHeight - margin) {
            top = Math.max(margin, (this.anchor?.y ?? top) - rect.height - 10);
        }
        if (left !== rect.left) el.style.left = `${left}px`;
        if (top !== rect.top) el.style.top = `${top}px`;
    }

    private onDocClick = (e: MouseEvent) => {
        if (!this.open) return;
        const target = e.composedPath()[0] as Node | null;
        if (target && this.menuEl?.contains(target)) return;
        this.emitClose();
    };

    private onKeyDown = (e: KeyboardEvent) => {
        if (this.open && e.key === 'Escape') this.emitClose();
    };

    private emitClose() {
        this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
    }

    private onUnreadChange(e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        this.dispatchEvent(
            new CustomEvent('unread-change', {
                detail: checked,
                bubbles: true,
                composed: true,
            }),
        );
    }

    private emitMarkBefore(age: number | null) {
        this.dispatchEvent(
            new CustomEvent('mark-before', {
                detail: age === null ? null : Date.now() - age,
                bubbles: true,
                composed: true,
            }),
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'advanced-menu': AdvancedMenu;
    }
}
