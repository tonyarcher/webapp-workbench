import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import styles from './login-form.css?inline';

@customElement('uw-login-form')
export class LoginForm extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() mode: 'login' | 'register' = 'login';
    @property() error = '';
    @property({type: Boolean}) busy = false;

    private onSubmit = (event: Event): void => {
        event.preventDefault();
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        const data = new FormData(form);
        const username = String(data.get('username') ?? '');
        const password = String(data.get('password') ?? '');
        this.dispatchEvent(new CustomEvent('account-submit', {
            detail: {mode: this.mode, username, password},
            bubbles: true,
            composed: true,
        }));
    };

    private switchMode = (mode: 'login' | 'register'): void => {
        this.dispatchEvent(new CustomEvent('account-mode', {
            detail: {mode},
            bubbles: true,
            composed: true,
        }));
    };

    override render(): TemplateResult {
        const register = this.mode === 'register';
        return html`
            <form class="form" @submit=${this.onSubmit}>
                <label class="field">Username
                    <input name="username" autocomplete="username" required minlength="3" maxlength="32"/>
                </label>
                <label class="field">Password
                    <input name="password" type="password"
                        autocomplete=${register ? 'new-password' : 'current-password'}
                        required minlength="12" maxlength="128"/>
                </label>
                ${this.error ? html`<p class="error">${this.error}</p>` : ''}
                <button class="submit" type="submit" ?disabled=${this.busy}>
                    ${register ? 'Create account' : 'Sign in'}
                </button>
            </form>
            <p class="switch">
                ${register
                    ? html`<button type="button" class="link" @click=${() => this.switchMode('login')}>Have an account? Sign in</button>`
                    : html`<button type="button" class="link" @click=${() => this.switchMode('register')}>Need an account? Register</button>`}
            </p>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'uw-login-form': LoginForm;
    }
}
