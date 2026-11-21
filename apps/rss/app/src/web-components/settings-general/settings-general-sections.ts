import { ALL_SHARE_TARGETS } from '../../services/share-settings';
import type { ScrapeCandidate } from '../../services/api';
import type { ReaderFont, ReaderLine, ReaderMode, ReaderSize, ReaderWidth } from '../../services/reader-mode';
import type { ShareTarget } from '../../services/share';
import type { Theme } from '../../theme';
import { APP_COMMIT, APP_VERSION, BUILD_TIME, VERSION_HISTORY } from '../../generated/version-history';
import {
    button,
    checkboxField,
    el,
    hint,
    section,
    selectField,
    setFocusKey,
    statusLine,
    type SelectOption,
} from './settings-general-dom';

/** The element's public surface, as the section builders need it. */
export interface SettingsGeneralSectionsHost {
    theme: Theme;
    adding: boolean;
    busy: boolean;
    migrating: boolean;
    status: string;
    statusError: boolean;
    mastodonHost: string;
    shareStatus: string;
    shareStatusError: boolean;
    shareTargets: ShareTarget[];
    readerMode: ReaderMode;
    showHistory: boolean;
    scrapeOpen: boolean;
    scrapeBusy: boolean;
    scrapeStatus: string;
    scrapeStatusError: boolean;
    scrapeCandidates: ScrapeCandidate[];
    scrapeSelected: string[];
    onThemeClick: (event: Event) => void;
    setReaderMode: (mode: ReaderMode) => void;
    toggleShareTarget: (target: ShareTarget, checked: boolean) => void;
    submitMastodonHost: () => void;
    openAdd: () => void;
    cancelAdd: () => void;
    submitAdd: () => void;
    openMuteFilters: () => void;
    onImportClick: () => void;
    onImportFile: (event: Event) => void;
    onExport: () => void;
    onMigrate: () => void;
    toggleHistory: () => void;
    openScrape: () => void;
    cancelScrape: () => void;
    previewScrapePage: () => void;
    followScrapePage: () => void;
    toggleScrapeCandidate: (url: string, checked: boolean) => void;
}

const THEMES: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark grey' },
    { value: 'oled', label: 'Lights out' },
];

const FONT_OPTIONS: SelectOption[] = [
    { value: 'sans', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'dyslexia', label: 'Dyslexia-friendly' },
];

const SIZE_OPTIONS: SelectOption[] = [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
];

const LINE_OPTIONS: SelectOption[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'normal', label: 'Normal' },
    { value: 'relaxed', label: 'Relaxed' },
];

const WIDTH_OPTIONS: SelectOption[] = [
    { value: 'narrow', label: 'Narrow' },
    { value: 'medium', label: 'Medium' },
    { value: 'wide', label: 'Wide' },
];

const SHARE_LABELS: Record<ShareTarget, string> = {
    facebook: 'Facebook',
    x: 'X',
    mastodon: 'Mastodon',
    instagram: 'Instagram',
};

function themeOption(host: SettingsGeneralSectionsHost, value: Theme, label: string): HTMLButtonElement {
    const option = el('button', host.theme === value ? 'theme-opt active' : 'theme-opt');
    option.type = 'button';
    option.dataset['theme'] = value;
    setFocusKey(option, `button:${label}`);
    option.append(el('span', `swatch ${value}`), document.createTextNode(label));
    option.addEventListener('click', (event) => host.onThemeClick(event));
    return option;
}

export function buildAppearanceSection(host: SettingsGeneralSectionsHost): HTMLElement {
    const root = section('Appearance');
    const row = el('div', 'theme-row');
    for (const theme of THEMES) row.append(themeOption(host, theme.value, theme.label));
    root.append(row);
    return root;
}

