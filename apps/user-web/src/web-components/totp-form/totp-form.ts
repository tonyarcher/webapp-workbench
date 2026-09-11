import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import styles from './totp-form.css?inline';

@customElement('uw-totp-form')
export class TotpForm extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() error = '';
    @property({type: Boolean}) busy = false;
    @property() submitLabel = 'Verify';

    private onSubmit = (event: Event): void => {
        event.preventDefault();
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        const data = new FormData(form);
        const code = String(data.get('code') ?? '');
        this.dispatchEvent(new CustomEvent('totp-submit', {
            detail: {code},
            bubbles: true,
            composed: true,
        }));
    };

    override render(): TemplateResult {
        return html`
            <form class="form" @submit=${this.onSubmit}>
                <label class="field">Authenticator or backup code
                    <input name="code" inputmode="numeric" autocomplete="one-time-code" required/>
                </label>
                ${this.error ? html`<p class="error">${this.error}</p>` : ''}
                <button class="submit" type="submit" ?disabled=${this.busy}>${this.submitLabel}</button>
            </form>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'uw-totp-form': TotpForm;
    }
}
