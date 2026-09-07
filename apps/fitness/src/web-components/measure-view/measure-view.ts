import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
    MEASURE_METRICS,
    formatSi,
    metricLabel,
    parseMetricId,
    toSi,
    type DisplayUnit,
    type MetricId,
    type Sample,
    type Sex,
} from 'fitness-core';
import {fetchLatest, fetchProfile, postImport, saveProfile} from '../../services/api';
import type {LatestSample, Profile} from '../../types';
import styles from './measure-view.css?inline';

@customElement('ft-measure-view')
export class MeasureView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private profile: Profile | null = null;
    @state() private latest: LatestSample[] = [];
    @state() private metric: MetricId = 'waist';
    @state() private value = '';
    @state() private unit = 'cm';
    @state() private error = '';
    @state() private saved = false;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.reload();
    }

    private display(): DisplayUnit {
        return this.profile?.displayUnit === 'lb' ? 'lb' : 'kg';
    }

    private async reload(): Promise<void> {
        try {
            const [profile, latest] = await Promise.all([fetchProfile(), fetchLatest()]);
            this.profile = profile;
            this.latest = latest.latest;
            this.unit = profile.displayUnit === 'lb' ? 'in' : 'cm';
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private latestOf(metric: MetricId): LatestSample | undefined {
        return this.latest.find((s) => s.metric === metric);
    }

    private shown(metric: MetricId): string {
        const row = this.latestOf(metric);
        if (metric === 'height' && !row && this.profile?.heightM != null) {
            const s = formatSi('height', this.profile.heightM, this.display());
            return `${s.value.toFixed(1)} ${s.unit}`;
        }
        if (!row) return '—';
        const s = formatSi(metric, row.valueSi, this.display());
        return `${s.value.toFixed(2)} ${s.unit}`;
    }

    private async saveSex(event: Event): Promise<void> {
        const sex = (event.target as HTMLSelectElement).value as Sex | '';
        const profile = this.profile ?? {
            sex: null,
            birthYear: null,
            heightM: null,
            displayUnit: 'kg',
            tm: {squat: null, bench: null, deadlift: null, press: null},
        };
        try {
            this.profile = await saveProfile({...profile, sex: sex === 'male' || sex === 'female' ? sex : null});
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private heightSample(heightM: number): Sample {
        return {
            metric: 'height',
            t: Date.now(),
            valueSi: heightM,
            source: 'manual',
            originId: `manual:height:${Date.now()}`,
        };
    }

    private async saveHeight(): Promise<void> {
        const n = Number(this.value);
        if (!this.profile || !this.value.trim() || !Number.isFinite(n) || n <= 0) return;
        const heightM = toSi('height', n, this.unit);
        if (heightM == null) {
            this.error = 'bad height unit';
            return;
        }
        try {
            this.profile = await saveProfile({...this.profile, heightM});
            await postImport([this.heightSample(heightM)], 'manual');
            this.saved = true;
            await this.reload();
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private async saveSample(): Promise<void> {
        const n = Number(this.value);
        const metric = parseMetricId(this.metric);
        if (!metric || !this.value.trim() || !Number.isFinite(n)) {
            this.error = 'need metric and value';
            return;
        }
        const valueSi = toSi(metric, n, this.unit);
        if (valueSi == null) {
            this.error = 'unknown unit for this metric';
            return;
        }
        const sample: Sample = {
            metric,
            t: Date.now(),
            valueSi,
            source: 'manual',
            originId: `manual:${metric}:${Date.now()}`,
        };
        this.error = '';
        this.saved = false;
        try {
            await postImport([sample], 'manual');
            this.saved = true;
            await this.reload();
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private onMetric = (event: Event): void => {
        this.metric = (event.target as HTMLSelectElement).value as MetricId;
    };

    private onValue = (event: Event): void => {
        this.value = (event.target as HTMLInputElement).value;
    };

    private onUnitText = (event: Event): void => {
        this.unit = (event.target as HTMLInputElement).value;
    };

    private onSave = (): void => {
        void (this.metric === 'height' ? this.saveHeight() : this.saveSample());
    };

    private openChart = (metric: MetricId): void => {
        location.hash = `#/charts/${metric}`;
    };

    private renderCard(metric: MetricId): TemplateResult {
        const row = this.latestOf(metric);
        const has = row != null || (metric === 'height' && this.profile?.heightM != null);
        const when = row ? new Date(row.t).toISOString().slice(0, 10) : '';
        return html`<button class="card ${has ? '' : 'empty'}" @click=${() => this.openChart(metric)}>
            <span class="card-label">${metricLabel(metric)}</span>
            <span class="card-value">${this.shown(metric)}</span>
            <span class="card-date">${when || (has ? 'saved' : 'not logged')}</span>
        </button>`;
    }

    private renderEntry(): TemplateResult {
        return html`<div class="row">
            <label>Metric
                <select @change=${this.onMetric}>
                    ${MEASURE_METRICS.map((m) => html`<option value=${m} ?selected=${m === this.metric}>${metricLabel(m)}</option>`)}
                </select>
            </label>
            <label>Value
                <input type="number" .value=${this.value} @input=${this.onValue}>
            </label>
            <label>Unit
                <input .value=${this.unit} @input=${this.onUnitText}>
            </label>
            <button class="btn primary" @click=${this.onSave}>Save</button>
        </div>`;
    }

    override render(): TemplateResult {
        return html`
            <div class="page">
                <h1 class="title">Measurements</h1>
                <p class="help">Latest values. Click a card for the chart and to edit history. Not medical advice.</p>
                <div class="row">
                    <label>Sex
                        <select @change=${(e: Event) => void this.saveSex(e)}>
                            <option value="" ?selected=${!this.profile?.sex}>unset</option>
                            <option value="male" ?selected=${this.profile?.sex === 'male'}>male</option>
                            <option value="female" ?selected=${this.profile?.sex === 'female'}>female</option>
                        </select>
                    </label>
                </div>
                <div class="cards">
                    ${MEASURE_METRICS.map((m) => this.renderCard(m))}
                </div>
                ${this.renderEntry()}
                ${this.error ? html`<p class="error">${this.error}</p>` : html``}
                ${this.saved ? html`<p class="ok">Saved.</p>` : html``}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-measure-view': MeasureView;
    }
}
