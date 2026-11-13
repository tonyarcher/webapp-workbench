import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SavedSearch } from '../../types';
import type { MenuAnchor } from '../feed-menu/feed-menu';
import styles from './saved-search-menu.css?inline';

@customElement('saved-search-menu')
export class SavedSearchMenu extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) search: SavedSearch | null = null;
    @property({ attribute: false }) open = false;
    @property({ attribute: false }) anchor: MenuAnchor | null = null;

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
        return html`<div popover>${this.renderContent()}</div>`;
    }

    private renderContent() {
        const search = this.search;
        if (!search) return '';
        return html`
              <div class="head"><h2 title="${search.title}">${search.title}</h2></div>
              <div class="body">
                <div class="section"><h3>Actions</h3>${this.renderActions()}</div>
              </div>`;
    }

    private renderActions() {
        return html`
                  <div class="actions">
                    <button class="action" @click=${this.emitRename}>
                      <span>Rename saved search<br /><span class="desc">Change the name shown in the sidebar</span></span>
                    </button>
                    <button class="action danger" @click=${this.emitDelete}>
                      <span>Delete saved search<br /><span class="desc">Remove this smart folder; the search itself is unchanged</span></span>
                    </button>
                  </div>`;
    }

    private clampPosition() {
        const el = this.menuEl;
        if (!el) return;
        const margin = 8;
        const rect = el.getBoundingClientRect();
        let { left, top } = rect;
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
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }

    private emitDelete() {
        this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true }));
    }

    private emitRename() {
        this.dispatchEvent(new CustomEvent('rename', { bubbles: true, composed: true }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'saved-search-menu': SavedSearchMenu;
    }
}
