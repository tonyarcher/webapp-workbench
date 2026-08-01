import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {applyTheme, getTheme, type Theme} from '../../theme';
import {addFeed, exportOpmlFile, importOpmlFile, syncAllFeeds} from '../../mutations';
import {navigate} from '../../router';
import styles from './settings-dialog.css?inline';

@customElement('settings-dialog')
export class SettingsDialog extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) open = false;

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

    override render() {
        const themeOption = (value: Theme, label: string) => html`
      <button
        class="theme-opt ${this.theme === value ? 'active' : ''}"
        data-theme=${value}
        @click=${this.onThemeClick}
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
                      <button class="btn" @click=${this.cancelAdd}>Cancel</button>
                    </div>
                  `
            : ''}
              <button class="action" @click=${this.onImportClick} ?disabled=${this.busy}>
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

    private onDialogClick(e: MouseEvent) {
        if (e.target === this.dialogEl) {
            this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
        }
    }

    private setTheme(theme: Theme) {
        this.theme = theme;
        applyTheme(theme);
    }

    private onThemeClick(e: Event) {
        const theme = (e.currentTarget as HTMLElement).dataset.theme as Theme | undefined;
        if (theme) this.setTheme(theme);
    }

    private cancelAdd() {
        this.adding = false;
    }

    private onImportClick() {
        this.shadowRoot?.querySelector<HTMLInputElement>('input[data-import]')?.click();
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
            navigate({kind: 'feed', id: feed.id});
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
        const blob = new Blob([xml], {type: 'text/xml'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subscriptions.opml';
        a.click();
        URL.revokeObjectURL(url);
    }

    private close() {
        this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'settings-dialog': SettingsDialog;
    }
}
