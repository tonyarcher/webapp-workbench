import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
    CHARTS,
    bmiSeries,
    formatSi,
    linearSlope,
    metricLabel,
    navyBfSeries,
    pctChange,
    rollupKind,
    trendAdvice,
    whtrSeries,
    type DisplayUnit,
    type MetricId,
    type Point,
} from 'fitness-core';
import {fetchHealth, fetchLatest, fetchProfile, fetchRollups} from '../../services/api';
import {displaySeries, rollupPoints} from '../../services/chart-data';
import type {LatestSample, Profile, RollupRow} from '../../types';
import '../chart/chart';
import styles from './dashboard-view.css?inline';

@customElement('ft-dashboard-view')
export class DashboardView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private apiOk = false;
    @state() private error = '';
    @state() private rollups: RollupRow[] = [];
    @state() private latest: LatestSample[] = [];
    @state() private profile: Profile | null = null;
    @state() private display: DisplayUnit = 'kg';

    override connectedCallback(): void {
        super.connectedCallback();
        void this.reload();
    }

    private async reload(): Promise<void> {
        this.error = '';
        try {
            const [health, rollups, latest, profile] = await Promise.all([
                fetchHealth(),
                fetchRollups(),
                fetchLatest(),
                fetchProfile(),
            ]);
            this.apiOk = health.ok;
            this.rollups = rollups.rollups;
            this.latest = latest.latest;
            this.profile = profile;
            this.display = profile.displayUnit;
        } catch (err) {
            this.apiOk = false;
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private toggleDisplay = (): void => {
        this.display = this.display === 'kg' ? 'lb' : 'kg';
    };

    private openChart = (metric: string): void => {
        location.hash = `#/charts/${metric}`;
    };

    private pts(metric: MetricId): Point[] {
        return rollupPoints(this.rollups, metric, rollupKind(metric));
    }

    private renderRaw(metric: MetricId, title: string): TemplateResult {
        const points = this.pts(metric);
        if (points.length < 2) return html``;
        const series = displaySeries(metric, points, this.display);
        const advice = trendAdvice(metric, linearSlope(points), pctChange(points), points.length);
        return html`
            <button class="tile" @click=${() => this.openChart(metric)}>
                <ft-chart .xs=${series.xs} .ys=${series.ys} title=${title} fmt=${series.fmt}></ft-chart>
                ${advice ? html`<p class="advice">${advice}</p>` : html``}
            </button>
        `;
    }

    private renderCalc(): TemplateResult {
        const mass = this.pts('body_mass');
        const height = this.pts('height');
        const waist = this.pts('waist');
        const neck = this.pts('neck');
        const tiles: TemplateResult[] = [];
        const bmiPts = bmiSeries(mass, height);
        if (bmiPts.length >= 2) {
            tiles.push(html`<div class="tile">
                <ft-chart .xs=${bmiPts.map((p) => p.t / 1_000)} .ys=${bmiPts.map((p) => p.v)} title="BMI" fmt=""></ft-chart>
            </div>`);
        }
        const whtr = whtrSeries(waist, height);
        if (whtr.length >= 2) {
            tiles.push(html`<div class="tile">
                <ft-chart .xs=${whtr.map((p) => p.t / 1_000)} .ys=${whtr.map((p) => p.v)} title="Waist-to-height" fmt=""></ft-chart>
            </div>`);
        }
        const sex = this.profile?.sex;
        if (sex) {
            const navy = navyBfSeries(sex, height, neck, waist, this.pts('hip'));
            if (navy.length >= 2) {
                tiles.push(html`<div class="tile">
                    <ft-chart .xs=${navy.map((p) => p.t / 1_000)} .ys=${navy.map((p) => p.v)} title="Navy body fat" fmt="%"></ft-chart>
                </div>`);
            }
        }
        return html`${tiles}`;
    }

    private renderLatest(): TemplateResult {
        if (!this.latest.length) return html`<p class="empty">No samples yet. Import a Health Connect .db or log a measurement.</p>`;
        return html`<ul class="latest">
            ${this.latest.map((row) => {
                const shown = formatSi(row.metric as MetricId, row.valueSi, this.display);
                return html`<li>
                    <button class="link" @click=${() => this.openChart(row.metric)}>${metricLabel(row.metric)}</button>
                    ${shown.value.toFixed(2)} ${shown.unit}
                </li>`;
            })}
        </ul>`;
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
                <p class="help">Hover a chart for exact values. Click a tile for history and overrides. Not medical advice.</p>
                ${this.renderLatest()}
                <div class="grid">
                    ${CHARTS.map((c) => this.renderRaw(c.metric, c.label))}
                    ${this.renderCalc()}
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-dashboard-view': DashboardView;
    }
}
