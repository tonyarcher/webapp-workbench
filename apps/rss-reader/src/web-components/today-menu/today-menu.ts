import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import type {Folder} from '../../types';
import {DEFAULT_PER_FOLDER, defaultTodaySettings, PER_FOLDER_OPTIONS, type TodaySettings} from '../../services/today-settings';
import type {MenuAnchor} from '../feed-menu/feed-menu';
import styles from './today-menu.css?inline';

@customElement('today-menu')
export class TodayMenu extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) open = false;
    @property({attribute: false}) anchor: MenuAnchor | null = null;
    @property({attribute: false}) folders: Folder[] = [];
    @property({attribute: false}) settings: TodaySettings = defaultTodaySettings();

    @state() private excluded = new Set<string>();
    @state() private perFolder = DEFAULT_PER_FOLDER;

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
        this.syncSettings(changed);
        this.syncPopover(changed);
    }

    private syncSettings(changed: Map<string, unknown>) {
        if (!changed.has('open') && !changed.has('settings')) return;
        this.excluded = new Set(this.settings.excludedFolderIds);
        this.perFolder = this.settings.perFolder;
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
        <div class="head"><h2>Today</h2></div>
        <div class="body">
          <div class="section"><h3>Include folders</h3>${this.renderFolderSection()}</div>
          <div class="section"><h3>Articles per folder</h3>${this.renderPerFolder()}</div>
        </div>
      </div>`;
    }

    private renderFolderSection() {
        if (!this.folders.length) return html`<div class="hint">No folders yet. Import an OPML file to create some.</div>`;
        return html`<div class="folder-list">${this.folders.map((f) => this.renderFolderOpt(f))}</div>`;
    }

    private renderFolderOpt(folder: Folder) {
        return html`
                        <label class="folder-opt">
                          <input type="checkbox" .checked=${!this.excluded.has(folder.id)}
                            @change=${(e: Event) => this.toggleFolder(folder.id, (e.target as HTMLInputElement).checked)} />
                          <span class="label" title="${folder.title}">${folder.title}</span>
                        </label>`;
    }

    private renderPerFolder() {
        return html`
              <select class="per-folder" .value=${this.perFolder}
                @change=${(e: Event) => this.setPerFolder(Number((e.target as HTMLSelectElement).value))}>
                ${PER_FOLDER_OPTIONS.map((n) => html`<option value=${n}>${n} per folder</option>`)}
              </select>`;
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

    private toggleFolder(id: string, checked: boolean) {
        const next = new Set(this.excluded);
        if (checked) {
            next.delete(id);
        } else {
            next.add(id);
        }
        this.excluded = next;
        this.emitChange();
    }

    private setPerFolder(n: number) {
        this.perFolder = n;
        this.emitChange();
    }

    private emitChange() {
        this.dispatchEvent(
            new CustomEvent('settings-change', {
                detail: {
                    ...this.settings,
                    excludedFolderIds: Array.from(this.excluded),
                    perFolder: this.perFolder,
                },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'today-menu': TodayMenu;
    }
}
