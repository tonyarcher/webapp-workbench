import { navigate, viewToPath } from '../../router';
import type { SettingsSection, View } from '../../types';
import { searchSettings, type SettingEntry } from './settings-index';
import '../settings-general/settings-general';
import '../organize-view/organize-view';
import '../mute-filters-view/mute-filters-view';
import '../privacy-view/privacy-view';
import '../stats-view/stats-view';
import '../glossary-view/glossary-view';
import styles from './settings-view.css?inline';

interface SectionSpec {
    id: SettingsSection;
    label: string;
    tag: string;
}

/**
 * The tabs of the settings area. Every entry is a real route, so the browser's
 * back button, a bookmark, and the command palette all reach the same panel.
 * Old top-level routes (`#/organize`, `#/privacy`) are parsed to these by the
 * router, so a saved link keeps working.
 */
const SECTIONS: readonly SectionSpec[] = [
    { id: 'general', label: 'General', tag: 'settings-general' },
    { id: 'organize', label: 'Organize', tag: 'organize-view' },
    { id: 'mute-filters', label: 'Mute filters', tag: 'mute-filters-view' },
    { id: 'privacy', label: 'Privacy', tag: 'privacy-view' },
    { id: 'stats', label: 'Stats', tag: 'stats-view' },
    { id: 'glossary', label: 'Glossary', tag: 'glossary-view' },
];

function specOf(section: SettingsSection): SectionSpec {
    return SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0]!;
}

/**
 * One settings page with a tab strip and a search that jumps to a setting.
 * Only the active panel is mounted, so a tab that loads data pays for it when
 * opened, not when the app starts.
 */
export class SettingsView extends HTMLElement {
    private _section: SettingsSection = 'general';
    private _view: View = { kind: 'all' };
    private root: HTMLElement | null = null;
    private panelHost: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private activeTag = '';
    private tabLinks: Array<[SettingsSection, HTMLAnchorElement]> = [];
    private searchInput: HTMLInputElement | null = null;
    private resultsEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;
    private results: SettingEntry[] = [];
    private resultLinks: HTMLAnchorElement[] = [];
    private activeResult = -1;
    /** Selector to focus once the destination panel has mounted. */
    private pendingFocus: string | null = null;

    get section(): SettingsSection {
        return this._section;
    }

    set section(value: SettingsSection) {
        if (value === this._section) return;
        this._section = value;
        this.paint();
    }

    get view(): View {
        return this._view;
    }

    set view(value: View) {
        this._view = value;
        if (this.panel !== null && this.activeTag === 'settings-general') {
            (this.panel as HTMLElement & { view: View }).view = value;
        }
    }

    connectedCallback(): void {
        if (!this.root) this.build();
        this.paint();
    }

    private build(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        const root = document.createElement('div');
        root.className = 'settings';
        const bar = document.createElement('div');
        bar.className = 'bar';
        const tabs = document.createElement('nav');
        tabs.className = 'tabs';
        tabs.setAttribute('aria-label', 'Settings sections');
        for (const entry of SECTIONS) {
            const link = this.tab(entry);
            this.tabLinks.push([entry.id, link]);
            tabs.append(link);
        }
        bar.append(tabs, this.buildSearch());
        const panel = document.createElement('div');
        panel.className = 'panel';
        root.append(bar, panel);
        shadow.append(style, root);
        this.root = root;
        this.panelHost = panel;
    }

