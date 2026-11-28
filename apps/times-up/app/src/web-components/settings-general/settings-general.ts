import { applyTheme, getTheme, type Theme } from '../../theme';
import { applyReaderMode, loadReaderMode, saveReaderMode, type ReaderMode } from '../../services/reader-mode';
import { discoverSite as discoverSiteHost, subscribeToFeed as subscribeToFeedHost } from './settings-general-discovery';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import { flushUsageNow, loadUsageEnabled, recordUsage, saveUsageEnabled } from '../../services/usage';
import {
    notificationState as readNotificationState,
    requestNotificationPermission,
    showTestNotification,
    type NotificationState,
} from '../../services/notifications';
import {
    buildAboutSection,
    buildAppearanceSection,
    buildReaderSection,
    buildSharingSection,
    buildUsageSection,
} from './settings-general-sections';
import { buildNotificationsSection } from './settings-general-notifications';
import { loadQuietHours, saveQuietHours, type QuietHours } from '../../services/quiet-hours';
import { badgeEnabled, refreshAppBadge, saveBadgeEnabled } from '../../services/app-badge';
import { promptInstall } from '../../services/pwa-install';
import type { DiscoveredFeed, ScrapeCandidate, ScrapePreview } from '../../services/api';
import type { ShareTarget } from '../../services/share';
import { chooseStrategy, followPage, previewPage, toggleCandidate } from './settings-general-scrape';
import {
    cancelAdd,
    exportFile,
    type ExportFormat,
    importFile,
    migrateLibraryData,
    openAdd,
    openImport,
    openMuteFilters,
    submitAdd,
    submitMastodon,
    toggleShare,
} from './settings-general-feeds';
import { el } from './settings-general-dom';
import styles from './settings-general.css?inline';

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
    declare exportFormat: ExportFormat;
    declare migrating: boolean;
    declare status: string;
    declare statusError: boolean;
    declare mastodonHost: string;
    declare shareStatus: string;
    declare shareStatusError: boolean;
    declare shareTargets: ShareTarget[];
    declare showHistory: boolean;
    declare usageEnabled: boolean;
    declare scrapeOpen: boolean;
    declare scrapeBusy: boolean;
    declare scrapeStatus: string;
    declare scrapeStatusError: boolean;
    declare scrapeCandidates: ScrapeCandidate[];
    declare scrapeSelected: string[];
    declare scrapePreview: ScrapePreview | null;
    declare scrapeStrategyId: string;
    declare discoverOpen: boolean;
    declare discoverBusy: boolean;
    declare discoverStatus: string;
    declare discoverStatusError: boolean;
    declare discovered: DiscoveredFeed[];
    declare notificationState: NotificationState;
    declare notificationStatus: string;
    declare notificationStatusError: boolean;
    declare quietHours: QuietHours;
    declare badgeEnabled: boolean;

    private bodyEl: HTMLDivElement | null = null;
    private updateScheduled = false;
    private updateResolvers: Array<(value: boolean) => void> = [];
    /** Text typed into a field before a paint; restored only while focused. */
    private mastodonDraft: string | null = null;
    private addUrlDraft: string | null = null;
    private scrapeUrlDraft: string | null = null;
    private scrapeSelectorDraft: string | null = null;

    constructor() {
        super();
        defineReactive(this, 'theme', 'light' as Theme);
        defineReactive(this, 'readerMode', loadReaderMode());
        defineReactive(this, 'adding', false);
        defineReactive(this, 'busy', false);
        defineReactive(this, 'exportFormat', 'opml' as ExportFormat);
        defineReactive(this, 'migrating', false);
        defineReactive(this, 'status', '');
        defineReactive(this, 'statusError', false);
        defineReactive(this, 'mastodonHost', '');
        defineReactive(this, 'shareStatus', '');
        defineReactive(this, 'shareStatusError', false);
        defineReactive(this, 'shareTargets', [] as ShareTarget[]);
        defineReactive(this, 'showHistory', false);
        defineReactive(this, 'usageEnabled', false);
        defineReactive(this, 'scrapeOpen', false);
        defineReactive(this, 'scrapeBusy', false);
        defineReactive(this, 'scrapeStatus', '');
        defineReactive(this, 'scrapeStatusError', false);
        defineReactive(this, 'scrapeCandidates', [] as ScrapeCandidate[]);
        defineReactive(this, 'scrapeSelected', [] as string[]);
        defineReactive(this, 'scrapePreview', null as ScrapePreview | null);
        defineReactive(this, 'scrapeStrategyId', '');
        defineReactive(this, 'discoverOpen', false);
        defineReactive(this, 'discoverBusy', false);
        defineReactive(this, 'discoverStatus', '');
        defineReactive(this, 'discoverStatusError', false);
        defineReactive(this, 'discovered', [] as DiscoveredFeed[]);
        defineReactive(this, 'notificationState', 'unsupported' as NotificationState);
        defineReactive(this, 'notificationStatus', '');
        defineReactive(this, 'notificationStatusError', false);
        defineReactive(this, 'quietHours', loadQuietHours());
        defineReactive(this, 'badgeEnabled', badgeEnabled());
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
        // The reader may have changed the site permission in browser settings
        // while another panel was open, so read it again on every mount.
        this.notificationState = readNotificationState();
        this.paint();
        recordUsage('settings_panel_viewed');
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
            buildUsageSection(this),
            buildNotificationsSection(this),
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
        this.usageEnabled = loadUsageEnabled();
        this.mastodonDraft = null;
        this.addUrlDraft = null;
        this.scrapeOpen = false;
        this.scrapeStatus = '';
        this.scrapeCandidates = [];
        this.scrapeSelected = [];
        this.scrapeUrlDraft = null;
        this.scrapeSelectorDraft = null;
        this.discoverOpen = false;
        this.discoverStatus = '';
        this.discovered = [];
        this.notificationState = readNotificationState();
        this.notificationStatus = '';
        this.notificationStatusError = false;
        this.quietHours = loadQuietHours();
        this.badgeEnabled = badgeEnabled();
    }

    setReaderMode = (mode: ReaderMode): void => {
        this.readerMode = mode;
        saveReaderMode(mode);
        applyReaderMode(mode);
    };

    toggleShareTarget = (target: ShareTarget, checked: boolean): void => toggleShare(this, target, checked);

    submitMastodonHost = (): void => {
        void submitMastodon(this);
    };

    clearMastodonDraft = (): void => {
        this.mastodonDraft = null;
    };

    toggleHistory = (): void => {
        this.showHistory = !this.showHistory;
    };

    setUsageEnabled = (enabled: boolean): void => {
        this.usageEnabled = enabled;
        saveUsageEnabled(enabled);
        if (enabled) void flushUsageNow();
    };

    requestNotifications = (): void => {
        void this.askForNotifications();
    };

    /**
     * The permission prompt needs the click that led here; this only runs from
     * the panel's button. State is re-read after the await, and the element may
     * have left the page while the browser prompt was open.
     */
    private async askForNotifications(): Promise<void> {
        const next = await requestNotificationPermission();
        if (!this.isConnected) return;
        this.notificationState = next;
        this.notificationStatus = notificationResultText(next);
        this.notificationStatusError = next === 'denied';
    }

    sendTest = (): void => {
        void this.sendTestNotification();
    };

    private async sendTestNotification(): Promise<void> {
        const sent = await showTestNotification();
        if (!this.isConnected) return;
        this.notificationStatus = sent ? 'Test notification sent.' : 'The browser did not show the test notification.';
        this.notificationStatusError = !sent;
    }

    /** Browsers cannot re-prompt after a denial; re-read the state instead. */
    refreshNotificationState = (): void => {
        this.notificationState = readNotificationState();
        this.notificationStatus =
            this.notificationState === 'denied'
                ? "Still blocked. Allow notifications in this browser's site settings."
                : '';
        this.notificationStatusError = this.notificationState === 'denied';
    };

    /** The shared preference F1 alerts and K4 briefings read before notifying. */
    setQuietHours = (next: QuietHours): void => {
        this.quietHours = next;
        saveQuietHours(next);
    };

    setBadgeEnabled = (enabled: boolean): void => {
        this.badgeEnabled = enabled;
        saveBadgeEnabled(enabled);
        refreshAppBadge();
    };

    installApp = (): void => {
        void promptInstall()
            .then((result) => {
                this.notificationStatus =
                    result === 'accepted'
                        ? 'Times Up installed.'
                        : result === 'dismissed'
                          ? 'Install dismissed. You can install later from your browser menu.'
                          : 'Install is unavailable in this browser.';
                this.notificationStatusError = false;
            })
            .catch(() => {
                this.notificationStatus = 'Install could not start.';
                this.notificationStatusError = true;
            });
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
        this.scrapePreview = null;
        this.scrapeStrategyId = '';
        this.scrapeUrlDraft = null;
        this.scrapeSelectorDraft = null;
    };

    openDiscover = (): void => {
        this.discoverOpen = true;
        this.discoverStatus = '';
        this.discovered = [];
    };

    cancelDiscover = (): void => {
        this.discoverOpen = false;
        this.discoverStatus = '';
        this.discovered = [];
    };

    discoverSite = (): void => {
        void discoverSiteHost(this);
    };

    subscribeToFeed = (feed: DiscoveredFeed): void => {
        void subscribeToFeedHost(this, feed);
    };

    previewScrapePage = (): void => {
        void previewPage(this);
    };

    selectScrapeStrategy = (id: string): void => chooseStrategy(this, id);

    toggleScrapeCandidate = (url: string, checked: boolean): void => toggleCandidate(this, url, checked);

    followScrapePage = (): void => {
        void followPage(this);
    };

    onThemeClick = (event: Event): void => {
        const theme = (event.currentTarget as HTMLElement).dataset['theme'] as Theme | undefined;
        if (theme) this.setTheme(theme);
    };

    private setTheme(theme: Theme): void {
        this.theme = theme;
        applyTheme(theme);
    }

    cancelAdd = (): void => cancelAdd(this);

    onImportClick = (): void => openImport(this);

    openAdd = (): void => openAdd(this);

    openMuteFilters = (): void => openMuteFilters();

    submitAdd = (): void => {
        void submitAdd(this);
    };

    onImportFile = (event: Event): void => {
        void importFile(this, event);
    };

    onExport = (): void => {
        void exportFile(this, this.exportFormat);
    };

    onExportFormat = (format: ExportFormat): void => {
        this.exportFormat = format;
    };

    onMigrate = (): void => {
        void migrateLibraryData(this);
    };
}

function notificationResultText(state: NotificationState): string {
    switch (state) {
        case 'granted':
            return 'Notifications are on.';
        case 'denied':
            return "Permission was blocked. Allow notifications in your browser's site settings.";
        case 'unsupported':
            return 'This browser does not support notifications.';
        default:
            return 'Permission was not granted. You can try again.';
    }
}

customElements.define('settings-general', SettingsGeneral);

declare global {
    interface HTMLElementTagNameMap {
        'settings-general': SettingsGeneral;
    }
}
