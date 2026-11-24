import { fetchLibrary } from '../../query';
import { deriveHealth, type FeedHealthRow } from '../../services/feed-health';
import { refreshFeed } from '../../mutations';
import { el } from './health-view-dom';
import styles from './health-view.css?inline';

/** Feed health dashboard: derived from library data, no automatic removal. */
export class HealthView extends HTMLElement {
    private rows: FeedHealthRow[] = [];
    private loading = true;
    private status = '';
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
            const lib = await fetchLibrary();
            if (gen !== this.generation || !this.isConnected) return;
            this.rows = deriveHealth(lib.feeds);
        } catch {
            if (gen !== this.generation || !this.isConnected) return;
            this.rows = [];
            this.status = 'Could not load feed health.';
        }
        this.loading = false;
        this.paint();
    }

    private async refresh(feedId: string): Promise<void> {
        try {
            await refreshFeed(feedId);
            this.status = 'Refresh queued.';
            await this.load();
        } catch {
            this.status = 'Could not queue a refresh.';
        }
        this.paint();
    }

    private paint(): void {
        if (!this.root) return;
        const toolbar = el('div', 'toolbar');
        toolbar.appendChild(el('h2', undefined, 'Feed health'));
        const body = el('div', 'body');
        body.tabIndex = 0;
        if (this.loading) {
            body.appendChild(el('div', 'empty', 'Loading…'));
        } else if (!this.rows.length) {
            body.appendChild(el('div', 'empty', this.status || 'No feeds yet.'));
        } else {
            const counts = { ok: 0, stale: 0, unreachable: 0 };
            for (const row of this.rows) counts[row.kind] += 1;
            const summary = el('div', 'summary');
            summary.appendChild(el('span', 'summary-ok', `${counts.ok} healthy`));
            summary.appendChild(el('span', 'summary-stale', `${counts.stale} stale`));
            summary.appendChild(el('span', 'summary-bad', `${counts.unreachable} unreachable`));
            body.appendChild(summary);
            const list = el('ul', 'list');
            for (const row of this.rows) {
                const li = el('li', `row ${row.kind}`);
                const top = el('div', 'row-top');
                top.appendChild(el('span', 'status-dot'));
                top.appendChild(el('span', 'feed-title', row.feed.title));
                const refresh = el('button', 'btn', 'Refresh');
                refresh.setAttribute('aria-label', `Refresh ${row.feed.title}`);
                refresh.addEventListener('click', () => void this.refresh(row.feed.id));
                top.appendChild(refresh);
                li.appendChild(top);
                li.appendChild(el('div', 'suggestion', row.suggestion));
                const age = row.ageDays === null ? 'never fetched' : `${row.ageDays} days since fetch`;
                li.appendChild(el('div', 'meta', `${age}${row.feed.lastError ? ' · last fetch failed' : ''}`));
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
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'health-view': HealthView;
    }
}

customElements.define('health-view', HealthView);