    private buildSearch(): HTMLElement {
        const form = document.createElement('form');
        form.className = 'settings-search';
        form.setAttribute('role', 'search');
        form.addEventListener('submit', (event) => event.preventDefault());
        const input = document.createElement('input');
        input.type = 'search';
        input.id = 'settings-search-input';
        input.placeholder = 'Search settings';
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'Search settings');
        input.addEventListener('input', () => this.onSearchInput());
        input.addEventListener('keydown', (event) => this.onSearchKey(event));
        const results = document.createElement('div');
        results.className = 'results';
        results.id = 'settings-results';
        results.hidden = true;
        results.addEventListener('keydown', (event) => this.onSearchKey(event));
        const status = document.createElement('p');
        status.className = 'sr-only';
        status.setAttribute('role', 'status');
        form.append(input, results, status);
        this.searchInput = input;
        this.resultsEl = results;
        this.statusEl = status;
        return form;
    }

    private onSearchInput(): void {
        const query = this.searchInput?.value.trim() ?? '';
        this.results = query === '' ? [] : searchSettings(query);
        this.activeResult = this.results.length > 0 ? 0 : -1;
        this.renderResults();
    }

    private onSearchKey(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.clearSearch();
            return;
        }
        if (this.resultLinks.length === 0) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.activeResult = (this.activeResult + step + this.resultLinks.length) % this.resultLinks.length;
            this.resultLinks[this.activeResult]!.focus();
            return;
        }
        if (event.key === 'Enter') {
            // A focused result already has a click handler; Enter fires it.
            if (event.target instanceof HTMLAnchorElement) return;
            event.preventDefault();
            const entry = this.results[this.activeResult === -1 ? 0 : this.activeResult];
            if (entry) this.openEntry(entry);
        }
    }

    private renderResults(): void {
        if (!this.resultsEl || !this.searchInput || !this.statusEl) return;
        this.resultsEl.replaceChildren();
        this.resultLinks = [];
        if (this.results.length === 0) {
            this.resultsEl.hidden = true;
            this.statusEl.textContent = '';
            return;
        }
        const list = document.createElement('ul');
        for (const entry of this.results) {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${viewToPath({ kind: 'settings', section: entry.section })}`;
            link.textContent = entry.label;
            link.addEventListener('click', (event) => {
                event.preventDefault();
                this.openEntry(entry);
            });
            const tab = document.createElement('span');
            tab.className = 'result-tab';
            tab.textContent = specOf(entry.section).label;
            item.append(link, tab);
            list.append(item);
            this.resultLinks.push(link);
        }
        this.resultsEl.append(list);
        this.resultsEl.hidden = false;
        this.statusEl.textContent = `${this.results.length} ${this.results.length === 1 ? 'setting' : 'settings'} found`;
    }

    private clearSearch(): void {
        if (this.searchInput) this.searchInput.value = '';
        this.results = [];
        this.activeResult = -1;
        this.renderResults();
        this.searchInput?.focus();
    }

    /** Jump to the setting: change tab and URL, then focus its control. */
    private openEntry(entry: SettingEntry): void {
        this.pendingFocus = entry.target;
        if (entry.section !== this._section) {
            this.section = entry.section;
            // The shell re-renders from the route. Without a history update it
            // would set the old section back on the next paint.
            navigate({ kind: 'settings', section: entry.section });
        } else {
            this.paint();
        }
        this.clearSearch();
        requestAnimationFrame(() => this.revealPending());
    }

    private revealPending(): void {
        const target = this.pendingFocus;
        this.pendingFocus = null;
        if (target === null || this.panel === null) return;
        const root = this.panel.shadowRoot ?? this.panel;
        const node = root.querySelector<HTMLElement>(target);
        if (!node) return;
        node.scrollIntoView({ block: 'center' });
        node.focus({ preventScroll: true });
    }

    private paint(): void {
        if (!this.root || !this.panelHost) return;
        for (const [id, link] of this.tabLinks) {
            if (id === this._section) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        }
        const spec = specOf(this._section);
        if (this.activeTag !== spec.tag) {
            const next = document.createElement(spec.tag);
            this.panel?.remove();
            this.panel = next;
            this.activeTag = spec.tag;
            this.panelHost.append(next);
        }
        if (this.panel !== null && spec.tag === 'settings-general') {
            (this.panel as HTMLElement & { view: View }).view = this._view;
        }
    }

    /**
     * A link, so it has a context menu and an address that can be shared. A
     * plain click goes through the router instead of letting the browser change
     * the hash, because the shell subscribes to the router's history object.
     */
    private tab(entry: SectionSpec): HTMLAnchorElement {
        const link = document.createElement('a');
        link.className = 'tab';
        link.href = `#${viewToPath({ kind: 'settings', section: entry.id })}`;
        link.textContent = entry.label;
        link.addEventListener('click', (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey) return;
            if (event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            navigate({ kind: 'settings', section: entry.id });
        });
        return link;
    }
}

customElements.define('settings-view', SettingsView);

declare global {
    interface HTMLElementTagNameMap {
        'settings-view': SettingsView;
    }
}
