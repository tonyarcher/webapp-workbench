import { fetchLibrary } from '../../query';
import { fetchRecentCounts } from '../../services/api-alerts';
import { deleteFeed, refreshFeed } from '../../mutations';
import {
    deriveHealth,
    pruneSelection,
    removalMessage,
    viewHealth,
    type FeedHealthRow,
    type HealthKind,
    type HealthSort,
} from '../../services/feed-health';
import { el } from './health-view-dom';
import styles from './health-view.css?inline';

/** Feed health dashboard. Every change is explicit; no automatic removal. */
export class HealthView extends HTMLElement {
    private rows: FeedHealthRow[] = [];
    private loading = true;
    private status = '';
    private days = 30;
    private kind: HealthKind | 'all' = 'all';
    private maxRecent: number | null = null;
    private sort: HealthSort = 'status';
    private selected = new Set<string>();
    private root: HTMLDivElement | null = null;
    private generation = 0;

    connectedCallback(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = el('div', 'view');
        shadow.appendChild(this.root);
        void this.load();
    }

    disconnectedCallback(): void {
        this.generation++;
    }

    private async load(): Promise<void> {
        const gen = ++this.generation;
        this.loading = true;
        this.paint();
        try {
            const [lib, recent] = await Promise.all([fetchLibrary(), fetchRecentCounts(this.days)]);
            if (gen !== this.generation || !this.isConnected) return;
            this.rows = deriveHealth(lib.feeds, recent.feeds);
            this.selected = pruneSelection(this.selected, lib.feeds);
        } catch {
            if (gen !== this.generation || !this.isConnected) return;
            this.rows = [];
            this.status = 'Could not load feed health.';
        }
        this.loading = false;
        this.paint();
    }

    private visible(): FeedHealthRow[] {
        return viewHealth(this.rows, { kind: this.kind, maxRecent: this.maxRecent, sort: this.sort });
    }

    private focusKey: string | null = null;

    private select(
        label: string,
        options: Array<[string, string]>,
        value: string,
        onChange: (value: string) => void,
    ): HTMLElement {
        const wrap = el('label', 'filter');
        wrap.appendChild(document.createTextNode(label));
        const select = el('select');
        select.dataset['focusKey'] = label;
        select.setAttribute('aria-label', label);
        for (const [v, text] of options) {
            const option = el('option', undefined, text);
            option.value = v;
            select.appendChild(option);
        }
        select.value = value;
        select.addEventListener('change', () => onChange(select.value));
        wrap.appendChild(select);
        return wrap;
    }

    private async refresh(feedId: string): Promise<void> {
        try {
            await refreshFeed(feedId);
            this.status = 'Refresh queued.';
            await this.load();
        } catch {
            this.status = 'Could not queue a refresh.';
            this.paint();
        }
    }

    private async removeFeed(row: FeedHealthRow): Promise<void> {
        if (!window.confirm(`Remove "${row.feed.title}" and its saved articles? This cannot be undone.`)) return;
        try {
            await deleteFeed(row.feed.id);
            this.status = `Removed ${row.feed.title}.`;
            await this.load();
        } catch {
            this.status = `Could not remove ${row.feed.title}.`;
            this.paint();
        }
    }

    private async removeSelected(): Promise<void> {
        const ids = [...this.selected];
        if (!ids.length) return;
        const titles = ids.map((id) => this.rows.find((r) => r.feed.id === id)?.feed.title ?? id);
        if (!window.confirm(removalMessage(titles))) return;
        let removed = 0;
        for (const id of ids) {
            try {
                await deleteFeed(id);
                removed += 1;
            } catch {
                // Report partial success; the remaining rows stay selectable.
            }
        }
        this.selected = new Set();
        this.status = `Removed ${removed} of ${ids.length} feeds.`;
        this.root?.querySelector<HTMLElement>(':focus')?.blur();
        this.focusKey = 'health-body';
        await this.load();
    }

