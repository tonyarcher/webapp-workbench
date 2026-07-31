import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getTheme, applyTheme, type Theme } from '../theme';
import { addFeed, exportOpmlFile, importOpmlFile, syncAllFeeds } from '../mutations';
import { navigate } from '../router';

@customElement('settings-dialog')
export class SettingsDialog extends LitElement {
  static override styles = css`
    dialog {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0;
      width: 380px;
      background: var(--panel-bg);
      color: var(--text);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.45);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .head h2 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
    }
    .close {
      border: none;
      background: none;
      font-size: 18px;
      cursor: pointer;
      color: var(--text-muted);
      line-height: 1;
    }
    .close:hover {
      color: var(--text);
    }
    .body {
      padding: 12px 16px 16px;
    }
    .section {
      margin-bottom: 18px;
    }
    .section:last-child {
      margin-bottom: 0;
    }
    .section h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 0 0 10px;
    }
    .theme-row {
      display: flex;
      gap: 8px;
    }
    .theme-opt {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 10px 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .theme-opt:hover {
      background: var(--hover);
    }
    .theme-opt.active {
      border-color: var(--accent);
      background: var(--active-bg);
      color: var(--active-text);
    }
    .swatch {
      width: 100%;
      height: 26px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .swatch.light {
      background: #ffffff;
    }
    .swatch.dark {
      background: #1c2128;
    }
    .swatch.oled {
      background: #000000;
      border-color: #333;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      text-align: left;
    }
    .action:hover {
      background: var(--hover);
    }
    .action .desc {
      color: var(--text-muted);
      font-size: 12px;
    }
    .add-row {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    input[type='url'] {
      flex: 1;
      font: inherit;
      font-size: 13px;
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--text);
    }
    .btn {
      font: inherit;
      font-size: 13px;
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      cursor: pointer;
      white-space: nowrap;
    }
    .btn:hover {
      background: var(--hover);
    }
    .btn.primary {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .status {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 8px;
      min-height: 16px;
    }
    .status.error {
      color: var(--danger);
    }
  `;

  @property({ attribute: false }) open = false;

  @state() private theme: Theme = 'light';
  @state() private adding = false;
  @state() private busy = false;
  @state() private status = '';
  @state() private statusError = false;

  private dialogEl: HTMLDialogElement | null = null;

  override updated(changed: Map<string, unknown>) {
    if (changed.has('open')) {
      if (this.open) {
        this.theme = getTheme();
        this.dialogEl?.showModal();
      } else {
        this.dialogEl?.close();
      }
    }
  }

  private onDialogClick(e: MouseEvent) {
    if (e.target === this.dialogEl) {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }
  }

  private setTheme(theme: Theme) {
    this.theme = theme;
    applyTheme(theme);
  }

  private openAdd() {
    this.adding = true;
    this.status = '';
    this.statusError = false;
    this.shadowRoot
      ?.querySelector<HTMLInputElement>('input[data-add-url]')
      ?.focus();
  }

  private async submitAdd() {
    const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]');
    const url = input?.value.trim() ?? '';
    if (!url) return;
    this.busy = true;
    try {
      const feed = await addFeed(url);
      if (input) input.value = '';
      this.adding = false;
      this.close();
      navigate({ kind: 'feed', id: feed.id });
    } catch (err) {
      this.status = err instanceof Error ? err.message : 'Could not add feed';
      this.statusError = true;
    } finally {
      this.busy = false;
    }
  }

  private async onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy = true;
    this.status = '';
    this.statusError = false;
    try {
      const xml = await file.text();
      await importOpmlFile(xml);
      this.status = 'Syncing imported feeds…';
      await syncAllFeeds((done, total) => {
        this.status = `Syncing ${done + 1}/${total}…`;
      });
      this.status = 'Import complete';
    } catch (err) {
      this.status = err instanceof Error ? `Import failed: ${err.message}` : 'Import failed';
      this.statusError = true;
    } finally {
      this.busy = false;
      input.value = '';
    }
  }

  private async onExport() {
    const xml = await exportOpmlFile();
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subscriptions.opml';
    a.click();
    URL.revokeObjectURL(url);
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  override render() {
    const themeOption = (value: Theme, label: string) => html`
      <button
        class="theme-opt ${this.theme === value ? 'active' : ''}"
        @click=${() => this.setTheme(value)}
      >
        <span class="swatch ${value}"></span>
        ${label}
      </button>
    `;

    return html`
      <dialog
        @click=${this.onDialogClick}
        @cancel=${(e: Event) => {
          e.preventDefault();
          this.close();
        }}
      >
        <div class="head">
          <h2>Settings</h2>
          <button class="close" title="Close" @click=${this.close}>✕</button>
        </div>
        <div class="body">
          <div class="section">
            <h3>Appearance</h3>
            <div class="theme-row">
              ${themeOption('light', 'Light')}
              ${themeOption('dark', 'Dark grey')}
              ${themeOption('oled', 'Lights out')}
            </div>
          </div>

          <div class="section">
            <h3>Feeds</h3>
            <div class="actions">
              <button class="action" @click=${this.openAdd} ?disabled=${this.busy}>
                <span>
                  Add feed<br />
                  <span class="desc">Subscribe by RSS/Atom URL</span>
                </span>
                <span>＋</span>
              </button>
              ${this.adding
                ? html`
                    <div class="add-row">
                      <input
                        data-add-url
                        type="url"
                        placeholder="https://example.com/feed.xml"
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === 'Enter') this.submitAdd();
                        }}
                      />
                      <button class="btn primary" @click=${this.submitAdd} ?disabled=${this.busy}>Add</button>
                      <button class="btn" @click=${() => (this.adding = false)}>Cancel</button>
                    </div>
                  `
                : ''}
              <button class="action" @click=${() => this.shadowRoot?.querySelector<HTMLInputElement>('input[data-import]')?.click()} ?disabled=${this.busy}>
                <span>
                  Import OPML<br />
                  <span class="desc">Restore feeds and folders</span>
                </span>
                <span>⬆</span>
              </button>
              <button class="action" @click=${this.onExport} ?disabled=${this.busy}>
                <span>
                  Export OPML<br />
                  <span class="desc">Back up your subscriptions</span>
                </span>
                <span>⬇</span>
              </button>
            </div>
            <input type="file" data-import accept=".opml,.xml,text/xml,application/xml" style="display:none" @change=${this.onImportFile} />
            ${this.status ? html`<div class="status ${this.statusError ? 'error' : ''}">${this.status}</div>` : ''}
          </div>
        </div>
      </dialog>
    `;
  }

  override firstUpdated() {
    this.dialogEl = this.shadowRoot?.querySelector('dialog') ?? null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-dialog': SettingsDialog;
  }
}
