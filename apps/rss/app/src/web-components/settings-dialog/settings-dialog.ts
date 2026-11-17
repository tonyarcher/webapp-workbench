import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { applyTheme, getTheme, type Theme } from '../../theme';
import { loadReaderMode, saveReaderMode, applyReaderMode, type ReaderMode } from '../../services/reader-mode';
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
import {
    renderAboutSection,
    renderAppearanceSection,
    renderFeedsSection,
    renderReadingSection,
    renderSharingSection,
} from './settings-dialog-sections';
import styles from './settings-dialog.css?inline';

const MIGRATE_SIZE_LIMIT = 1_800_000;

@customElement('settings-dialog')
export class SettingsDialog extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) open = false;
    /** Current route, so the dialog can copy the open view's settings. */
    @property({ attribute: false }) view: View = { kind: 'all' };

    @state() theme: Theme = 'light';
    @state() readerMode = loadReaderMode();
    @state() adding = false;
    @state() busy = false;
    @state() migrating = false;
    @state() status = '';
    @state() statusError = false;
    @state() mastodonHost = '';
    @state() shareStatus = '';
    @state() shareStatusError = false;
    @state() shareTargets: ShareTarget[] = [];
    @state() viewSettings: ViewSettings = { ...DEFAULT_VIEW_SETTINGS };
    @state() viewStatus = '';
    @state() showHistory = false;

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
                this.showHistory = false;
                this.dialogEl?.showModal();
                modalOpened();
            } else {
                this.dialogEl?.close();
                modalClosed();
            }
        }
    }

    private renderAppearanceSection() {
        return renderAppearanceSection(this);
    }
    private renderReadingSection() {
        return renderReadingSection(this);
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

    setListView(value: string) {
        if (value !== 'detailed' && value !== 'headline' && value !== 'cards' && value !== 'slideshow') return;
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, listView: value });
        this.saveViewDefaults();
    }

    setReaderMode(mode: ReaderMode) {
        this.readerMode = mode;
        saveReaderMode(mode);
        applyReaderMode(mode);
    }

    setSort(value: string) {
        if (value !== 'hot' && value !== 'newest' && value !== 'oldest') return;
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, sort: value });
        this.saveViewDefaults();
    }

    setPageSize(value: number) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, pageSize: value });
        this.saveViewDefaults();
    }

    setMaxCardCols(value: number) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, maxCardCols: value });
        this.saveViewDefaults();
    }

    setUnreadOnly(value: boolean) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, unreadOnly: value });
        this.saveViewDefaults();
    }

    setMarkOnScroll(value: boolean) {
        this.viewSettings = normalizeViewSettings({ ...this.viewSettings, markOnScroll: value });
        this.saveViewDefaults();
    }

    /** Only the article-list routes have per-view settings worth copying. */
    get canUseCurrentView(): boolean {
        return (
            this.view.kind === 'all' ||
            this.view.kind === 'folder' ||
            this.view.kind === 'feed' ||
            this.view.kind === 'interesting'
        );
    }

    useCurrentView = () => {
        this.viewSettings = readViewSettingsFor(this.view);
        saveDefaultViewSettings(this.viewSettings);
        this.announceViewSettings();
        this.viewStatus = "Loaded the current view's settings.";
    };

    applyAllViews = () => {
        applyDefaultToAllViews(this.viewSettings);
        this.announceViewSettings();
        this.viewStatus = 'Applied to all views.';
    };

    private renderSharingSection() {
        return renderSharingSection(this);
    }

    toggleShareTarget(e: Event, target: ShareTarget) {
        const on = (e.target as HTMLInputElement).checked;
        const current = new Set(loadShareTargets());
        if (on) current.add(target);
        else current.delete(target);
        const next = ALL_SHARE_TARGETS.filter((t) => current.has(t));
        saveShareTargets(next);
        this.shareTargets = next;
        window.dispatchEvent(new CustomEvent('share-settings-changed'));
    }

    async submitMastodonHost() {
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
        return renderFeedsSection(this);
    }
    private renderAboutSection() {
        return renderAboutSection(this);
    }

    toggleHistory = () => {
        this.showHistory = !this.showHistory;
    };

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
        <div class="body" tabindex="0">
          ${this.renderAppearanceSection()}
          ${this.renderReadingSection()}
          ${this.renderSharingSection()}
          ${this.renderFeedsSection()}
          ${this.renderAboutSection()}
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

    onThemeClick(e: Event) {
        const theme = (e.currentTarget as HTMLElement).dataset['theme'] as Theme | undefined;
        if (theme) this.setTheme(theme);
    }

    cancelAdd() {
        this.adding = false;
    }

    onImportClick() {
        this.shadowRoot?.querySelector<HTMLInputElement>('input[data-import]')?.click();
    }

    openAdd() {
        this.adding = true;
        this.status = '';
        this.statusError = false;
        this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]')?.focus();
    }

    openMuteFilters = () => {
        this.close();
        navigate({ kind: 'mute-filters' });
    };

    async submitAdd() {
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

    async onImportFile(e: Event) {
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

    async onExport() {
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

    async onMigrate() {
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
