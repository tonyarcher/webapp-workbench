import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import styles from './progress-bar.css?inline';

@customElement('cal-progress-bar')
export class ProgressBar extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({type: Number}) done = 0;
    @property({type: Number}) total = 0;
    @property({type: Number}) failed = 0;
    @property() label = '';

    override render(): TemplateResult {
        const total = this.total;
        const done = this.done;
        const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
        const count = total > 0 ? `${done} / ${total} events` : `${done} events`;
        return html`
            <div class="wrap" role="progressbar" aria-valuemin="0" aria-valuemax=${total || 0} aria-valuenow=${done}>
                <div class="meta">
                    <span class="count">${count}</span>
                    ${this.failed > 0 ? html`<span class="failed">${this.failed} failed</span>` : html``}
                </div>
                <div class="track">
                    <div class="fill" style="width: ${pct}%"></div>
                </div>
                ${this.label ? html`<p class="label">${this.label}</p>` : html``}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cal-progress-bar': ProgressBar;
    }
}
