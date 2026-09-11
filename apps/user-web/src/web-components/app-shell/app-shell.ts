import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
    csrfUrl,
    isHealthOk,
    healthzUrl,
    loginUrl,
    logoutUrl,
    meUrl,
    readCsrf,
    readErr,
    readMe,
    registerUrl,
} from '../../services/api';
import {returnPathFromSearch} from '../../services/return-path';
import '../login-form/login-form';
import styles from './app-shell.css?inline';

@customElement('uw-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private apiStatus: 'unknown' | 'ok' | 'down' = 'unknown';
    @state() private view: 'loading' | 'form' | 'home' = 'loading';
    @state() private mode: 'login' | 'register' = 'login';
    @state() private error = '';
    @state() private busy = false;
    @state() private username = '';

    private abort: AbortController | null = null;
    private csrf = '';
    private returnTo: string | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.returnTo = returnPathFromSearch(location.search);
        this.abort = new AbortController();
        void this.boot(this.abort.signal).catch(() => {});
    }

    override disconnectedCallback(): void {
        this.abort?.abort();
        this.abort = null;
        super.disconnectedCallback();
    }

    private async boot(signal: AbortSignal): Promise<void> {
        await this.ping(signal);
        if (!this.isConnected) return;
        try {
            this.csrf = (await this.loadCsrf(signal)) ?? '';
            if (!this.isConnected) return;
            const me = await this.loadMe(signal);
            if (!this.isConnected) return;
            if (me) {
                this.username = me.username;
                this.view = 'home';
                return;
            }
            this.view = 'form';
        } catch {
            if (!this.isConnected) return;
            this.view = 'form';
        }
    }

    private async ping(signal: AbortSignal): Promise<void> {
        try {
            const response = await fetch(healthzUrl(), {signal});
            const body: unknown = await response.json();
            if (!this.isConnected) return;
            this.apiStatus = response.ok && isHealthOk(body) ? 'ok' : 'down';
        } catch {
            if (!this.isConnected) return;
            this.apiStatus = 'down';
        }
    }

    private async loadCsrf(signal: AbortSignal): Promise<string | null> {
        const response = await fetch(csrfUrl(), {signal, credentials: 'include'});
        const body: unknown = await response.json();
        return readCsrf(body);
    }

    private async loadMe(signal: AbortSignal): Promise<{id: string; username: string} | null> {
        const response = await fetch(meUrl(), {signal, credentials: 'include'});
        if (response.status === 401) return null;
        const body: unknown = await response.json();
        return readMe(body);
    }

    private onMode = (event: CustomEvent<{mode: 'login' | 'register'}>): void => {
        this.mode = event.detail.mode;
        this.error = '';
    };

    private onSubmit = (event: CustomEvent<{mode: 'login' | 'register'; username: string; password: string}>): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.submit(event.detail, signal).catch(() => {});
    };

    private async submit(
        detail: {mode: 'login' | 'register'; username: string; password: string},
        signal: AbortSignal,
    ): Promise<void> {
        this.busy = true;
        this.error = '';
        try {
            const body = await this.postAccount(detail, signal);
            if (!this.isConnected) return;
            this.busy = false;
            this.applyAuthResult(detail.username, body);
        } catch {
            if (!this.isConnected) return;
            this.busy = false;
            this.error = 'network error';
        }
    }

    private async postAccount(
        detail: {mode: 'login' | 'register'; username: string; password: string},
        signal: AbortSignal,
    ): Promise<{ok: boolean; body: unknown}> {
        const url = detail.mode === 'register' ? registerUrl() : loginUrl();
        const response = await fetch(url, {
            method: 'POST',
            signal,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.csrf,
            },
            body: JSON.stringify({username: detail.username, password: detail.password}),
        });
        return {ok: response.ok, body: await response.json()};
    }

    private applyAuthResult(username: string, result: {ok: boolean; body: unknown}): void {
        if (!result.ok) {
            this.error = readErr(result.body);
            return;
        }
        if (this.returnTo) {
            location.assign(this.returnTo);
            return;
        }
        this.username = readMe(result.body)?.username ?? username;
        this.view = 'home';
    }

    private onLogout = (): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.logout(signal).catch(() => {});
    };

    private async logout(signal: AbortSignal): Promise<void> {
        await fetch(logoutUrl(), {
            method: 'POST',
            signal,
            credentials: 'include',
            headers: {'X-CSRF-Token': this.csrf},
        });
        if (!this.isConnected) return;
        this.username = '';
        this.view = 'form';
        this.csrf = (await this.loadCsrf(signal)) ?? this.csrf;
    }

    override render(): TemplateResult {
        return html`
            <header class="bar">
                <h1 class="brand">Accounts</h1>
                <p class="status">API: ${this.apiLabel()}</p>
            </header>
            <main class="main">${this.body()}</main>
        `;
    }

    private body(): TemplateResult {
        if (this.view === 'loading') return html`<p class="lead">Loading…</p>`;
        if (this.view === 'home') {
            return html`
                <p class="lead">Signed in as ${this.username}</p>
                <button class="logout" type="button" @click=${this.onLogout}>Sign out</button>
            `;
        }
        return html`
            <uw-login-form
                mode=${this.mode}
                error=${this.error}
                .busy=${this.busy}
                @account-submit=${this.onSubmit}
                @account-mode=${this.onMode}
            ></uw-login-form>
        `;
    }

    private apiLabel(): string {
        if (this.apiStatus === 'ok') return 'ok';
        if (this.apiStatus === 'down') return 'down';
        return 'checking';
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'uw-app-shell': AppShell;
    }
}
