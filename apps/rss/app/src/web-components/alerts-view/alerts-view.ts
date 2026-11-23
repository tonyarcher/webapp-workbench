import { fetchAlerts, type AlertGroup } from '../../services/api-alerts';
import type { Article } from '../../types';
import { formatDate } from '../../util';
import { el } from './alerts-view-dom';
import styles from './alerts-view.css?inline';

/** A small in-app alerts inbox. Each hit deep-links to the source row. */
export class AlertsView extends HTMLElement {
    private root: HTMLDivElement | null = null;
    private groups: AlertGroup[] = [];
    private loading = true;
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
            const groups = await fetchAlerts();
            if (gen !== this.generation || !this.isConnected) return;
            this.groups = groups;
        } catch {
            if (gen !== this.generation || !this.isConnected) return;
            this.groups = [];
        }
        this.loading = false;
        this.paint();
    }

    private open(article: Article): void {
        const items = this.groups.flatMap((g) => g.hits);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index: items.findIndex((a) => a.id === article.id), items },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private paint(): void {
        if (!this.root) return;
        const toolbar = el('div', 'toolbar');
        toolbar.appendChild(el('h2', undefined, 'Alerts'));
        const body = el('div', 'body');
        body.tabIndex = 0;
        if (this.loading) {
            body.appendChild(el('div', 'empty', 'Loading…'));
        } else if (!this.groups.length) {
            body.appendChild(el('div', 'empty', 'No alerts yet. Flag a saved search as an alert to watch it here.'));
        } else {
            for (const group of this.groups) {
                const section = el('section', 'alert');
                const head = el('div', 'alert-head');
                head.appendChild(el('h3', undefined, group.title));
                head.appendChild(el('span', 'alert-count', `${group.hits.length} new`));
                section.appendChild(head);
                for (const hit of group.hits) {
                    const row = el('button', 'alert-hit');
                    row.appendChild(el('span', 'hit-title', hit.title));
                    row.appendChild(el('span', 'hit-date', formatDate(hit.published)));
                    row.addEventListener('click', () => this.open(hit));
                    section.appendChild(row);
                }
                body.appendChild(section);
            }
        }
        this.root.replaceChildren(toolbar, body);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'alerts-view': AlertsView;
    }
}

customElements.define('alerts-view', AlertsView);