    private paint(): void {
        if (!this.root) return;
        // Remember the focused filter before replaceChildren discards the node;
        // restore it after every paint, including the one after an async load.
        this.focusKey = this.root.querySelector<HTMLElement>(':focus')?.dataset['focusKey'] ?? this.focusKey;
        const toolbar = el('div', 'toolbar');
        toolbar.appendChild(el('h2', undefined, 'Feed health'));
        toolbar.appendChild(
            this.select(
                'Window',
                [
                    ['7', '7 days'],
                    ['30', '30 days'],
                    ['60', '2 months'],
                    ['90', '3 months'],
                ],
                String(this.days),
                (v) => {
                    this.days = Number(v);
                    void this.load();
                },
            ),
        );

        const body = el('div', 'body');
        body.dataset['focusKey'] = 'health-body';
        body.tabIndex = 0;
        if (this.loading) {
            body.appendChild(el('div', 'empty', 'Loading…'));
        } else if (!this.rows.length) {
            body.appendChild(el('div', 'empty', this.status || 'No feeds yet.'));
        } else {
            const filters = el('div', 'filters');
            filters.appendChild(
                this.select(
                    'Status',
                    [
                        ['all', 'All'],
                        ['ok', 'Healthy'],
                        ['stale', 'Stale'],
                        ['unreachable', 'Unreachable'],
                    ],
                    this.kind,
                    (v) => {
                        this.kind = v as HealthKind | 'all';
                        this.paint();
                    },
                ),
            );
            filters.appendChild(
                this.select(
                    'Volume',
                    [
                        ['all', 'Any volume'],
                        ['1', 'At most 1 article'],
                        ['3', 'At most 3 articles'],
                        ['5', 'At most 5 articles'],
                        ['10', 'At most 10 articles'],
                    ],
                    this.maxRecent === null ? 'all' : String(this.maxRecent),
                    (v) => {
                        this.maxRecent = v === 'all' ? null : Number(v);
                        this.paint();
                    },
                ),
            );
            filters.appendChild(
                this.select(
                    'Sort',
                    [
                        ['status', 'Status'],
                        ['recent', 'Fewest articles'],
                        ['age', 'Oldest fetch'],
                        ['name', 'Name'],
                    ],
                    this.sort,
                    (v) => {
                        this.sort = v as HealthSort;
                        this.paint();
                    },
                ),
            );
            body.appendChild(filters);

            const shown = this.visible();
            const bulk = el('div', 'bulk-actions');
            const all = el('input');
            all.type = 'checkbox';
            all.id = 'select-all';
            all.checked = shown.length > 0 && shown.every((r) => this.selected.has(r.feed.id));
            all.indeterminate = !all.checked && shown.some((r) => this.selected.has(r.feed.id));
            all.setAttribute('aria-label', 'Select all shown feeds');
            all.addEventListener('change', () => {
                for (const row of shown) {
                    if (all.checked) this.selected.add(row.feed.id);
                    else this.selected.delete(row.feed.id);
                }
                this.paint();
            });
            const allLabel = el('label', 'bulk-label');
            all.dataset['focusKey'] = 'select-all';
            allLabel.append(all, document.createTextNode(' Select all shown'));
            bulk.appendChild(allLabel);
            const removeSelected = el('button', 'btn danger', `Remove selected (${this.selected.size})`);
            removeSelected.disabled = this.selected.size === 0;
            removeSelected.dataset['focusKey'] = 'remove-selected';
            removeSelected.addEventListener('click', () => void this.removeSelected());
            bulk.appendChild(removeSelected);
            body.appendChild(bulk);

            const summary = el('div', 'summary');
            summary.appendChild(el('span', 'summary-ok', `${shown.length} shown of ${this.rows.length}`));
            body.appendChild(summary);
            if (!shown.length) {
                body.appendChild(el('div', 'empty', 'No feeds match these filters.'));
            }
            const list = el('ul', 'list');
            for (const row of shown) {
                const li = el('li', `row ${row.kind}`);
                const box = el('input', 'row-select');
                box.type = 'checkbox';
                box.checked = this.selected.has(row.feed.id);
                box.dataset['focusKey'] = `select:${row.feed.id}`;
                box.setAttribute('aria-label', `Select ${row.feed.title}`);
                box.addEventListener('change', () => {
                    if (box.checked) this.selected.add(row.feed.id);
                    else this.selected.delete(row.feed.id);
                    this.paint();
                });
                li.appendChild(box);
                const content = el('div', 'row-content');
                const top = el('div', 'row-top');
                top.appendChild(el('span', 'status-dot'));
                top.appendChild(el('span', 'feed-title', row.feed.title));
                const refresh = el('button', 'btn', 'Refresh');
                refresh.setAttribute('aria-label', `Refresh ${row.feed.title}`);
                refresh.addEventListener('click', () => void this.refresh(row.feed.id));
                const remove = el('button', 'btn danger', 'Remove');
                remove.setAttribute('aria-label', `Remove ${row.feed.title}`);
                remove.addEventListener('click', () => void this.removeFeed(row));
                top.append(refresh, remove);
                const age = row.ageDays === null ? 'never fetched' : `${row.ageDays} days since fetch`;
                content.append(
                    top,
                    el('div', 'suggestion', row.suggestion),
                    el(
                        'div',
                        'meta',
                        `${row.recent} article${row.recent === 1 ? '' : 's'} in ${this.days} days · ${age}`,
                    ),
                );
                li.appendChild(content);
                list.appendChild(li);
            }
            body.appendChild(list);
        }
        if (this.status && !this.loading && this.rows.length) {
            const status = el('p', 'status', this.status);
            status.setAttribute('role', 'status');
            body.appendChild(status);
        }
        this.root.replaceChildren(toolbar, body);
        if (this.focusKey) {
            const next = this.root.querySelector<HTMLElement>(`[data-focus-key="${this.focusKey}"]`);
            if (next) {
                next.focus();
                this.focusKey = null;
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'health-view': HealthView;
    }
}

customElements.define('health-view', HealthView);
