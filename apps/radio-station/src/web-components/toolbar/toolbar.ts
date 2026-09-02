import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {Weights} from '../../types';
import {DEFAULT_WEIGHTS} from '../../services/defaults';
import styles from './toolbar.css?inline';

export interface GenerateDetail {
    seed: string;
    weights: Weights;
}

const KNOBS: {key: keyof Weights; label: string; min: number; max: number; title: string}[] = [
    {key: 'hitGravity', label: 'Hit gravity', min: 0, max: 100, title: 'How hard currents dominate vs deeper recurrents'},
    {key: 'goldLeak', label: 'Gold leak', min: 0, max: 100, title: 'How often 90s/2000s gold interrupts the current clock'},
    {key: 'temperature', label: 'Temperature', min: 0, max: 100, title: 'How much rank can be ignored inside a bucket'},
    {key: 'separation', label: 'Separation', min: 0, max: 100, title: 'Artist and title anti-repeat distance'},
    {key: 'powerOrbitMin', label: 'Power orbit', min: 60, max: 150, title: 'Minutes between the #1 song'},
];

@customElement('rs-toolbar')
export class Toolbar extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() seed = '';
    @property({attribute: false}) weights: Weights = DEFAULT_WEIGHTS;
    @property({type: Boolean}) busy = false;
    @property({type: Boolean}) canExport = false;

    private emitGenerate(): void {
        const detail: GenerateDetail = {seed: this.seed.trim(), weights: this.weights};
        this.dispatchEvent(new CustomEvent('generate', {detail, bubbles: true, composed: true}));
    }

    private emitExport(): void {
        this.dispatchEvent(new CustomEvent('export', {bubbles: true, composed: true}));
    }

    private onSeedInput(event: Event): void {
        this.seed = (event.target as HTMLInputElement).value;
        this.emitChange();
    }

    private onKnobInput(key: keyof Weights, event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.weights = {...this.weights, [key]: value};
        this.emitChange();
    }

    private emitChange(): void {
        this.dispatchEvent(new CustomEvent('clock-change', {
            detail: {seed: this.seed, weights: this.weights},
            bubbles: true,
            composed: true,
        }));
    }

    private rollSeed(): void {
        this.seed = '';
        this.emitChange();
        this.emitGenerate();
    }

    private renderKnob(knob: (typeof KNOBS)[number]): TemplateResult {
        const value = this.weights[knob.key];
        return html`
            <label class="knob" title=${knob.title}>
                <span class="knob-label">${knob.label} <span class="knob-value">${value}</span></span>
                <input
                    type="range"
                    min=${knob.min}
                    max=${knob.max}
                    .value=${String(value)}
                    @input=${(event: Event) => this.onKnobInput(knob.key, event)}
                >
            </label>
        `;
    }

    override render(): TemplateResult {
        return html`
            <div class="bar">
                <div class="brand">
                    <span class="call">WPLS</span>
                    <span class="name">Pulse 101</span>
                    <span class="format">Top 40</span>
                </div>
                <label class="seed">
                    <span class="seed-label">Seed</span>
                    <input class="seed-input" type="text" placeholder="auto" .value=${this.seed} @input=${this.onSeedInput}>
                </label>
                <div class="knobs">${KNOBS.map((knob) => this.renderKnob(knob))}</div>
                <div class="actions">
                    <button class="ghost" type="button" ?disabled=${this.busy} @click=${this.rollSeed}>New seed</button>
                    <button class="primary" type="button" ?disabled=${this.busy} @click=${this.emitGenerate}>
                        ${this.busy ? 'Generating…' : 'Generate week'}
                    </button>
                    <button class="ghost" type="button" ?disabled=${!this.canExport || this.busy} @click=${this.emitExport}>Export .txt</button>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'rs-toolbar': Toolbar;
    }
}
