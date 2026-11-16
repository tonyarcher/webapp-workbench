import { html } from 'lit';
import { ALL_SHARE_TARGETS } from '../../services/share-settings';
import type { ShareTarget } from '../../services/share';
import type { Theme } from '../../theme';
import type { View } from '../../types';
import type { ViewSettings } from '../article-list/article-list-helpers';
import { APP_COMMIT, APP_VERSION, BUILD_TIME, VERSION_HISTORY } from '../../generated/version-history';

export interface SettingsDialogSectionsHost {
    theme: Theme;
    view: View;
    adding: boolean;
    busy: boolean;
    migrating: boolean;
    status: string;
    statusError: boolean;
    mastodonHost: string;
    shareStatus: string;
    shareStatusError: boolean;
    shareTargets: ShareTarget[];
    viewSettings: ViewSettings;
    viewStatus: string;
    showHistory: boolean;
    canUseCurrentView: boolean;
    onThemeClick: (e: Event) => void;
    setListView: (value: string) => void;
    setSort: (value: string) => void;
    setPageSize: (value: number) => void;
    setMaxCardCols: (value: number) => void;
    setUnreadOnly: (value: boolean) => void;
    setMarkOnScroll: (value: boolean) => void;
    useCurrentView: () => void;
    applyAllViews: () => void;
    toggleShareTarget: (e: Event, target: ShareTarget) => void;
    submitMastodonHost: () => void;
    openAdd: () => void;
    cancelAdd: () => void;
    submitAdd: () => void;
    openMuteFilters: () => void;
    onImportClick: () => void;
    onImportFile: (e: Event) => void;
    onExport: () => void;
    onMigrate: () => void;
    toggleHistory: () => void;
}

function renderThemeOption(host: SettingsDialogSectionsHost, value: Theme, label: string) {
    return html`
      <button class="theme-opt ${host.theme === value ? 'active' : ''}" data-theme=${value} @click=${host.onThemeClick}>
        <span class="swatch ${value}"></span>
        ${label}
      </button>
    `;
}

export function renderAppearanceSection(host: SettingsDialogSectionsHost) {
    return html`
      <div class="section">
        <h3>Appearance</h3>
        <div class="theme-row">
          ${renderThemeOption(host, 'light', 'Light')}
          ${renderThemeOption(host, 'dark', 'Dark grey')}
          ${renderThemeOption(host, 'oled', 'Lights out')}
        </div>
      </div>
    `;
}

export function renderReadingSection(host: SettingsDialogSectionsHost) {
    const s = host.viewSettings;
    return html`
      <div class="section">
        <h3>Reading</h3>
        <div class="view-defaults">
          <label class="view-field"><span>Default list view</span>
            <select .value=${s.listView} @change=${(e: Event) => host.setListView((e.target as HTMLSelectElement).value)}>
              <option value="detailed">Detailed List</option><option value="headline">Headline View</option><option value="cards">Cards</option><option value="slideshow">Slideshow</option>
            </select></label>
          <label class="view-field"><span>Sort</span>
            <select .value=${s.sort} @change=${(e: Event) => host.setSort((e.target as HTMLSelectElement).value)}>
              <option value="hot">Hot</option><option value="newest">Newest</option><option value="oldest">Oldest</option>
            </select></label>
          <label class="view-field"><span>Page size</span>
            <select .value=${String(s.pageSize)} @change=${(e: Event) => host.setPageSize(Number((e.target as HTMLSelectElement).value))}>
              <option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="500">500</option>
            </select></label>
          <label class="view-field"><span>Card columns</span>
            <select .value=${String(s.maxCardCols)} @change=${(e: Event) => host.setMaxCardCols(Number((e.target as HTMLSelectElement).value))}>
              <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option>
            </select></label>
        </div>
        <div class="view-toggles">
          <label class="share-target"><input type="checkbox" .checked=${s.unreadOnly} @change=${(e: Event) => host.setUnreadOnly((e.target as HTMLInputElement).checked)} />Unread only</label>
          <label class="share-target"><input type="checkbox" .checked=${s.markOnScroll} @change=${(e: Event) => host.setMarkOnScroll((e.target as HTMLInputElement).checked)} />Mark on scroll</label>
        </div>
        <div class="view-actions">
          ${host.canUseCurrentView ? html`<button class="btn" @click=${host.useCurrentView}>Use current view</button>` : ''}
          <button class="btn primary" @click=${host.applyAllViews}>Apply to all views</button>
        </div>
        <p class="hint">New and untouched views use these defaults. Apply to all views replaces every view's own settings.</p>
        ${host.viewStatus ? html`<div class="status">${host.viewStatus}</div>` : ''}
      </div>
    `;
}

