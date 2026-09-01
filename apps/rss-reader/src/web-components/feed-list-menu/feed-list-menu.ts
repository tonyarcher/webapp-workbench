import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import type {FeedSort} from '../../types';
import styles from './feed-list-menu.css?inline';

@customElement('feed-list-menu')
export class FeedListMenu extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) open = false;
    @property({attribute: false}) anchor: MenuAnchor | null = null;
    @property({attribute: false}) feedSort: FeedSort = 'alpha';

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
        return html`
      <div popover>
        <div class="section">
          <h3>Sort</h3>
          <div class="segments">
            ${this.segment(this.feedSort === 'alpha', () => this.setSort('alpha'), 'Name Aâ€“Z')}
            ${this.segment(this.feedSort === 'unread', () => this.setSort('unread'), 'Unread first')}
          </div>
        </div>

        <div class="section">
          <h3>Folders</h3>
          <button class="folder-action" @click=${this.emitSortFolders}>
            Sort folders Aâ€“Z
          </button>
          <button class="folder-action" @click=${this.emitRefreshAll}>
            Refresh all feeds
          </button>
        </div>
      </div>
    `;
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

    private setSort(sort: FeedSort) {
        if (sort === this.feedSort) return;
        this.dispatchEvent(
            new CustomEvent('sort-change', {detail: sort, bubbles: true, composed: true}),
        );
    }

    private emitSortFolders() {
        this.dispatchEvent(
            new CustomEvent('sort-folders', {bubbles: true, composed: true}),
        );
    }

    private emitRefreshAll() {
        this.dispatchEvent(
            new CustomEvent('refresh-all', {bubbles: true, composed: true}),
        );
    }

    private segment(active: boolean, onClick: () => void, label: string) {
        return html`
      <button class="segment ${active ? 'active' : ''}" @click=${onClick}>${label}</button>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'feed-list-menu': FeedListMenu;
    }
}
