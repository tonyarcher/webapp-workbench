import { ALL_SHARE_TARGETS } from '../../services/share-settings';
import { PAGE_SIZES } from '../article-list/article-list-helpers';
import type { ReaderFont, ReaderLine, ReaderMode, ReaderSize, ReaderWidth } from '../../services/reader-mode';
import type { ShareTarget } from '../../services/share';
import type { Theme } from '../../theme';
import type { ViewSettings } from '../article-list/article-list-helpers';
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
} from './settings-dialog-dom';

/** The element's public surface, as the section builders need it. */
export interface SettingsDialogSectionsHost {
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
    viewSettings: ViewSettings;
    viewStatus: string;
    readerMode: ReaderMode;
    showHistory: boolean;
    canUseCurrentView: boolean;
    onThemeClick: (event: Event) => void;
    setListView: (value: string) => void;
    setSort: (value: string) => void;
    setPageSize: (value: number) => void;
    setMaxCardCols: (value: number) => void;
    setUnreadOnly: (value: boolean) => void;
    setMarkOnScroll: (value: boolean) => void;
    setReaderMode: (mode: ReaderMode) => void;
    useCurrentView: () => void;
    applyAllViews: () => void;
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
}

const THEMES: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark grey' },
    { value: 'oled', label: 'Lights out' },
];

const LIST_VIEW_OPTIONS: SelectOption[] = [
    { value: 'detailed', label: 'Detailed List' },
    { value: 'headline', label: 'Headline View' },
    { value: 'cards', label: 'Cards' },
    { value: 'slideshow', label: 'Slideshow' },
];

const SORT_OPTIONS: SelectOption[] = [
    { value: 'hot', label: 'Hot' },
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
];

const PAGE_SIZE_OPTIONS: SelectOption[] = PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }));
const COLUMN_OPTIONS: SelectOption[] = [2, 3, 4, 5, 6].map((cols) => ({ value: String(cols), label: String(cols) }));

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

function themeOption(host: SettingsDialogSectionsHost, value: Theme, label: string): HTMLButtonElement {
    const option = el('button', host.theme === value ? 'theme-opt active' : 'theme-opt');
    option.type = 'button';
    option.dataset['theme'] = value;
    setFocusKey(option, `button:${label}`);
    option.append(el('span', `swatch ${value}`), document.createTextNode(label));
    option.addEventListener('click', (event) => host.onThemeClick(event));
    return option;
}

export function buildAppearanceSection(host: SettingsDialogSectionsHost): HTMLElement {
    const root = section('Appearance');
    const row = el('div', 'theme-row');
    for (const theme of THEMES) row.append(themeOption(host, theme.value, theme.label));
    root.append(row);
    return root;
}

function viewDefaultFields(host: SettingsDialogSectionsHost): HTMLElement {
    const grid = el('div', 'view-defaults');
    const settings = host.viewSettings;
    grid.append(
        selectField('Default list view', LIST_VIEW_OPTIONS, settings.listView, host.setListView),
        selectField('Sort', SORT_OPTIONS, settings.sort, host.setSort),
        selectField('Page size', PAGE_SIZE_OPTIONS, String(settings.pageSize), (value) =>
            host.setPageSize(Number(value)),
        ),
        selectField('Card columns', COLUMN_OPTIONS, String(settings.maxCardCols), (value) =>
            host.setMaxCardCols(Number(value)),
        ),
    );
    return grid;
}

function viewToggles(host: SettingsDialogSectionsHost): HTMLElement {
    const row = el('div', 'view-toggles');
    row.append(
        checkboxField('Unread only', host.viewSettings.unreadOnly, host.setUnreadOnly),
        checkboxField('Mark on scroll', host.viewSettings.markOnScroll, host.setMarkOnScroll),
    );
    return row;
}

function readerModeFields(host: SettingsDialogSectionsHost): HTMLElement {
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

function viewActions(host: SettingsDialogSectionsHost): HTMLElement {
    const actions = el('div', 'view-actions');
    if (host.canUseCurrentView) actions.append(button('btn', 'Use current view', () => host.useCurrentView()));
    actions.append(button('btn primary', 'Apply to all views', () => host.applyAllViews()));
    return actions;
}

export function buildReadingSection(host: SettingsDialogSectionsHost): HTMLElement {
    const root = section('Reading');
    root.append(viewDefaultFields(host), viewToggles(host), readerModeFields(host), viewActions(host));
    root.append(
        hint("New and untouched views use these defaults. Apply to all views replaces every view's own settings."),
    );
    if (host.viewStatus) root.append(statusLine(host.viewStatus, false));
    return root;
}

function shareTargets(host: SettingsDialogSectionsHost): HTMLElement {
    const group = el('div', 'share-targets');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Share buttons');
    for (const target of ALL_SHARE_TARGETS) {
        group.append(
            checkboxField(SHARE_LABELS[target], host.shareTargets.includes(target), (checked) =>
                host.toggleShareTarget(target, checked),
            ),
        );
    }
    return group;
}

function mastodonRow(host: SettingsDialogSectionsHost): HTMLElement {
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

export function buildSharingSection(host: SettingsDialogSectionsHost): HTMLElement {
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

function addRow(host: SettingsDialogSectionsHost): HTMLElement | null {
    if (!host.adding) return null;
    const row = el('div', 'add-row');
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'https://example.com/feed.xml';
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

function feedActions(host: SettingsDialogSectionsHost): HTMLElement {
    const actions = el('div', 'actions');
    actions.append(actionButton('Add feed', 'Subscribe by RSS/Atom URL', '+', host.busy, host.openAdd));
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

function opmlFileInput(host: SettingsDialogSectionsHost): HTMLInputElement {
    const input = el('input');
    input.type = 'file';
    input.accept = '.opml,.xml,text/xml,application/xml';
    input.style.display = 'none';
    input.setAttribute('data-import', '');
    input.addEventListener('change', (event) => host.onImportFile(event));
    return input;
}

export function buildFeedsSection(host: SettingsDialogSectionsHost): HTMLElement {
    const root = section('Feeds');
    root.append(feedActions(host), opmlFileInput(host));
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

export function buildAboutSection(host: SettingsDialogSectionsHost): HTMLElement {
    const root = section('About');
    const built = BUILD_TIME ? new Date(BUILD_TIME).toLocaleDateString() : '';
    root.append(hint(`Version ${APP_VERSION} · ${APP_COMMIT}${built ? ` · ${built}` : ''}`, 'about-meta'));
    const actions = el('div', 'view-actions');
    actions.append(button('btn', host.showHistory ? 'Hide version history' : "What's new", () => host.toggleHistory()));
    root.append(actions);
    if (host.showHistory) root.append(historyList());
    return root;
}
