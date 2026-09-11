import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {healthzUrl, isHealthOk} from '../../services/api';
import styles from './app-shell.css?inline';

@customElement('uw-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private apiStatus: 'unknown' | 'ok' | 'down' = 'unknown';

    private abort: AbortController | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.abort = new AbortController();
        void this.ping(this.abort.signal).catch(() => {});
    }

    override disconnectedCallback(): void {
        this.abort?.abort();
        this.abort = null;
        super.disconnectedCallback();
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

    override render(): TemplateResult {
        return html`
            <header class="bar">
                <h1 class="brand">Accounts</h1>
            </header>
            <main class="main">
                <p class="lead">Sign-in lands here in a later phase.</p>
                <p class="status">API: ${this.apiLabel()}</p>
            </main>
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
