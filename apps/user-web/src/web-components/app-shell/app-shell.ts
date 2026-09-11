import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {
    csrfUrl,
    isHealthOk,
    healthzUrl,
    loginTotpUrl,
    loginUrl,
    logoutUrl,
    meUrl,
    readBackupCodes,
    readCsrf,
    readErr,
    readMe,
    readTotpBegin,
    registerUrl,
    totpBeginUrl,
    totpConfirmUrl,
    totpRequired,
} from '../../services/api';
import {returnPathFromSearch} from '../../services/return-path';
import '../login-form/login-form';
import '../totp-form/totp-form';
import styles from './app-shell.css?inline';

type View = 'loading' | 'form' | 'totp' | 'home' | 'enroll' | 'backups';

@customElement('uw-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private apiStatus: 'unknown' | 'ok' | 'down' = 'unknown';
    @state() private view: View = 'loading';
    @state() private mode: 'login' | 'register' = 'login';
    @state() private error = '';
    @state() private busy = false;
    @state() private username = '';
    @state() private totpOn = false;
    @state() private enrollSecret = '';
    @state() private enrollOtpauth = '';
    @state() private backupCodes: string[] = [];

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
                this.signedIn(me.username, me.totpEnabled);
                return;
            }
            this.view = 'form';
        } catch {
            if (!this.isConnected) return;
            this.view = 'form';
        }
    }

    private signedIn(username: string, totpEnabled: boolean): void {
        this.username = username;
        this.totpOn = totpEnabled;
        this.view = 'home';
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

    private async loadMe(signal: AbortSignal): Promise<{id: string; username: string; totpEnabled: boolean} | null> {
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
        void this.submitPassword(event.detail, signal).catch(() => {});
    };

    private failNetwork(): void {
        if (!this.isConnected) return;
        this.busy = false;
        this.error = 'network error';
    }

    private async submitPassword(
        detail: {mode: 'login' | 'register'; username: string; password: string},
        signal: AbortSignal,
    ): Promise<void> {
        this.busy = true;
        this.error = '';
        try {
            const url = detail.mode === 'register' ? registerUrl() : loginUrl();
            const result = await this.postJson(url, {username: detail.username, password: detail.password}, signal);
            if (!this.isConnected) return;
            this.busy = false;
            this.applyAuthResult(detail.username, result);
        } catch {
            this.failNetwork();
        }
    }

    private applyAuthResult(username: string, result: {ok: boolean; body: unknown}): void {
        if (!result.ok) {
            this.error = readErr(result.body);
            return;
        }
        if (totpRequired(result.body)) {
            this.view = 'totp';
            this.error = '';
            return;
        }
        if (this.returnTo) {
            location.assign(this.returnTo);
            return;
        }
        const me = readMe(result.body);
        this.signedIn(me?.username ?? username, me?.totpEnabled ?? false);
    }

    private onTotpLogin = (event: CustomEvent<{code: string}>): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.submitTotpLogin(event.detail.code, signal).catch(() => {});
    };

    private async submitTotpLogin(code: string, signal: AbortSignal): Promise<void> {
        this.busy = true;
        this.error = '';
        try {
            const result = await this.postJson(loginTotpUrl(), {code}, signal);
            if (!this.isConnected) return;
            this.busy = false;
            this.applyAuthResult(this.username, result);
        } catch {
            this.failNetwork();
        }
    }

    private onEnroll = (): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.beginEnroll(signal).catch(() => {});
    };

    private async beginEnroll(signal: AbortSignal): Promise<void> {
        this.error = '';
        try {
            const result = await this.postJson(totpBeginUrl(), {}, signal);
            if (!this.isConnected) return;
            if (!result.ok) {
                this.error = readErr(result.body);
                return;
            }
            const begin = readTotpBegin(result.body);
            if (!begin) {
                this.error = 'could not start authenticator setup';
                return;
            }
            this.enrollSecret = begin.secret;
            this.enrollOtpauth = begin.otpauth;
            this.view = 'enroll';
        } catch {
            this.failNetwork();
        }
    }

    private onTotpConfirm = (event: CustomEvent<{code: string}>): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.confirmEnroll(event.detail.code, signal).catch(() => {});
    };

    private async confirmEnroll(code: string, signal: AbortSignal): Promise<void> {
        this.busy = true;
        this.error = '';
        try {
            const result = await this.postJson(totpConfirmUrl(), {code}, signal);
            if (!this.isConnected) return;
            this.busy = false;
            if (!result.ok) {
                this.error = readErr(result.body);
                return;
            }
            this.backupCodes = readBackupCodes(result.body) ?? [];
            this.totpOn = true;
            this.view = 'backups';
        } catch {
            this.failNetwork();
        }
    }

    private onLogout = (): void => {
        const signal = this.abort?.signal;
        if (!signal) return;
        void this.logout(signal).catch(() => {});
    };

    private async logout(signal: AbortSignal): Promise<void> {
        const result = await fetch(logoutUrl(), {
            method: 'POST',
            signal,
            credentials: 'include',
            headers: {'X-CSRF-Token': this.csrf},
        });
        if (!this.isConnected) return;
        if (!result.ok) {
            this.error = 'sign out failed';
            return;
        }
        this.username = '';
        this.totpOn = false;
        this.view = 'form';
        this.csrf = (await this.loadCsrf(signal)) ?? this.csrf;
    }

    private async postJson(url: string, payload: unknown, signal: AbortSignal): Promise<{ok: boolean; body: unknown}> {
        const response = await fetch(url, {
            method: 'POST',
            signal,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': this.csrf,
            },
            body: JSON.stringify(payload),
        });
        return {ok: response.ok, body: await response.json()};
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
        if (this.view === 'totp') {
            return html`
                <p class="lead">Enter your authenticator or backup code.</p>
                <uw-totp-form error=${this.error} .busy=${this.busy} @totp-submit=${this.onTotpLogin}></uw-totp-form>
            `;
        }
        if (this.view === 'enroll') return this.enrollBody();
        if (this.view === 'backups') return this.backupsBody();
        if (this.view === 'home') return this.homeBody();
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

    private homeBody(): TemplateResult {
        return html`
            <p class="lead">Signed in as ${this.username}</p>
            <p class="status">Authenticator: ${this.totpOn ? 'on' : 'off'}</p>
            ${this.totpOn ? '' : html`<button class="logout" type="button" @click=${this.onEnroll}>Add authenticator</button>`}
            <button class="logout" type="button" @click=${this.onLogout}>Sign out</button>
            ${this.error ? html`<p class="lead">${this.error}</p>` : ''}
        `;
    }

    private enrollBody(): TemplateResult {
        return html`
            <p class="lead">Scan or enter this secret in your authenticator app.</p>
            <p class="secret">${this.enrollSecret}</p>
            <p class="status">${this.enrollOtpauth}</p>
            <uw-totp-form
                submitLabel="Confirm"
                error=${this.error}
                .busy=${this.busy}
                @totp-submit=${this.onTotpConfirm}
            ></uw-totp-form>
        `;
    }

    private backupsBody(): TemplateResult {
        return html`
            <p class="lead">Save these backup codes. They will not be shown again.</p>
            <ul class="codes">${this.backupCodes.map((c) => html`<li>${c}</li>`)}</ul>
            <button class="logout" type="button" @click=${() => { this.view = 'home'; }}>Done</button>
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