function renderShareTargets(host: SettingsDialogSectionsHost) {
    const labels: Record<ShareTarget, string> = {
        facebook: 'Facebook',
        x: 'X',
        mastodon: 'Mastodon',
        instagram: 'Instagram',
    };
    return html`
      <div class="share-targets" role="group" aria-label="Share buttons">
        ${ALL_SHARE_TARGETS.map(
            (target) =>
                html`<label class="share-target"><input type="checkbox" .checked=${host.shareTargets.includes(target)} @change=${(e: Event) => host.toggleShareTarget(e, target)} />${labels[target]}</label>`,
        )}
      </div>
    `;
}

function renderMastodonRow(host: SettingsDialogSectionsHost) {
    return html`
      <div class="share-row">
        <input id="mastodon-host" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="mastodon.social" .value=${host.mastodonHost} @keydown=${(
            e: KeyboardEvent,
        ) => {
            if (e.key === 'Enter') void host.submitMastodonHost();
        }} />
        <button class="btn primary" @click=${host.submitMastodonHost}>Save</button>
      </div>
    `;
}

export function renderSharingSection(host: SettingsDialogSectionsHost) {
    return html`
      <div class="section">
        <h3>Sharing</h3>
        ${renderShareTargets(host)}
        <label class="field-label" for="mastodon-host">Mastodon instance</label>
        ${renderMastodonRow(host)}
        <p class="hint">Article shares post through this instance, e.g. mastodon.social.</p>
        ${host.shareStatus ? html`<div class="status ${host.shareStatusError ? 'error' : ''}">${host.shareStatus}</div>` : ''}
      </div>
    `;
}

function renderAddRow(host: SettingsDialogSectionsHost) {
    if (!host.adding) return html``;
    return html`
      <div class="add-row">
        <input data-add-url type="url" placeholder="https://example.com/feed.xml" @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') void host.submitAdd();
        }} />
        <button class="btn primary" @click=${host.submitAdd} ?disabled=${host.busy}>Add</button>
        <button class="btn" @click=${host.cancelAdd}>Cancel</button>
      </div>
    `;
}

export function renderFeedsSection(host: SettingsDialogSectionsHost) {
    return html`
      <div class="section">
        <h3>Feeds</h3>
        <div class="actions">
          <button class="action" @click=${host.openAdd} ?disabled=${host.busy}><span>Add feed<br /><span class="desc">Subscribe by RSS/Atom URL</span></span><span>+</span></button>
          ${renderAddRow(host)}
          <button class="action" @click=${host.openMuteFilters} ?disabled=${host.busy}><span>Mute filters<br /><span class="desc">Hide articles by words in title or body, per folder or all</span></span><span>🔇</span></button>
          <button class="action" @click=${host.onImportClick} ?disabled=${host.busy}><span>Import OPML<br /><span class="desc">Restore feeds and folders</span></span><span>↑</span></button>
          <button class="action" @click=${host.onExport} ?disabled=${host.busy}><span>Export OPML<br /><span class="desc">Back up your subscriptions</span></span><span>↓</span></button>
          <button class="action" @click=${host.onMigrate} ?disabled=${host.busy || host.migrating}><span>Upload local library<br /><span class="desc">Migrate IndexedDB data to the server</span></span><span>${host.migrating ? '…' : '⇪'}</span></button>
        </div>
        <input type="file" data-import accept=".opml,.xml,text/xml,application/xml" style="display:none" @change=${host.onImportFile} />
        ${host.status ? html`<div class="status ${host.statusError ? 'error' : ''}">${host.status}</div>` : ''}
      </div>
    `;
}

function renderHistory() {
    if (VERSION_HISTORY.length === 0) return html`<p class="hint">No version history available.</p>`;
    return html`<ul class="history-list">${VERSION_HISTORY.map(
        (entry) =>
            html`<li class="history-item"><div class="history-date">${entry.date} <span class="history-id">${entry.id}</span></div><div class="history-summary">${entry.summary}</div></li>`,
    )}</ul>`;
}

export function renderAboutSection(host: SettingsDialogSectionsHost) {
    const built = BUILD_TIME ? new Date(BUILD_TIME).toLocaleDateString() : '';
    return html`
      <div class="section">
        <h3>About</h3>
        <p class="hint about-meta">Version ${APP_VERSION} · ${APP_COMMIT}${built ? ` · ${built}` : ''}</p>
        <div class="view-actions">
          <button class="btn" @click=${host.toggleHistory}>${host.showHistory ? 'Hide version history' : "What's new"}</button>
        </div>
        ${host.showHistory ? renderHistory() : ''}
      </div>
    `;
}
