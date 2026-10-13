import { html } from 'lit';
import type { TemplateResult } from 'lit';
import type { AppSettings } from '../../types';
import { currentUsername, hasSession, logout, startLogin } from '../../services/auth';
import { readLegacyTraktSecrets } from '../../services/settings';
import { saveTraktCredentials, traktStatus } from '../../services/api';

/**
 * Sign-in lifecycle for the shell, split out to hold the shell under the
 * shared 500-line budget (same shape as rss's article-list render split).
 * Auth state itself stays declared on the element — Lit reactivity requires
 * that — and every function below takes the shell as this host.
 */
export interface AuthHost {
    authed: boolean;
    username: string | null;
    authError: string;
    traktAuth: { configured: boolean; authorized: boolean } | null;
    settings: AppSettings;
    persist(next: AppSettings): void;
}

export async function bootAuth(host: AuthHost): Promise<void> {
    host.authed = hasSession();
    host.username = currentUsername();
    if (host.authed) await signedIn(host);
}

export async function refreshSession(host: AuthHost): Promise<void> {
    host.authed = hasSession();
    host.username = currentUsername();
    if (host.authed) await signedIn(host);
}

async function signedIn(host: AuthHost): Promise<void> {
    await refreshTraktStatus(host);
    await migrateLegacyCredentials(host);
}

export function authRequired(host: AuthHost): void {
    host.authed = false;
    host.username = null;
    host.traktAuth = null;
}

export function authError(host: AuthHost, e: Event): void {
    const detail = (e as CustomEvent<unknown>).detail;
    host.authError = typeof detail === 'string' && detail ? detail : 'Sign-in failed';
}

export function signIn(host: AuthHost): void {
    host.authError = '';
    startLogin().catch((err: unknown) => {
        host.authError = err instanceof Error ? err.message : 'Sign-in failed';
    });
}

export function signOut(host: AuthHost): void {
    void logout().finally(() => {
        host.authed = false;
        host.username = null;
        host.traktAuth = null;
    });
}

export async function refreshTraktStatus(host: AuthHost): Promise<void> {
    try {
        const status = await traktStatus();
        host.traktAuth = { configured: status.configured, authorized: status.authorized };
    } catch {
        host.traktAuth = null;
    }
}

/**
 * One-shot move of pre-vault app credentials into the server vault. Reads
 * the legacy localStorage shape directly; the parsed settings never see
 * secrets anymore. Failures stay silent here: the user can always connect
 * manually, and a loud error on every boot would be worse.
 */
async function migrateLegacyCredentials(host: AuthHost): Promise<void> {
    const legacy = readLegacyTraktSecrets();
    if (!legacy) return;
    try {
        const status = await traktStatus();
        if (!status.configured) {
            await saveTraktCredentials(legacy.clientId, legacy.clientSecret);
        }
        await refreshTraktStatus(host);
    } catch (err) {
        console.error('trakt credential migration failed', err);
    }
    // Flush stripped settings either way: the secret fields no longer exist
    // on the shape, so saving drops them from localStorage.
    host.persist({ ...host.settings });
}

export function renderSignIn(host: AuthHost, onSignIn: () => void): TemplateResult {
    return html`
        <header>
            <h1>Calendar Sync</h1>
            <span class="sub">trakt and netflix, in one calendar</span>
        </header>
        <main class="signin">
            <div class="signin-card">
                <h2>Sign in to sync</h2>
                <p class="muted">Your Trakt credentials live in your account on the server. Sign in with the workbench identity service to continue.</p>
                <button class="primary" @click=${onSignIn}>Sign in</button>
                ${host.authError ? html`<p class="error">${host.authError}</p>` : ''}
            </div>
        </main>`;
}
