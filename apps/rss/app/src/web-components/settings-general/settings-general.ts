import { applyTheme, getTheme, type Theme } from '../../theme';
import { applyReaderMode, loadReaderMode, saveReaderMode, type ReaderMode } from '../../services/reader-mode';
import { addFeed, exportOpmlFile, importOpmlFile, syncAllFeeds } from '../../mutations';
import { normalizeMastodonHost, type ShareTarget } from '../../services/share';
import {
    ALL_SHARE_TARGETS,
    loadMastodonHost,
    loadShareTargets,
    saveMastodonHost,
    saveShareTargets,
} from '../../services/share-settings';
import { addScrapeSource, migrateLibrary, previewScrape, type ScrapeCandidate } from '../../services/api';
import { buildMigratePayload, readIdbForMigration } from '../../services/migrate-export';
import { invalidateArticles, invalidateLibrary } from '../../query';
import { navigate } from '../../router';
import { onAddFeedRequested, takeAddFeedRequest } from '../../services/add-feed-intent';
import {
    buildAboutSection,
    buildAppearanceSection,
    buildFeedsSection,
    buildReaderSection,
    buildSharingSection,
} from './settings-general-sections';
import { el } from './settings-general-dom';
import styles from './settings-general.css?inline';

const MIGRATE_SIZE_LIMIT = 1_800_000;

/** Install a reactive accessor. Assignments request the same batched paint Lit used to. */
function defineReactive<T>(host: SettingsGeneral, name: string, initial: T): void {
    let current = initial;
    Object.defineProperty(host, name, {
        configurable: true,
        enumerable: true,
        get(): T {
            return current;
        },
        set(next: T): void {
            if (Object.is(current, next)) return;
            current = next;
            host.requestUpdate();
        },
    });
}

/**
 * The General tab of the settings area: appearance, reader typography, sharing,
 * feed import/export, and about. Built once, its five sections are rebuilt from
 * plain DOM in `paint()`. It used to be a modal dialog; it is a page panel now,
 * so there is no open state, backdrop, or focus trap.
 */
export class SettingsGeneral extends HTMLElement {
    declare theme: Theme;
    declare readerMode: ReaderMode;
    declare adding: boolean;
    declare busy: boolean;
    declare migrating: boolean;
    declare status: string;
    declare statusError: boolean;
    declare mastodonHost: string;
    declare shareStatus: string;
    declare shareStatusError: boolean;
    declare shareTargets: ShareTarget[];
    declare showHistory: boolean;
    declare scrapeOpen: boolean;
    declare scrapeBusy: boolean;
    declare scrapeStatus: string;
    declare scrapeStatusError: boolean;
    declare scrapeCandidates: ScrapeCandidate[];
    declare scrapeSelected: string[];

    private bodyEl: HTMLDivElement | null = null;
    private updateScheduled = false;
    private updateResolvers: Array<(value: boolean) => void> = [];
    /** Text typed into a field before a paint; restored only while focused. */
    private mastodonDraft: string | null = null;
    private addUrlDraft: string | null = null;
    private scrapeUrlDraft: string | null = null;
    private scrapeSelectorDraft: string | null = null;
    private unsubscribeAddFeed: (() => void) | null = null;

    constructor() {
        super();
        defineReactive(this, 'theme', 'light' as Theme);
        defineReactive(this, 'readerMode', loadReaderMode());
        defineReactive(this, 'adding', false);
        defineReactive(this, 'busy', false);
        defineReactive(this, 'migrating', false);
        defineReactive(this, 'status', '');
        defineReactive(this, 'statusError', false);
        defineReactive(this, 'mastodonHost', '');
        defineReactive(this, 'shareStatus', '');
        defineReactive(this, 'shareStatusError', false);
        defineReactive(this, 'shareTargets', [] as ShareTarget[]);
        defineReactive(this, 'showHistory', false);
        defineReactive(this, 'scrapeOpen', false);
        defineReactive(this, 'scrapeBusy', false);
        defineReactive(this, 'scrapeStatus', '');
        defineReactive(this, 'scrapeStatusError', false);
        defineReactive(this, 'scrapeCandidates', [] as ScrapeCandidate[]);
        defineReactive(this, 'scrapeSelected', [] as string[]);
        this.resetState();
    }

    get updateComplete(): Promise<boolean> {
        return new Promise((resolve) => {
            this.updateResolvers.push(resolve);
            setTimeout(() => {
                const index = this.updateResolvers.indexOf(resolve);
                if (index < 0) return;
                this.updateResolvers.splice(index, 1);
                resolve(true);
            }, 0);
        });
    }

    requestUpdate(): void {
        if (this.updateScheduled) return;
        this.updateScheduled = true;
        queueMicrotask(() => {
            this.updateScheduled = false;
            try {
                this.paint();
            } finally {
                this.resolveUpdate();
            }
        });
    }

