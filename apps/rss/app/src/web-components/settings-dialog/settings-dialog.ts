import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { applyTheme, getTheme, type Theme } from '../../theme';
import { modalClosed, modalOpened } from '../../services/modal-guard';
import { addFeed, exportOpmlFile, importOpmlFile, syncAllFeeds } from '../../mutations';
import { normalizeMastodonHost, type ShareTarget } from '../../services/share';
import {
    ALL_SHARE_TARGETS,
    loadMastodonHost,
    loadShareTargets,
    saveMastodonHost,
    saveShareTargets,
} from '../../services/share-settings';
import { migrateLibrary } from '../../services/api';
import { buildMigratePayload, readIdbForMigration } from '../../services/migrate-export';
import { invalidateArticles, invalidateLibrary } from '../../query';
import { navigate } from '../../router';
import {
    applyDefaultToAllViews,
    DEFAULT_VIEW_SETTINGS,
    normalizeViewSettings,
    readDefaultViewSettings,
    readViewSettingsFor,
    saveDefaultViewSettings,
    type ViewSettings,
} from '../article-list/article-list-helpers';
import type { View } from '../../types';
import styles from './settings-dialog.css?inline';

const MIGRATE_SIZE_LIMIT = 1_800_000;

@customElement('settings-dialog')
export class SettingsDialog extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) open = false;
    /** Current route, so the dialog can copy the open view's settings. */
    @property({ attribute: false }) view: View = { kind: 'all' };

    @state() private theme: Theme = 'light';
    @state() private adding = false;
    @state() private busy = false;
    @state() private migrating = false;
    @state() private status = '';
    @state() private statusError = false;
    @state() private mastodonHost = '';
    @state() private shareStatus = '';
    @state() private shareStatusError = false;
    @state() private shareTargets: ShareTarget[] = [];
    @state() private viewSettings: ViewSettings = { ...DEFAULT_VIEW_SETTINGS };
    @state() private viewStatus = '';

    private dialogEl: HTMLDialogElement | null = null;

    override updated(changed: Map<string, unknown>) {
        if (changed.has('open')) {
            if (this.open) {
                this.theme = getTheme();
                this.mastodonHost = loadMastodonHost();
                this.shareTargets = loadShareTargets();
                this.shareStatus = '';
                this.shareStatusError = false;
                this.viewSettings = readDefaultViewSettings();
                this.viewStatus = '';
                this.dialogEl?.showModal();
                modalOpened();
            } else {
                this.dialogEl?.close();
                modalClosed();
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

    private renderReadingSection() {
        const s = this.viewSettings;
        return html`
      <div class="section">
        <h3>Reading</h3>
        <div class="view-defaults">
          <label class="view-field">
            <span>Default list view</span>
            <select .value=${s.listView} @change=${(e: Event) => this.setListView((e.target as HTMLSelectElement).value)}>
              <option value="detailed">Detailed List</option>
              <option value="headline">Headline View</option>
              <option value="cards">Cards</option>
            </select>
          </label>
          <label class="view-field">
            <span>Sort</span>
            <select .value=${s.sort} @change=${(e: Event) => this.setSort((e.target as HTMLSelectElement).value)}>
              <option value="hot">Hot</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          <label class="view-field">
            <span>Page size</span>
            <select .value=${String(s.pageSize)} @change=${(e: Event) => this.setPageSize(Number((e.target as HTMLSelectElement).value))}>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="500">500</option>
            </select>
          </label>
          <label class="view-field">
            <span>Card columns</span>
            <select .value=${String(s.maxCardCols)} @change=${(e: Event) => this.setMaxCardCols(Number((e.target as HTMLSelectElement).value))}>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </label>
        </div>
        <div class="view-toggles">
          <label class="share-target"><input type="checkbox" .checked=${s.unreadOnly} @change=${(e: Event) => this.setUnreadOnly((e.target as HTMLInputElement).checked)} />Unread only</label>
          <label class="share-target"><input type="checkbox" .checked=${s.markOnScroll} @change=${(e: Event) => this.setMarkOnScroll((e.target as HTMLInputElement).checked)} />Mark on scroll</label>
        </div>
        <div class="view-actions">
          ${
              this.canUseCurrentView
                  ? html`<button class="btn" @click=${this.useCurrentView}>Use current view</button>`
                  : ''
          }
          <button class="btn primary" @click=${this.applyAllViews}>Apply to all views</button>
        </div>
        <p class="hint">New and untouched views use these defaults. Apply to all views replaces every view's own settings.</p>
        ${this.viewStatus ? html`<div class="status">${this.viewStatus}</div>` : ''}
      </div>
    `;
    }

    private saveViewDefaults() {
        saveDefaultViewSettings(this.viewSettings);
        // Let an open view that has no own override adopt the new default now.
        this.announceViewSettings();
        this.viewStatus = 'Defaults saved. Apply to all views to replace per-view settings.';
    }

    /** Tell the open list and the badge refresh that the defaults changed. */
    private announceViewSettings() {
        window.dispatchEvent(new CustomEvent('view-settings-changed'));
    }

    private setListView(value: string) {
        if (value !== 'detailed' && value !== 'headline' && value !== 'cards') return;
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, listView: value });
        this.saveViewDefaults();
    }

    private setSort(value: string) {
        if (value !== 'hot' && value !== 'newest' && value !== 'oldest') return;
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, sort: value });
        this.saveViewDefaults();
    }

    private setPageSize(value: number) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, pageSize: value });
        this.saveViewDefaults();
    }

    private setMaxCardCols(value: number) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, maxCardCols: value });
        this.saveViewDefaults();
    }

    private setUnreadOnly(value: boolean) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, unreadOnly: value });
        this.saveViewDefaults();
    }

    private setMarkOnScroll(value: boolean) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, markOnScroll: value });
        this.saveViewDefaults();
    }

    /** Only the article-list routes have per-view settings worth copying. */
    private get canUseCurrentView(): boolean {
        return (
            this.view.kind === 'all' ||
            this.view.kind === 'folder' ||
            this.view.kind === 'feed' ||
            this.view.kind === 'interesting'
        );
    }

    private useCurrentView = () => {
        this.viewSettings = readViewSettingsFor(this.view);
        saveDefaultViewSettings(this.viewSettings);
        this.announceViewSettings();
        this.viewStatus = "Loaded the current view's settings.";
    };

    private applyAllViews = () => {
        applyDefaultToAllViews(this.viewSettings);
        this.announceViewSettings();
        this.viewStatus = 'Applied to all views.';
    };

    private renderAddRow() {
        if (!this.adding) return html``;
        return html`
      <div class="add-row">
        <input data-add-url type="url" placeholder="https://example.com/feed.xml" @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') void this.submitAdd();
        }} />
        <button class="btn primary" @click=${this.submitAdd} ?disabled=${this.busy}>Add</button>
        <button class="btn" @click=${this.cancelAdd}>Cancel</button>
      </div>
    `;
    }

    private renderSharingSection() {
        return html`
      <div class="section">
        <h3>Sharing</h3>
        ${this.renderShareTargets()}
        <label class="field-label" for="mastodon-host">Mastodon instance</label>
        ${this.renderMastodonRow()}
        <p class="hint">Article shares post through this instance, e.g. mastodon.social.</p>
        ${this.shareStatus ? html`<div class="status ${this.shareStatusError ? 'error' : ''}">${this.shareStatus}</div>` : ''}
      </div>
    `;
    }

    /** One checkbox per network; saving applies immediately. */
    private renderShareTargets() {
        const labels: Record<ShareTarget, string> = {
            facebook: 'Facebook',
            x: 'X',
            mastodon: 'Mastodon',
            instagram: 'Instagram',
        };
        return html`
      <div class="share-targets" role="group" aria-label="Share buttons">
        ${ALL_SHARE_TARGETS.map(
            (target) => html`
            <label class="share-target">
              <input
                type="checkbox"
                .checked=${this.shareTargets.includes(target)}
                @change=${(e: Event) => this.toggleShareTarget(e, target)}
              />${labels[target]}
            </label>`,
        )}
      </div>
    `;
    }

    /** Mastodon instance field; Enter submits like the Save button. */
    private renderMastodonRow() {
        return html`
      <div class="share-row">
        <input
          id="mastodon-host"
          type="text"
          inputmode="url"
          autocomplete="off"
          spellcheck="false"
          placeholder="mastodon.social"
          .value=${this.mastodonHost}
          @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') void this.submitMastodonHost();
          }}
        />
        <button class="btn primary" @click=${this.submitMastodonHost}>Save</button>
      </div>
    `;
    }

    private toggleShareTarget(e: Event, target: ShareTarget) {
        const on = (e.target as HTMLInputElement).checked;
        const current = new Set(loadShareTargets());
        if (on) current.add(target);
        else current.delete(target);
        const next = ALL_SHARE_TARGETS.filter((t) => current.has(t));
        saveShareTargets(next);
        this.shareTargets = next;
        window.dispatchEvent(new CustomEvent('share-settings-changed'));
    }

    private async submitMastodonHost() {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('#mastodon-host');
        const raw = input?.value.trim() ?? '';
        const clean = normalizeMastodonHost(raw);
        if (!clean) {
            this.shareStatus = 'Enter an instance domain, e.g. mastodon.social.';
            this.shareStatusError = true;
            return;
        }
        saveMastodonHost(clean);
        this.mastodonHost = clean;
        this.shareStatus = `Sharing through ${clean}.`;
        this.shareStatusError = false;
        window.dispatchEvent(new CustomEvent('share-settings-changed'));
    }

    private renderFeedsSection() {
        return html`
      <div class="section">
        <h3>Feeds</h3>
        <div class="actions">
          <button class="action" @click=${this.openAdd} ?disabled=${this.busy}>
            <span>Add feed<br /><span class="desc">Subscribe by RSS/Atom URL</span></span><span>+</span>
          </button>
          ${this.renderAddRow()}
          <button class="action" @click=${this.openMuteFilters} ?disabled=${this.busy}>
            <span>Mute filters<br /><span class="desc">Hide articles by words in title or body, per folder or all</span></span><span>🔇</span>
          </button>
          <button class="action" @click=${this.onImportClick} ?disabled=${this.busy}>
            <span>Import OPML<br /><span class="desc">Restore feeds and folders</span></span><span>↑</span>
          </button>
          <button class="action" @click=${this.onExport} ?disabled=${this.busy}>
            <span>Export OPML<br /><span class="desc">Back up your subscriptions</span></span><span>↓</span>
          </button>
          <button class="action" @click=${this.onMigrate} ?disabled=${this.busy || this.migrating}>
            <span>Upload local library<br /><span class="desc">Migrate IndexedDB data to the server</span></span><span>${this.migrating ? '…' : '⇪'}</span>
          </button>
        </div>
        <input type="file" data-import accept=".opml,.xml,text/xml,application/xml" style="display:none" @change=${this.onImportFile} />
        ${this.status ? html`<div class="status ${this.statusError ? 'error' : ''}">${this.status}</div>` : ''}
      </div>
    `;
    }

    override render() {
        return html`
      <dialog @click=${this.onDialogClick} @cancel=${(e: Event) => {
          e.preventDefault();
          this.close();
      }}>
        <div class="head">
          <h2>Settings</h2>
          <button class="close" title="Close" @click=${this.close}>✕</button>
        </div>
        <div class="body">
          ${this.renderAppearanceSection()}
          ${this.renderReadingSection()}
          ${this.renderSharingSection()}
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
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        }
    }

    private setTheme(theme: Theme) {
        this.theme = theme;
        applyTheme(theme);
    }

    private onThemeClick(e: Event) {
        const theme = (e.currentTarget as HTMLElement).dataset['theme'] as Theme | undefined;
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
        this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]')?.focus();
    }

    private openMuteFilters = () => {
        this.close();
        navigate({ kind: 'mute-filters' });
    };

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
            const result = await importOpmlFile(xml);
            const skipped = result.skippedFeeds > 0 ? ` (${result.skippedFeeds} skipped)` : '';
            this.status = `Imported ${result.subscribedFeeds} new subscriptions${skipped}. Syncing articles.`;
            await syncAllFeeds((done, total) => {
                this.status = `Syncing ${done + 1}/${total}.`;
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
            const blob = new Blob([xml], { type: 'text/xml' });
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
        const { folders, feeds, articles, metaEntries } = await readIdbForMigration();
        if (!feeds.length && !folders.length) return null;
        const payload = buildMigratePayload(folders, feeds, articles, metaEntries);
        const json = JSON.stringify(payload);
        if (json.length > MIGRATE_SIZE_LIMIT)
            throw new Error(`Payload too large (${Math.round(json.length / 1024)} KB). Use OPML import instead.`);
        return payload;
    }

    private async runMigrateWithPayload(payload: ReturnType<typeof buildMigratePayload>) {
        const result = await migrateLibrary(payload);
        this.status = `Migrated ${result.feedsAdded} feeds, ${result.foldersAdded} folders, ${result.statesQueued} states. Syncing.`;
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
            if (!payload) {
                this.status = 'No local data to migrate.';
                return;
            }
            await this.runMigrateWithPayload(payload);
        } catch (err) {
            this.status = err instanceof Error ? `Migration failed: ${err.message}` : 'Migration failed';
            this.statusError = true;
        } finally {
            this.migrating = false;
        }
    }

    private close() {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'settings-dialog': SettingsDialog;
    }
}
