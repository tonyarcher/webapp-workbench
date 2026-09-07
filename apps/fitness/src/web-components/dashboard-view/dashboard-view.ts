import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {formatSi, type DisplayUnit, type MetricId} from 'fitness-core';
import {fetchHealth, fetchLatest, fetchStats} from '../../services/api';
import type {LatestSample, MetricStat} from '../../types';
import styles from './dashboard-view.css?inline';

@customElement('ft-dashboard-view')
export class DashboardView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private apiOk = false;
    @state() private error = '';
    @state() private stats: MetricStat[] = [];
    @state() private latest: LatestSample[] = [];
    @state() private display: DisplayUnit = 'kg';

    override connectedCallback(): void {
        super.connectedCallback();
        void this.reload();
    }

    private async reload(): Promise<void> {
        this.error = '';
        try {
            const [health, stats, latest] = await Promise.all([fetchHealth(), fetchStats(), fetchLatest()]);
            this.apiOk = health.ok;
            this.stats = stats.metrics;
            this.latest = latest.latest;
        } catch (err) {
            this.apiOk = false;
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private formatLatest(row: LatestSample): string {
        try {
            const shown = formatSi(row.metric as MetricId, row.valueSi, this.display);
            return `${shown.value.toFixed(2)} ${shown.unit}`;
        } catch {
            return String(row.valueSi);
        }
    }

    private toggleDisplay = (): void => {
        this.display = this.display === 'kg' ? 'lb' : 'kg';
    };

    private renderTable(): TemplateResult {
        if (!this.stats.length) return html`<p class="empty">No samples yet. Import Health Connect JSON or CSV.</p>`;
        return html`<table class="table">
            <thead><tr><th>Metric</th><th>n</th><th>Latest</th></tr></thead>
            <tbody>
                ${this.stats.map((row) => {
                    const last = this.latest.find((s) => s.metric === row.metric);
                    return html`<tr>
                        <td>${row.metric}</td>
                        <td>${row.n}</td>
                        <td>${last ? this.formatLatest(last) : '—'}</td>
                    </tr>`;
                })}
            </tbody>
        </table>`;
    }

    override render(): TemplateResult {
        return html`
            <div class="page">
                <div class="head">
                    <h1 class="title">Dashboard</h1>
                    <button class="btn" @click=${this.toggleDisplay}>${this.display}</button>
                </div>
                <p class="status ${this.apiOk ? 'ok' : ''}">API ${this.apiOk ? 'connected' : 'offline'}</p>
                ${this.error ? html`<p class="error">${this.error}</p>` : html``}
                ${this.renderTable()}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-dashboard-view': DashboardView;
    }
}
