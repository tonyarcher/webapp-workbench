import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Feed, Folder } from '../../types';
import styles from './feed-menu.css?inline';

export interface MenuAnchor {
  x: number;
  y: number;
}

@customElement('feed-menu')
export class FeedMenu extends LitElement {
  static override styles = unsafeCSS(styles);

  @property({ attribute: false }) feed: Feed | null = null;
  @property({ attribute: false }) folders: Folder[] = [];
  @property({ attribute: false }) open = false;
  @property({ attribute: false }) anchor: MenuAnchor | null = null;

  @state() private selected = new Set<string>();

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
    if (changed.has('feed')) {
      this.selected = new Set(this.feed?.folderIds ?? []);
    }
    if (changed.has('open') || changed.has('anchor')) {
      if (this.open && this.menuEl) {
        this.menuEl.style.left = `${this.anchor?.x ?? 0}px`;
        this.menuEl.style.top = `${this.anchor?.y ?? 0}px`;
        if (!this.menuEl.matches(':popover-open')) this.menuEl.showPopover();
        this.clampPosition();
      } else if (this.menuEl?.matches(':popover-open')) {
        this.menuEl.hidePopover();
      }
    }
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

  private toggleFolder(id: string, checked: boolean) {
    const next = new Set(this.selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selected = next;
    this.dispatchEvent(
      new CustomEvent('folders-change', {
        detail: Array.from(next),
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitRefresh() {
    this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
  }

  private emitDelete() {
    this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true }));
  }

  override render() {
    const feed = this.feed;
    return html`
      <div popover>
        ${feed
          ? html`
              <div class="head">
                <h2 title="${feed.title}">${feed.title}</h2>
              </div>
              <div class="body">
                <div class="section">
                  <h3>Folders</h3>
                  ${this.folders.length
                    ? html`
                        <div class="folder-list">
                          ${this.folders.map(
                            (folder) => html`
                              <label class="folder-opt">
                                <input
                                  type="checkbox"
                                  .checked=${this.selected.has(folder.id)}
                                  @change=${(e: Event) =>
                                    this.toggleFolder(
                                      folder.id,
                                      (e.target as HTMLInputElement).checked,
                                    )}
                                />
                                <span class="label" title="${folder.title}">${folder.title}</span>
                              </label>
                            `,
                          )}
                        </div>
                      `
                    : html`<div class="hint">No folders yet. Import an OPML file to create some.</div>`}
                </div>

                <div class="section">
                  <h3>Actions</h3>
                  <div class="actions">
                    <button class="action" @click=${this.emitRefresh}>
                      <span>
                        Refresh feed<br />
                        <span class="desc">Fetch the latest articles now</span>
                      </span>
                    </button>
                    <button class="action danger" @click=${this.emitDelete}>
                      <span>
                        Delete feed<br />
                        <span class="desc">Remove the feed and its articles</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'feed-menu': FeedMenu;
  }
}
