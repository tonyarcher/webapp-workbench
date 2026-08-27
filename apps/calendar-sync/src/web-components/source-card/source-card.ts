import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import styles from './source-card.css?inline';

@customElement('cal-source-card')
export class SourceCard extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() name = '';
    @property() help = '';
    @property() status = '';
    @property() statusKind: 'idle' | 'ok' | 'error' = 'idle';
    @property({attribute: false}) syncing = false;
    @property({attribute: false}) syncDisabled = false;
    @property() connectLabel = '';

    private emitSync(): void {
        this.dispatchEvent(new CustomEvent('sync', {bubbles: true, composed: true}));
    }

    private emitConnect(): void {
        this.dispatchEvent(new CustomEvent('connect', {bubbles: true, composed: true}));
    }

    override render(): TemplateResult {
        return html`
            <article class="card">
                <h2 class="name">${this.name}</h2>
                <p class="help">${this.help}</p>
                ${this.status
                    ? html`<p class="status ${this.statusKind}">${this.status}</p>`
                    : html``}
                <div class="slot">
                    <slot></slot>
                </div>
                <div class="actions">
                    ${this.connectLabel
                        ? html`<button @click=${this.emitConnect}>${this.connectLabel}</button>`
                        : html``}
                    <button class="primary" ?disabled=${this.syncDisabled || this.syncing} @click=${this.emitSync}>
                        ${this.syncing ? 'Syncing…' : 'Sync'}
                    </button>
                </div>
            </article>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cal-source-card': SourceCard;
    }
}