function readerModeFields(host: SettingsGeneralSectionsHost): HTMLElement {
    const mode = host.readerMode;
    const grid = el('div', 'view-defaults');
    grid.append(
        selectField('Font', FONT_OPTIONS, mode.font, (value) =>
            host.setReaderMode({ ...host.readerMode, font: value as ReaderFont }),
        ),
        selectField('Size', SIZE_OPTIONS, mode.size, (value) =>
            host.setReaderMode({ ...host.readerMode, size: value as ReaderSize }),
        ),
        selectField('Line spacing', LINE_OPTIONS, mode.line, (value) =>
            host.setReaderMode({ ...host.readerMode, line: value as ReaderLine }),
        ),
        selectField('Width', WIDTH_OPTIONS, mode.width, (value) =>
            host.setReaderMode({ ...host.readerMode, width: value as ReaderWidth }),
        ),
    );
    return grid;
}

export function buildReaderSection(host: SettingsGeneralSectionsHost): HTMLElement {
    const root = section('Reader');
    root.append(readerModeFields(host));
    root.append(hint('Text size, font and width for the article reader. List layout lives in the list toolbar.'));
    return root;
}

function shareTargets(host: SettingsGeneralSectionsHost): HTMLElement {
    const group = el('div', 'share-targets');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Share buttons');
    group.tabIndex = -1;
    for (const target of ALL_SHARE_TARGETS) {
        group.append(
            checkboxField(SHARE_LABELS[target], host.shareTargets.includes(target), (checked) =>
                host.toggleShareTarget(target, checked),
            ),
        );
    }
    return group;
}

function mastodonRow(host: SettingsGeneralSectionsHost): HTMLElement {
    const row = el('div', 'share-row');
    const input = el('input');
    input.id = 'mastodon-host';
    input.type = 'text';
    input.inputMode = 'url';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'mastodon.social';
    input.value = host.mastodonHost;
    setFocusKey(input, 'input:mastodon-host');
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void host.submitMastodonHost();
    });
    row.append(
        input,
        button('btn primary', 'Save', () => void host.submitMastodonHost()),
    );
    return row;
}

export function buildSharingSection(host: SettingsGeneralSectionsHost): HTMLElement {
    const root = section('Sharing');
    const label = el('label', 'field-label', 'Mastodon instance');
    label.htmlFor = 'mastodon-host';
    root.append(
        shareTargets(host),
        label,
        mastodonRow(host),
        hint('Article shares post through this instance, e.g. mastodon.social.'),
    );
    if (host.shareStatus) root.append(statusLine(host.shareStatus, host.shareStatusError));
    return root;
}

function actionButton(
    label: string,
    desc: string,
    glyph: string,
    disabled: boolean,
    onClick: () => void,
): HTMLButtonElement {
    const node = el('button', 'action');
    node.type = 'button';
    node.disabled = disabled;
    setFocusKey(node, `action:${label}`);
    const text = el('span');
    text.append(document.createTextNode(label), el('br'), el('span', 'desc', desc));
    node.append(text, el('span', undefined, glyph));
    node.addEventListener('click', onClick);
    return node;
}

function addRow(host: SettingsGeneralSectionsHost): HTMLElement | null {
    if (!host.adding) return null;
    const row = el('div', 'add-row');
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'https://example.com/feed.json';
    input.setAttribute('data-add-url', '');
    setFocusKey(input, 'input:add-url');
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void host.submitAdd();
    });
    const add = button('btn primary', 'Add', () => void host.submitAdd());
    add.disabled = host.busy;
    row.append(
        input,
        add,
        button('btn', 'Cancel', () => host.cancelAdd()),
    );
    return row;
}

