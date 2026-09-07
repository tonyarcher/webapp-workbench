import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {
    formatSi,
    linearSlope,
    metricLabel,
    parseMetricId,
    pctChange,
    toSi,
    trendAdvice,
    type DisplayUnit,
    type MetricId,
} from 'fitness-core';
import {fetchProfile, fetchSeries, patchSample} from '../../services/api';
import {displaySeries} from '../../services/chart-data';
import type {SeriesOrigin, SeriesResult} from '../../types';
import '../chart/chart';
import styles from './chart-view.css?inline';

@customElement('ft-chart-view')
export class ChartView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() metric = '';

    @state() private series: SeriesResult | null = null;
    @state() private display: DisplayUnit = 'kg';
    @state() private error = '';
    @state() private editOrigin = '';
    @state() private editValue = '';

    override updated(changed: Map<string, unknown>): void {
        super.updated(changed);
        if (changed.has('metric')) void this.reload();
    }

    private async reload(): Promise<void> {
        const id = parseMetricId(this.metric);
        if (!id) {
            this.error = 'unknown metric';
            return;
        }
        try {
            const [series, profile] = await Promise.all([fetchSeries(id), fetchProfile()]);
            this.series = series;
            this.display = profile.displayUnit;
            this.error = '';
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private metricId(): MetricId | null {
        return parseMetricId(this.metric);
    }

    private async hide(originId: string): Promise<void> {
        const id = this.metricId();
        if (!id) return;
        await patchSample({metric: id, originId, hidden: true});
        await this.reload();
    }

    private startEdit(row: SeriesOrigin): void {
        const id = this.metricId();
        if (!id) return;
        const shown = formatSi(id, row.valueSi, this.display);
        this.editOrigin = row.originId;
        this.editValue = String(shown.value);
    }

    private async saveEdit(): Promise<void> {
        const id = this.metricId();
        const n = Number(this.editValue);
        if (!id || !this.editOrigin || !Number.isFinite(n)) return;
        const shown = formatSi(id, 1, this.display);
        const valueSi = toSi(id, n, shown.unit);
        if (valueSi == null) {
            this.error = 'bad override unit';
            return;
        }
        await patchSample({metric: id, originId: this.editOrigin, valueSi});
        this.editOrigin = '';
        await this.reload();
    }

    private renderRows(): TemplateResult {
        const id = this.metricId();
        const origins = this.series?.origins ?? [];
        if (!id || !origins.length) return html``;
        return html`<table class="table">
            <thead><tr><th>When</th><th>Value</th><th>Source</th><th></th></tr></thead>
            <tbody>
                ${origins.map((row) => {
                    const shown = formatSi(id, row.valueSi, this.display);
                    return html`<tr>
                        <td>${new Date(row.t).toISOString().slice(0, 16)}</td>
                        <td>${shown.value.toFixed(2)} ${shown.unit}</td>
                        <td>${row.source}</td>
                        <td>
                            <button class="btn" @click=${() => this.startEdit(row)}>Edit</button>
                            <button class="btn" @click=${() => void this.hide(row.originId)}>Hide</button>
                        </td>
                    </tr>`;
                })}
            </tbody>
        </table>`;
    }

    override render(): TemplateResult {
        const id = this.metricId();
        const points = this.series?.points ?? [];
        const series = id && points.length ? displaySeries(id, points, this.display) : {xs: [], ys: [], fmt: ''};
        const advice = id ? trendAdvice(id, linearSlope(points), pctChange(points), points.length) : null;
        return html`
            <div class="page">
                <a class="back" href="#/dashboard">← dashboard</a>
                <h1 class="title">${metricLabel(this.metric)}</h1>
                ${this.error ? html`<p class="error">${this.error}</p>` : html``}
                ${advice ? html`<p class="advice">${advice}</p>` : html``}
                <ft-chart .xs=${series.xs} .ys=${series.ys} title=${metricLabel(this.metric)} fmt=${series.fmt}></ft-chart>
                <p class="help">Hover the chart for exact values. Edit/hide overrides imported points without deleting them.</p>
                ${this.editOrigin
                    ? html`<div class="row">
                        <input type="number" .value=${this.editValue} @input=${(e: Event) => {
                            this.editValue = (e.target as HTMLInputElement).value;
                        }}>
                        <button class="btn primary" @click=${() => void this.saveEdit()}>Save override</button>
                    </div>`
                    : html``}
                ${this.renderRows()}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-chart-view': ChartView;
    }
}
