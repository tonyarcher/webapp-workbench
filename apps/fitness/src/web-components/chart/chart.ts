import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {ref} from 'lit/directives/ref.js';
import uPlot from 'uplot';
import styles from './chart.css?inline';

@customElement('ft-chart')
export class FtChart extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) xs: number[] = [];
    @property({attribute: false}) ys: number[] = [];
    @property() title = '';
    @property() fmt = '';

    private plot: uPlot | null = null;
    private hostEl: HTMLDivElement | null = null;

    private bindHost = (el: Element | undefined): void => {
        this.hostEl = el instanceof HTMLDivElement ? el : null;
        this.redraw();
    };

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.destroy();
    }

    override updated(): void {
        this.redraw();
    }

    private destroy(): void {
        this.plot?.destroy();
        this.plot = null;
    }

    private accent(): string {
        return getComputedStyle(this).getPropertyValue('--accent').trim() || '#6ee7b7';
    }

    private opts(width: number): uPlot.Options {
        const fmt = this.fmt;
        const stroke = this.accent();
        return {
            width,
            height: 180,
            cursor: {show: true},
            legend: {show: true, live: true},
            scales: {x: {time: true}},
            series: [
                {},
                {
                    label: this.title || 'value',
                    stroke,
                    width: 1.5,
                    value: (_u, v) => (v == null ? '—' : `${v.toFixed(2)}${fmt ? ` ${fmt}` : ''}`),
                },
            ],
        };
    }

    private redraw(): void {
        this.destroy();
        const host = this.hostEl;
        if (!host || this.xs.length < 2) return;
        const width = Math.max(280, host.clientWidth || 320);
        this.plot = new uPlot(this.opts(width), [this.xs, this.ys], host);
    }

    override render(): TemplateResult {
        const empty = this.xs.length < 2;
        return html`
            <div class="wrap">
                <h3 class="title">${this.title}</h3>
                ${empty ? html`<p class="empty">Need at least two points.</p>` : html``}
                <div class="plot" ${ref(this.bindHost)}></div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-chart': FtChart;
    }
}
