import {html, LitElement, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {applyTheme, getTheme, type Theme} from '../../theme';
import {addFeed, exportOpmlFile, importOpmlFile, syncAllFeeds} from '../../mutations';
import {migrateLibrary} from '../../services/api';
import {buildMigratePayload, readIdbForMigration} from '../../services/migrate-export';
import {invalidateArticles, invalidateLibrary} from '../../query';
import {navigate} from '../../router';
import styles from './settings-dialog.css?inline';

const MIGRATE_SIZE_LIMIT = 1_800_000;

@customElement('settings-dialog')
export class SettingsDialog extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) open = false;

    @state() private theme: Theme = 'light';
    @state() private adding = false;
    @state() private busy = false;
    @state() private migrating = false;
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

    private renderThemeOption(value: Theme, label: string) {
        return html`
      <button class="theme-opt ${this.theme === value ? 'active' : ''}" data-theme=${value} @click=${this.onThemeClick}>
        <span class="swatch ${value}"></span>
        ${label}
      </button>
    `;
    }

    private renderAppearanceSection() {
        return html`
      <div class="section">
        <h3>Appearance</h3>
        <div class="theme-row">
          ${this.renderThemeOption('light', 'Light')}
          ${this.renderThemeOption('dark', 'Dark grey')}
          ${this.renderThemeOption('oled', 'Lights out')}
        </div>
      </div>
    `;
    }

    private renderAddRow() {
        if (!this.adding) return html``;
        return html`
      <div class="add-row">
        <input data-add-url type="url" placeholder="https://example.com/feed.xml" @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.submitAdd(); }} />
        <button class="btn primary" @click=${this.submitAdd} ?disabled=${this.busy}>Add</button>
        <button class="btn" @click=${this.cancelAdd}>Cancel</button>
      </div>
    `;
    }

    private renderFeedsSection() {
        return html`
      <div class="section">
        <h3>Feeds</h3>
        <div class="actions">
          <button class="action" @click=${this.openAdd} ?disabled=${this.busy}>
            <span>Add feed<br /><span class="desc">Subscribe by RSS/Atom URL</span></span><span>＋</span>
          </button>
          ${this.renderAddRow()}
          <button class="action" @click=${this.onImportClick} ?disabled=${this.busy}>
            <span>Import OPML<br /><span class="desc">Restore feeds and folders</span></span><span>⬆</span>
          </button>
          <button class="action" @click=${this.onExport} ?disabled=${this.busy}>
            <span>Export OPML<br /><span class="desc">Back up your subscriptions</span></span><span>⬇</span>
          </button>
          <button class="action" @click=${this.onMigrate} ?disabled=${this.busy || this.migrating}>
            <span>Upload local library<br /><span class="desc">Migrate IndexedDB data to the server</span></span><span>${this.migrating ? '⏳' : '⬆'}</span>
          </button>
        </div>
        <input type="file" data-import accept=".opml,.xml,text/xml,application/xml" style="display:none" @change=${this.onImportFile} />
        ${this.status ? html`<div class="status ${this.statusError ? 'error' : ''}">${this.status}</div>` : ''}
      </div>
    `;
    }

    override render() {
        return html`
      <dialog @click=${this.onDialogClick} @cancel=${(e: Event) => { e.preventDefault(); this.close(); }}>
        <div class="head">
          <h2>Settings</h2>
          <button class="close" title="Close" @click=${this.close}>✕</button>
        </div>
        <div class="body">
          ${this.renderAppearanceSection()}
          ${this.renderFeedsSection()}
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
        this.busy = true;
        try {
            const xml = await exportOpmlFile();
            const blob = new Blob([xml], {type: 'text/xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'subscriptions.opml';
            a.click();
            URL.revokeObjectURL(url);
            this.status = 'Exported subscriptions.opml';
            this.statusError = false;
        } catch (err) {
            this.status = err instanceof Error ? `Export failed: ${err.message}` : 'Export failed';
            this.statusError = true;
        } finally {
            this.busy = false;
        }
    }

    private async prepareMigratePayload() {
        const {folders, feeds, articles, metaEntries} = await readIdbForMigration();
        if (!feeds.length && !folders.length) return null;
        const payload = buildMigratePayload(folders, feeds, articles, metaEntries);
        const json = JSON.stringify(payload);
        if (json.length > MIGRATE_SIZE_LIMIT) throw new Error(`Payload too large (${Math.round(json.length / 1024)} KB). Use OPML import instead.`);
        return payload;
    }

    private async runMigrateWithPayload(payload: ReturnType<typeof buildMigratePayload>) {
        const result = await migrateLibrary(payload);
        this.status = `Migrated ${result.feedsAdded} feeds, ${result.foldersAdded} folders, ${result.statesQueued} states. Syncing…`;
        this.statusError = false;
        await invalidateLibrary();
        await invalidateArticles();
        await syncAllFeeds();
        this.status = 'Migration complete';
    }

    private async onMigrate() {
        this.migrating = true;
        this.status = '';
        this.statusError = false;
        try {
            const payload = await this.prepareMigratePayload();
            if (!payload) { this.status = 'No local data to migrate.'; return; }
            await this.runMigrateWithPayload(payload);
        } catch (err) {
            this.status = err instanceof Error ? `Migration failed: ${err.message}` : 'Migration failed';
            this.statusError = true;
        } finally {
            this.migrating = false;
        }
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
