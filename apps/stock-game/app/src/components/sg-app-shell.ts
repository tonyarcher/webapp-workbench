import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import { history, parsePath, viewToPath } from '../router';
import type { View } from '../router';
import { currentUsername, hasSession, logout, startLogin } from '../lib/auth';
import { getQueryClient } from '../lib/queryClient';
import { defineElement } from './define';

const NAV_ITEMS: Array<{ view: View; label: string }> = [
    { view: { kind: 'dashboard' }, label: 'Dashboard' },
    { view: { kind: 'trade' }, label: 'Trade' },
    { view: { kind: 'portfolio' }, label: 'Portfolio' },
    { view: { kind: 'orders' }, label: 'Orders' },
    { view: { kind: 'settings' }, label: 'Settings' },
];

function takeBootError(): string {
    try {
        const message = sessionStorage.getItem('sg.auth.error');
        if (message) sessionStorage.removeItem('sg.auth.error');
        return message ?? '';
    } catch {
        return '';
    }
}

function viewKey(view: View): string {
    return view.kind === 'trade' ? `trade:${view.symbol ?? ''}` : view.kind;
}

export class SgAppShell extends LitElement {
    static override styles = css`
    :host {
      display: block;
    }
  `;

    static override properties = {
        route: { attribute: false },
        authed: { attribute: false },
        username: { attribute: false },
        authError: { attribute: false },
    };

    route: View = { kind: 'dashboard' };
    authed = hasSession();
    username: string | null = currentUsername();
    authError = takeBootError();

    private unsubscribeHistory: (() => void) | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.route = parsePath(history.location.pathname, history.location.search);
        this.unsubscribeHistory = history.subscribe(({ location }) => {
            this.route = parsePath(location.pathname, location.search);
        });
        window.addEventListener('sg-auth-required', this.onAuthRequired);
        window.addEventListener('sg-auth-changed', this.onAuthChanged);
    }

    override disconnectedCallback(): void {
        window.removeEventListener('sg-auth-required', this.onAuthRequired);
        window.removeEventListener('sg-auth-changed', this.onAuthChanged);
        this.unsubscribeHistory?.();
        this.unsubscribeHistory = null;
        super.disconnectedCallback();
    }

    private onAuthChanged = (): void => {
        this.authed = hasSession();
        this.username = currentUsername();
    };

    private onAuthRequired = (): void => {
        this.resetAccount();
    };

    private resetAccount(): void {
        logout();
        getQueryClient().clear();
        this.authed = false;
        this.username = null;
    }

    private onSignIn(): void {
        this.authError = '';
        startLogin().catch((err: unknown) => {
            this.authError = err instanceof Error ? err.message : 'Sign-in failed';
        });
    }

    private onSignOut(): void {
        this.resetAccount();
    }

    private isActive(view: View): boolean {
        if (this.route.kind !== view.kind) return false;
        if (view.kind === 'trade' && view.symbol !== undefined)
            return this.route.kind === 'trade' && this.route.symbol === view.symbol;
        return view.kind !== 'trade' || this.route.kind === 'trade';
    }

    private renderNav(): TemplateResult {
        return html`
      <nav class="nav">
        ${NAV_ITEMS.map(
            (item) => html`
            <a
              href="#${viewToPath(item.view)}"
              class="nav-link ${this.isActive(item.view) ? 'active' : ''}"
              @click=${(e: Event) => {
                  e.preventDefault();
                  history.push(viewToPath(item.view));
              }}
              >${item.label}</a
            >
          `,
        )}
        <span class="nav-user">${this.username ?? ''}</span>
        <button type="button" class="nav-link" @click=${this.onSignOut}>Sign out</button>
      </nav>
    `;
    }

    private renderMain(): TemplateResult {
        const key = viewKey(this.route);
        switch (this.route.kind) {
            case 'dashboard':
                return html`<sg-dashboard-view></sg-dashboard-view>`;
            case 'trade':
                return html`<sg-trade-view .symbol=${this.route.symbol} key=${key}></sg-trade-view>`;
            case 'portfolio':
                return html`<sg-portfolio-view></sg-portfolio-view>`;
            case 'orders':
                return html`<sg-orders-view></sg-orders-view>`;
            case 'settings':
                return html`<sg-settings-view></sg-settings-view>`;
        }
    }

    private renderSignIn(): TemplateResult {
        return html`
      <div class="shell">
        <main class="content">
          <div class="card">
            <h1>Stock Game</h1>
            <p class="muted">Sign in to play with your portfolio.</p>
            <button type="button" @click=${this.onSignIn}>Sign in</button>
            ${this.authError ? html`<div class="error">${this.authError}</div>` : ''}
          </div>
        </main>
      </div>
    `;
    }

    override render(): TemplateResult {
        if (!this.authed) return this.renderSignIn();
        return html`
      <div class="shell">
        ${this.renderNav()}
        <main class="content">${this.renderMain()}</main>
      </div>
    `;
    }
}

defineElement('sg-app-shell', SgAppShell);
