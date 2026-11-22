import { navigate, viewToPath } from '../../router';
import type { SettingsSection } from '../../types';
import { searchSettings, type SettingEntry } from './settings-index';
import '../settings-general/settings-general';
import '../organize-view/organize-view';
import '../mute-filters-view/mute-filters-view';
import '../privacy-view/privacy-view';
import '../ai-connections-view/ai-connections-view';
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
    { id: 'ai-connections', label: 'AI connections', tag: 'ai-connections-view' },
    { id: 'stats', label: 'Stats', tag: 'stats-view' },
    { id: 'glossary', label: 'Glossary', tag: 'glossary-view' },
];

function specOf(section: SettingsSection): SectionSpec {
    return SECTIONS.find((entry) => entry.id === section) ?? SECTIONS[0]!;
}

/**
 * One settings page with a tab strip and a live filter. Typing replaces the
 * panel with a list of matching settings; each result links to its tab and
 * focuses the control. Only the active panel is mounted, so a tab that loads
 * data pays for it when opened, not when the app starts.
 */
export class SettingsView extends HTMLElement {
    private _section: SettingsSection = 'general';
    private root: HTMLElement | null = null;
    private panelHost: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private activeTag = '';
    private tabLinks: Array<[SettingsSection, HTMLAnchorElement]> = [];
    private filterInput: HTMLInputElement | null = null;
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
        bar.append(tabs, this.buildFilter());
        const content = document.createElement('div');
        content.className = 'content';
        const panel = document.createElement('div');
        panel.className = 'panel';
        const results = document.createElement('div');
        results.className = 'results';
        results.id = 'settings-results';
        results.hidden = true;
        results.addEventListener('keydown', (event) => this.onFilterKey(event));
        content.append(panel, results);
        root.append(bar, content);
        shadow.append(style, root);
        this.root = root;
        this.panelHost = panel;
        this.resultsEl = results;
    }

    private buildFilter(): HTMLElement {
        const form = document.createElement('form');
        form.className = 'settings-filter';
        form.setAttribute('role', 'search');
        form.addEventListener('submit', (event) => event.preventDefault());
        const input = document.createElement('input');
        input.type = 'search';
        input.id = 'settings-search-input';
        input.placeholder = 'Filter settings';
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'Filter settings');
        input.addEventListener('input', () => this.onFilterInput());
        input.addEventListener('keydown', (event) => this.onFilterKey(event));
        const status = document.createElement('p');
        status.className = 'sr-only';
        status.setAttribute('role', 'status');
        form.append(input, status);
        this.filterInput = input;
        this.statusEl = status;
        return form;
    }

    /** Filtering is live: every keystroke repaints the result list in place. */
    private onFilterInput(): void {
        const query = this.filterInput?.value.trim() ?? '';
        this.results = query === '' ? [] : searchSettings(query);
        this.activeResult = this.results.length > 0 ? 0 : -1;
        this.renderResults(query);
    }

    private onFilterKey(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.clearFilter();
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

    private renderResults(query: string): void {
        if (!this.resultsEl || !this.panelHost || !this.statusEl) return;
        this.resultLinks = [];
        this.resultsEl.replaceChildren();
        if (query === '') {
            this.resultsEl.hidden = true;
            this.panelHost.hidden = false;
            this.statusEl.textContent = '';
            return;
        }
        this.panelHost.hidden = true;
        this.resultsEl.hidden = false;
        const heading = document.createElement('h2');
        heading.textContent = 'Filtered settings';
        const count = document.createElement('p');
        count.className = 'count';
        count.textContent = `${this.results.length} ${this.results.length === 1 ? 'setting' : 'settings'} matching “${query}”`;
        this.resultsEl.append(heading, count);
        if (this.results.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'No settings match. Try a shorter word.';
            this.resultsEl.append(empty);
            this.statusEl.textContent = 'No settings match.';
            return;
        }
        const list = document.createElement('ul');
        list.className = 'list';
        for (const entry of this.results) {
            const item = document.createElement('li');
            item.className = 'result';
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
        this.statusEl.textContent = `${this.results.length} ${this.results.length === 1 ? 'setting' : 'settings'} found`;
    }

    private clearFilter(focus = true): void {
        if (this.filterInput) this.filterInput.value = '';
        this.results = [];
        this.activeResult = -1;
        this.renderResults('');
        if (focus) this.filterInput?.focus();
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
        this.clearFilter(false);
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
            this.clearFilter(false);
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
