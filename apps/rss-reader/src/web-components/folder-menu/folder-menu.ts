import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Folder} from '../../types';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import styles from './folder-menu.css?inline';

@customElement('folder-menu')
export class FolderMenu extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) folder: Folder | null = null;
    @property({attribute: false}) open = false;
    @property({attribute: false}) anchor: MenuAnchor | null = null;
    @property({attribute: false}) unreadOnly = false;

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
        const folder = this.folder;
        if (!folder) return '';
        return html`
              <div class="head"><h2 title="${folder.title}">${folder.title}</h2></div>
              <div class="body">
                <div class="section"><h3>View</h3>${this.renderViewOpt()}</div>
                <div class="section"><h3>Actions</h3>${this.renderActions()}</div>
              </div>`;
    }

    private renderViewOpt() {
        return html`
                  <label class="opt">
                    <input type="checkbox" .checked=${this.unreadOnly} @change=${this.onUnreadChange} />
                    <span class="label" title="Only show feeds with unread articles">Unread only</span>
                  </label>`;
    }

    private renderActions() {
        return html`
                  <div class="actions">
                    <button class="action" @click=${this.emitRefresh}>
                      <span>Refresh folder<br /><span class="desc">Fetch the latest articles from all feeds in this folder</span></span>
                    </button>
                    <button class="action danger" @click=${this.emitDelete}>
                      <span>Delete folder<br /><span class="desc">Remove the folder; feeds are removed from it</span></span>
                    </button>
                  </div>`;
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

    private emitDelete() {
        this.dispatchEvent(new CustomEvent('delete', {bubbles: true, composed: true}));
    }

    private emitRefresh() {
        this.dispatchEvent(new CustomEvent('refresh', {bubbles: true, composed: true}));
    }

    private onUnreadChange(e: Event) {
        const checked = (e.target as HTMLInputElement).checked;
        this.dispatchEvent(
            new CustomEvent('unread-only-change', {detail: checked, bubbles: true, composed: true}),
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'folder-menu': FolderMenu;
    }
}