    private resolveUpdate(): void {
        for (const resolve of this.updateResolvers.splice(0)) resolve(true);
    }

    connectedCallback(): void {
        if (!this.bodyEl) this.build();
        this.paint();
        this.unsubscribeAddFeed = onAddFeedRequested(() => {
            takeAddFeedRequest();
            this.openAdd();
        });
        if (takeAddFeedRequest()) this.openAdd();
    }

    disconnectedCallback(): void {
        this.unsubscribeAddFeed?.();
        this.unsubscribeAddFeed = null;
    }

    private build(): void {
        const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
        const style = el('style');
        style.textContent = styles;
        const panel = el('div', 'panel');
        panel.append(el('h2', undefined, 'General'));
        const body = el('div', 'body');
        body.tabIndex = 0;
        panel.append(body);
        shadow.append(style, panel);
        this.bodyEl = body;
    }

    private paint(): void {
        if (!this.bodyEl) return;
        const focusKey = this.focusedKey();
        this.captureDrafts();
        this.bodyEl.replaceChildren(
            buildAppearanceSection(this),
            buildReaderSection(this),
            buildSharingSection(this),
            buildFeedsSection(this),
            buildAboutSection(this),
        );
        this.restoreDrafts();
        this.restoreFocus(focusKey);
    }

    private focusedKey(): string | null {
        return this.shadowRoot?.activeElement?.getAttribute('data-focus-key') ?? null;
    }

    /**
     * A repaint replaces the body, so focus would fall back to `<body>`. Put it
     * back on the control the reader was using, found by its stable key.
     */
    private restoreFocus(key: string | null): void {
        if (!key || !this.bodyEl) return;
        for (const node of this.bodyEl.querySelectorAll<HTMLElement>('[data-focus-key]')) {
            if (node.getAttribute('data-focus-key') !== key) continue;
            node.focus();
            return;
        }
    }

