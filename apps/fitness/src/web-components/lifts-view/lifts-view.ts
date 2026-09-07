import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
    LIFTS,
    TEMPLATES,
    WEEK_ORDER,
    kgToLb,
    lbToKg,
    planLift,
    platesForLoad,
    type DisplayUnit,
    type LiftId,
    type TemplateId,
    type WeekKind,
} from 'fitness-core';
import {fetchProfile, saveProfile} from '../../services/api';
import type {Profile} from '../../types';
import styles from './lifts-view.css?inline';

@customElement('ft-lifts-view')
export class LiftsView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private profile: Profile | null = null;
    @state() private lift: LiftId = 'squat';
    @state() private week: WeekKind = '5s';
    @state() private template: TemplateId = 'bbb';
    @state() private display: DisplayUnit = 'kg';
    @state() private tmInput = '';
    @state() private error = '';
    @state() private saved = false;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.load();
    }

    private async load(): Promise<void> {
        try {
            const profile = await fetchProfile();
            this.profile = profile;
            this.display = profile.displayUnit;
            const tm = profile.tm[this.lift];
            this.tmInput = tm == null ? '' : this.display === 'lb' ? String(Math.round(kgToLb(tm))) : String(tm);
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private tmKg(): number {
        const n = Number(this.tmInput);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return this.display === 'lb' ? lbToKg(n) : n;
    }

    private onLift(event: Event): void {
        this.lift = (event.target as HTMLSelectElement).value as LiftId;
        const tm = this.profile?.tm[this.lift];
        this.tmInput = tm == null ? this.tmInput : this.display === 'lb' ? String(Math.round(kgToLb(tm))) : String(tm);
    }

    private async persist(): Promise<void> {
        if (!this.profile) {
            this.profile = {sex: null, birthYear: null, heightM: null, displayUnit: this.display, tm: {squat: null, bench: null, deadlift: null, press: null}};
        }
        const tmKg = this.tmKg();
        const next: Profile = {
            ...this.profile,
            displayUnit: this.display,
            tm: {...this.profile.tm, [this.lift]: tmKg || null},
        };
        this.error = '';
        this.saved = false;
        try {
            this.profile = await saveProfile(next);
            this.saved = true;
        } catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
    }

    private onTmInput = (event: Event): void => {
        this.tmInput = (event.target as HTMLInputElement).value;
    };

    private onWeek = (event: Event): void => {
        this.week = (event.target as HTMLSelectElement).value as WeekKind;
    };

    private onTemplate = (event: Event): void => {
        this.template = (event.target as HTMLSelectElement).value as TemplateId;
    };

    private toggleDisplay = (): void => {
        this.display = this.display === 'kg' ? 'lb' : 'kg';
        const n = Number(this.tmInput);
        if (!Number.isFinite(n) || n <= 0) return;
        this.tmInput = this.display === 'lb' ? String(Math.round(kgToLb(n))) : String(Math.round(lbToKg(n) * 10) / 10);
    };

    private renderSets(): TemplateResult {
        const tmKg = this.tmKg();
        if (tmKg <= 0) return html`<p class="help">Enter a training max to see the wave.</p>`;
        const sets = planLift({lift: this.lift, tmKg, week: this.week, template: this.template, display: this.display});
        return html`<table class="table">
            <thead><tr><th>Slot</th><th>%</th><th>Reps</th><th>Load</th><th>Plates / side</th></tr></thead>
            <tbody>
                ${sets.map((s) => {
                    const plates = platesForLoad(s.weightKg, this.display);
                    const load = this.display === 'lb' ? `${Math.round(kgToLb(s.weightKg))} lb` : `${s.weightKg} kg`;
                    return html`<tr>
                        <td>${s.slot}</td>
                        <td>${Math.round(s.pct * 100)}</td>
                        <td>${s.reps}${s.amrap ? '+' : ''}</td>
                        <td>${load}</td>
                        <td>${plates.plates.join(' + ') || 'bar'}</td>
                    </tr>`;
                })}
            </tbody>
        </table>`;
    }

    private renderForm(): TemplateResult {
        return html`<div class="row">
            <label>Lift
                <select @change=${this.onLift}>
                    ${LIFTS.map((id) => html`<option value=${id} ?selected=${id === this.lift}>${id}</option>`)}
                </select>
            </label>
            <label>TM (${this.display})
                <input type="number" .value=${this.tmInput} @input=${this.onTmInput}>
            </label>
            <label>Week
                <select @change=${this.onWeek}>
                    ${WEEK_ORDER.map((w) => html`<option value=${w} ?selected=${w === this.week}>${w}</option>`)}
                </select>
            </label>
            <label>Template
                <select @change=${this.onTemplate}>
                    ${TEMPLATES.map((t) => html`<option value=${t.id} ?selected=${t.id === this.template}>${t.label}</option>`)}
                </select>
            </label>
            <button class="btn" @click=${this.toggleDisplay}>${this.display}</button>
            <button class="btn primary" @click=${() => void this.persist()}>Save TM</button>
        </div>`;
    }

    override render(): TemplateResult {
        return html`
            <div class="page">
                <h1 class="title">5/3/1</h1>
                <p class="help">Training max, week, and template. Loads round to 5 lb or 2.5 kg.</p>
                ${this.renderForm()}
                ${this.error ? html`<p class="error">${this.error}</p>` : html``}
                ${this.saved ? html`<p class="ok">Saved.</p>` : html``}
                ${this.renderSets()}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-lifts-view': LiftsView;
    }
}