function scrapeForm(host: SettingsGeneralSectionsHost): HTMLElement {
    const form = el('div', 'scrape-form');
    const url = el('input');
    url.type = 'url';
    url.placeholder = 'https://example.com/blog';
    url.setAttribute('data-scrape-url', '');
    url.setAttribute('aria-label', 'Page URL');
    const selector = el('input');
    selector.type = 'text';
    selector.placeholder = 'Article list CSS selector (optional)';
    selector.setAttribute('data-scrape-selector', '');
    selector.setAttribute('aria-label', 'Article list selector');
    const preview = button('btn', 'Preview', () => void host.previewScrapePage());
    const follow = button('btn primary', 'Follow page', () => void host.followScrapePage());
    const cancel = button('btn', 'Cancel', host.cancelScrape);
    preview.disabled = host.scrapeBusy;
    follow.disabled = host.scrapeBusy;
    form.append(url, selector, preview, follow, cancel);
    if (host.scrapeStatus) form.append(statusLine(host.scrapeStatus, host.scrapeStatusError));
    if (host.scrapeCandidates.length) {
        const list = el('ul', 'scrape-list');
        for (const candidate of host.scrapeCandidates) {
            const label = el('label', 'scrape-choice');
            const input = el('input');
            input.type = 'checkbox';
            input.checked = host.scrapeSelected.includes(candidate.url);
            input.setAttribute('data-candidate-url', candidate.url);
            input.addEventListener('change', () => host.toggleScrapeCandidate(candidate.url, input.checked));
            label.append(input, document.createTextNode(candidate.title));
            const item = el('li');
            item.title = candidate.url;
            item.appendChild(label);
            list.appendChild(item);
        }
        form.appendChild(list);
    }
    return form;
}

function feedActions(host: SettingsGeneralSectionsHost): HTMLElement {
    const actions = el('div', 'actions');
    actions.append(actionButton('Add feed', 'Subscribe by RSS, Atom or JSON Feed URL', '+', host.busy, host.openAdd));
    actions.append(actionButton('Add from a page', 'Follow a site with no feed', '?', host.busy, host.openScrape));
    const row = addRow(host);
    if (row) actions.append(row);
    actions.append(
        actionButton(
            'Mute filters',
            'Hide articles by words in title or body, per folder or all',
            '🔇',
            host.busy,
            host.openMuteFilters,
        ),
        actionButton('Import OPML', 'Restore feeds and folders', '↑', host.busy, host.onImportClick),
        actionButton('Export OPML', 'Back up your subscriptions', '↓', host.busy, host.onExport),
        actionButton(
            'Upload local library',
            'Migrate IndexedDB data to the server',
            host.migrating ? '…' : '⇪',
            host.busy || host.migrating,
            host.onMigrate,
        ),
    );
    return actions;
}

function opmlFileInput(host: SettingsGeneralSectionsHost): HTMLInputElement {
    const input = el('input');
    input.type = 'file';
    input.accept = '.opml,.xml,text/xml,application/xml';
    input.style.display = 'none';
    input.setAttribute('data-import', '');
    input.addEventListener('change', (event) => host.onImportFile(event));
    return input;
}

export function buildFeedsSection(host: SettingsGeneralSectionsHost): HTMLElement {
    const root = section('Feeds');
    root.append(feedActions(host), opmlFileInput(host));
    if (host.scrapeOpen) root.appendChild(scrapeForm(host));
    if (host.status) root.append(statusLine(host.status, host.statusError));
    return root;
}

function historyList(): HTMLElement {
    if (VERSION_HISTORY.length === 0) return hint('No version history available.');
    const list = el('ul', 'history-list');
    for (const entry of VERSION_HISTORY) {
        const item = el('li', 'history-item');
        const date = el('div', 'history-date', entry.date);
        date.append(document.createTextNode(' '), el('span', 'history-id', entry.id));
        item.append(date, el('div', 'history-summary', entry.summary));
        list.append(item);
    }
    return list;
}

export function buildAboutSection(host: SettingsGeneralSectionsHost): HTMLElement {
    const root = section('About');
    const built = BUILD_TIME ? new Date(BUILD_TIME).toLocaleDateString() : '';
    root.append(hint(`Version ${APP_VERSION} · ${APP_COMMIT}${built ? ` · ${built}` : ''}`, 'about-meta'));
    const actions = el('div', 'view-actions');
    const history = button('btn', host.showHistory ? 'Hide version history' : "What's new", () => host.toggleHistory());
    history.setAttribute('data-setting', 'version-history');
    actions.append(history);
    root.append(actions);
    if (host.showHistory) root.append(historyList());
    return root;
}