    /** Keep typed text while its field is focused; a loaded value always wins. */
    private captureDrafts(): void {
        this.mastodonDraft = null;
        this.addUrlDraft = null;
        const scrapeUrlField = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-url]');
        if (scrapeUrlField) this.scrapeUrlDraft = scrapeUrlField.value;
        const scrapeSelectorField = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-selector]');
        if (scrapeSelectorField) this.scrapeSelectorDraft = scrapeSelectorField.value;
        const active = this.shadowRoot?.activeElement;
        if (!(active instanceof HTMLInputElement)) return;
        if (active.id === 'mastodon-host') this.mastodonDraft = active.value;
        if (active.hasAttribute('data-add-url')) this.addUrlDraft = active.value;
    }

    private restoreDrafts(): void {
        const mastodon = this.shadowRoot?.querySelector<HTMLInputElement>('#mastodon-host');
        if (mastodon && this.mastodonDraft !== null) mastodon.value = this.mastodonDraft;
        const addUrl = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]');
        if (addUrl && this.addUrlDraft !== null) addUrl.value = this.addUrlDraft;
        const scrapeUrl = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-url]');
        if (scrapeUrl && this.scrapeUrlDraft !== null) scrapeUrl.value = this.scrapeUrlDraft;
        const scrapeSelector = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-selector]');
        if (scrapeSelector && this.scrapeSelectorDraft !== null) scrapeSelector.value = this.scrapeSelectorDraft;
    }

    /** Load the persisted values. The panel is a page, so this runs once per mount. */
    private resetState(): void {
        this.theme = getTheme();
        this.mastodonHost = loadMastodonHost();
        this.shareTargets = loadShareTargets();
        this.shareStatus = '';
        this.shareStatusError = false;
        this.showHistory = false;
        this.mastodonDraft = null;
        this.addUrlDraft = null;
        this.scrapeOpen = false;
        this.scrapeStatus = '';
        this.scrapeCandidates = [];
        this.scrapeSelected = [];
        this.scrapeUrlDraft = null;
        this.scrapeSelectorDraft = null;
    }

    setReaderMode = (mode: ReaderMode): void => {
        this.readerMode = mode;
        saveReaderMode(mode);
        applyReaderMode(mode);
    };

    toggleShareTarget = (target: ShareTarget, checked: boolean): void => {
        const current = new Set(loadShareTargets());
        if (checked) current.add(target);
        else current.delete(target);
        const next = ALL_SHARE_TARGETS.filter((item) => current.has(item));
        saveShareTargets(next);
        this.shareTargets = next;
        window.dispatchEvent(new CustomEvent('share-settings-changed'));
    };

    submitMastodonHost = async (): Promise<void> => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('#mastodon-host');
        const clean = normalizeMastodonHost(input?.value.trim() ?? '');
        if (!clean) {
            this.shareStatus = 'Enter an instance domain, e.g. mastodon.social.';
            this.shareStatusError = true;
            return;
        }
        saveMastodonHost(clean);
        if (input) input.value = clean;
        this.mastodonHost = clean;
        this.mastodonDraft = null;
        this.shareStatus = `Sharing through ${clean}.`;
        this.shareStatusError = false;
        window.dispatchEvent(new CustomEvent('share-settings-changed'));
    };

    toggleHistory = (): void => {
        this.showHistory = !this.showHistory;
    };

    openScrape = (): void => {
        this.scrapeOpen = true;
        this.scrapeStatus = '';
        this.scrapeCandidates = [];
    };

    cancelScrape = (): void => {
        this.scrapeOpen = false;
        this.scrapeStatus = '';
        this.scrapeCandidates = [];
        this.scrapeSelected = [];
        this.scrapeUrlDraft = null;
        this.scrapeSelectorDraft = null;
    };

    private scrapeFields(): { url: string; selector: string } {
        const url = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-url]');
        const selector = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-selector]');
        return { url: url?.value.trim() ?? '', selector: selector?.value.trim() ?? '' };
    }

    private scrapeError(message: string): void {
        this.scrapeStatus = message;
        this.scrapeStatusError = true;
    }

    previewScrapePage = async (): Promise<void> => {
        const { url, selector } = this.scrapeFields();
        if (!url) {
            this.scrapeError('Enter the page URL.');
            return;
        }
        this.scrapeBusy = true;
        try {
            const result = await previewScrape(url, selector);
            this.scrapeCandidates = result.candidates;
            this.scrapeSelected = result.candidates.map((candidate) => candidate.url);
            this.scrapeStatus = `${result.candidates.length} stories found with ${result.label}.`;
            this.scrapeStatusError = false;
        } catch (err) {
            this.scrapeError(err instanceof Error ? err.message : 'Could not preview the page');
        } finally {
            this.scrapeBusy = false;
        }
    };

    toggleScrapeCandidate = (candidateUrl: string, checked: boolean): void => {
        const next = new Set(this.scrapeSelected);
        if (checked) next.add(candidateUrl);
        else next.delete(candidateUrl);
        this.scrapeSelected = [...next];
    };

    followScrapePage = async (): Promise<void> => {
        const { url, selector } = this.scrapeFields();
        if (!url) {
            this.scrapeError('Enter the page URL.');
            return;
        }
        if (this.scrapeSelected.length === 0) {
            this.scrapeError('Select at least one story.');
            return;
        }
        this.scrapeBusy = true;
        try {
            await addScrapeSource(url, selector, this.scrapeSelected);
            await invalidateLibrary();
            this.cancelScrape();
            this.status = `Following ${url}.`;
            this.statusError = false;
        } catch (err) {
            this.scrapeError(err instanceof Error ? err.message : 'Could not follow the page');
        } finally {
            this.scrapeBusy = false;
        }
    };

    onThemeClick = (event: Event): void => {
        const theme = (event.currentTarget as HTMLElement).dataset['theme'] as Theme | undefined;
        if (theme) this.setTheme(theme);
    };

    private setTheme(theme: Theme): void {
        this.theme = theme;
        applyTheme(theme);
    }

    cancelAdd = (): void => {
        this.adding = false;
    };

    onImportClick = (): void => {
        this.shadowRoot?.querySelector<HTMLInputElement>('input[data-import]')?.click();
    };

    openAdd = (): void => {
        this.adding = true;
        this.status = '';
        this.statusError = false;
        void this.updateComplete.then(() => {
            this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]')?.focus();
        });
    };

    openMuteFilters = (): void => {
        navigate({ kind: 'settings', section: 'mute-filters' });
    };

    submitAdd = async (): Promise<void> => {
        const input = this.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]');
        const url = input?.value.trim() ?? '';
        if (!url) return;
        this.busy = true;
        try {
            const feed = await addFeed(url);
            if (input) input.value = '';
            this.adding = false;
            navigate({ kind: 'feed', id: feed.id });
        } catch (err) {
            this.status = err instanceof Error ? err.message : 'Could not add feed';
            this.statusError = true;
        } finally {
            this.busy = false;
        }
    };

    onImportFile = async (event: Event): Promise<void> => {
        const input = event.target as HTMLInputElement;
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
    };

    onExport = async (): Promise<void> => {
        this.busy = true;
        try {
            const xml = await exportOpmlFile();
            const blob = new Blob([xml], { type: 'text/xml' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'subscriptions.opml';
            anchor.click();
            URL.revokeObjectURL(url);
            this.status = 'Exported subscriptions.opml';
            this.statusError = false;
        } catch (err) {
            this.status = err instanceof Error ? `Export failed: ${err.message}` : 'Export failed';
            this.statusError = true;
        } finally {
            this.busy = false;
        }
    };

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

    onMigrate = async (): Promise<void> => {
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
    };
}

customElements.define('settings-general', SettingsGeneral);

declare global {
    interface HTMLElementTagNameMap {
        'settings-general': SettingsGeneral;
    }
}
