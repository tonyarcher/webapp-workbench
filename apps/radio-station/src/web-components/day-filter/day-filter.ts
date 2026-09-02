import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import type {DayFilter} from '../../types';
import styles from './day-filter.css?inline';

@customElement('rs-day-filter')
export class DayFilterBar extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({attribute: false}) days: {key: string; label: string}[] = [];
    @property() selected: DayFilter = 'all';

    private emitDay(day: DayFilter): void {
        this.dispatchEvent(new CustomEvent('day-change', {detail: day, bubbles: true, composed: true}));
    }

    private chip(day: DayFilter, label: string): TemplateResult {
        const on = this.selected === day;
        return html`
            <button
                class="chip ${on ? 'on' : ''}"
                type="button"
                aria-pressed=${on}
                @click=${() => this.emitDay(day)}
            >${label}</button>
        `;
    }

    override render(): TemplateResult {
        return html`
            <div class="chips" aria-label="Filter by day">
                ${this.chip('all', 'All')}
                ${this.days.map((day) => this.chip(day.key, day.label))}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'rs-day-filter': DayFilterBar;
    }
}
