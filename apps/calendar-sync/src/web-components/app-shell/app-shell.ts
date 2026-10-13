import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CalEvent, SyncProgress } from '../../core/index.js';
import {
    dedupEvents,
    eventsToIcs,
    findOrCreateCalendar,
    googleInsertEvent,
    eventToGoogleBody,
    parseNetflixExport,
    writeEvents,
} from '../../core/index.js';
import type { AppSettings, DeviceFlowView } from '../../types';
import { hasSession, currentUsername } from '../../services/auth';
import {
    authError as authErrorTo,
    authRequired,
    bootAuth,
    refreshSession,
    renderSignIn,
    refreshTraktStatus,
    signIn,
    signOut,
} from './app-shell-auth';
import { pollDeviceToken, requestDeviceCode, saveTraktCredentials, traktStatus } from '../../services/api';
import { fetchTraktEventsViaApi, isTerminalDeviceError, pollDeviceUntil } from '../../services/trakt-sync';
import { loadSettings, saveSettings } from '../../services/settings';
import { requestGoogleToken } from '../../services/google-auth';
import { downloadText } from '../../services/download';
import '../source-card/source-card';
import '../progress-bar/progress-bar';
import styles from './app-shell.css?inline';

@customElement('cal-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private settings: AppSettings = loadSettings();
    @state() private traktEvents: CalEvent[] = [];
    @state() private netflixEvents: CalEvent[] = [];
    @state() private netflixSkipped = 0;
    @state() private progress: SyncProgress | null = null;
    @state() private error = '';
    @state() private notice = '';
    @state() private busy: 'trakt' | 'netflix' | 'all' | 'ics' | 'google' | 'connect-trakt' | null = null;
    @state() private deviceFlow: DeviceFlowView | null = null;
    @state() private authed = hasSession();
    @state() private username: string | null = currentUsername();
    // Shared with app-shell-auth through AuthHost: written by the module,
    // read by the module. Stays declared here for Lit reactivity.
    @state() authError = '';
    @state() private traktClientId = '';
    @state() private traktClientSecret = '';
    @state() private traktAuth: { configured: boolean; authorized: boolean } | null = null;

    private abort: AbortController | null = null;
    private netflixText = '';
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        window.addEventListener('cal-auth-required', this.onAuthRequired);
        window.addEventListener('cal-auth-changed', this.onAuthChanged);
        window.addEventListener('cal-auth-error', this.onAuthError);
        void bootAuth(this as never);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener('cal-auth-required', this.onAuthRequired);
        window.removeEventListener('cal-auth-changed', this.onAuthChanged);
        window.removeEventListener('cal-auth-error', this.onAuthError);
        this.abort?.abort();
        if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    }

    private onAuthChanged = (): void => {
        void refreshSession(this as never);
    };

    private onAuthRequired = (): void => {
        authRequired(this as never);
    };

    private onAuthError = (e: Event): void => {
        authErrorTo(this as never, e);
    };

    private onSignIn = (): void => {
        signIn(this as never);
    };

    private onSignOut = (): void => {
        signOut(this as never);
    };

    private persist(next: AppSettings): void {
        this.settings = next;
        // Debounce the localStorage write so typing doesn't write on every
        // keystroke; the final value always wins.
        if (this.saveTimer !== null) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            saveSettings(next);
        }, 200);
    }

    private showNotice(msg: string): void {
        this.notice = msg;
    }

    private merged(): CalEvent[] {
        return dedupEvents([...this.traktEvents, ...this.netflixEvents]);
    }

    private onProgress = (progress: SyncProgress): void => {
        this.progress = progress;
    };

    private onTraktField(event: Event, field: 'clientId' | 'clientSecret'): void {
        const value = (event.target as HTMLInputElement).value;
        // Transient only: app credentials live in the server vault after
        // Connect, never in localStorage again.
        if (field === 'clientId') this.traktClientId = value;
        else this.traktClientSecret = value;
    }

    private onGoogleClientId(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.persist({
            ...this.settings,
            google: { ...this.settings.google, clientId: value },
        });
    }

    private onToggle(event: Event, field: 'includeCalendar' | 'includeHistory'): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.persist({
            ...this.settings,
            trakt: { ...this.settings.trakt, [field]: checked },
        });
    }

    private onNetflixFile(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        void file
            .text()
            .then((text) => {
                this.netflixText = text;
                this.parseNetflix();
            })
            .catch((err: unknown) => {
                this.error = err instanceof Error ? err.message : 'Could not read file';
            });
    }

    private parseNetflix(): void {
        this.error = '';
        const parsed = parseNetflixExport(this.netflixText);
        this.netflixEvents = parsed.events;
        this.netflixSkipped = parsed.skipped.length;
        this.persist({
            ...this.settings,
            netflix: { lastCount: parsed.events.length, lastAt: Date.now() },
        });
        this.progress = {
            phase: 'convert',
            done: parsed.events.length,
            total: parsed.events.length + parsed.skipped.length,
            label: parsed.skipped.length ? `${parsed.skipped.length} rows skipped` : 'Netflix export parsed',
        };
    }

    private async fetchTrakt(): Promise<void> {
        const status = await traktStatus();
        this.traktAuth = { configured: status.configured, authorized: status.authorized };
        if (!status.configured) {
            throw new Error('Enter a Trakt client id and secret in Settings, then Connect.');
        }
        if (!status.authorized) throw new Error('Connect Trakt first.');
        this.traktEvents = await fetchTraktEventsViaApi({
            includeCalendar: this.settings.trakt.includeCalendar,
            includeHistory: this.settings.trakt.includeHistory,
            onProgress: this.onProgress,
            onTruncate: (info) =>
                this.showNotice(
                    `Trakt ${info.type} history goes back further than this app pulls (page ${info.page}); older entries were not synced.`,
                ),
        });
    }

    private validateTransientCreds(): boolean {
        if (!this.traktClientId.trim() || !this.traktClientSecret.trim()) {
            this.error = 'Paste a Trakt client id and secret in Settings.';
            return false;
        }
        return true;
    }

    private async runDeviceFlow(signal: AbortSignal): Promise<void> {
        const clientId = this.traktClientId.trim();
        const clientSecret = this.traktClientSecret.trim();
        await saveTraktCredentials(clientId, clientSecret);
        // Drop the secret from memory as soon as the vault holds it.
        this.traktClientId = '';
        this.traktClientSecret = '';
        const code = await requestDeviceCode();
        this.deviceFlow = { userCode: code.userCode, verificationUrl: code.verificationUrl };
        const outcome = await pollDeviceUntil({
            poll: () => pollDeviceToken(code.deviceCode),
            intervalMs: Math.max(code.interval * 1_000, 1_000),
            expiresAt: Date.now() + code.expiresIn * 1_000,
            signal,
        });
        // Polling stopped on every path, so the card comes down on every
        // path; what differs is the message. Terminal server rejections skip
        // all of this via throw, and the catch below clears the card for them.
        this.deviceFlow = null;
        if (outcome === 'expired') throw new Error('Trakt device code expired');
        if (outcome === 'unreachable') {
            throw new Error('Lost connection to the server while waiting. Check your connection and Connect again.');
        }
        await refreshTraktStatus(this as never);
    }

    private async onConnectTrakt(): Promise<void> {
        this.error = '';
        if (!this.validateTransientCreds()) return;
        this.abort?.abort();
        this.abort = new AbortController();
        this.busy = 'connect-trakt';
        try {
            await this.runDeviceFlow(this.abort.signal);
        } catch (err) {
            if ((err as { name?: string }).name === 'AbortError') return;
            // Terminal failure: drop the code card so the user cannot
            // authorize against a dead code. Transient poll failures keep it:
            // the code is still valid and the loop simply stopped early.
            if (isTerminalDeviceError(err)) this.deviceFlow = null;
            this.error = err instanceof Error ? err.message : 'Trakt connect failed';
        } finally {
            this.busy = null;
        }
    }

    private async ensureGoogleToken(): Promise<string> {
        const google = this.settings.google;
        if (!google.clientId) throw new Error('Paste a Google OAuth client id in Settings.');
        const fresh = google.accessToken && (google.accessExpiresAt ?? 0) - 60_000 > Date.now();
        if (fresh && google.accessToken) return google.accessToken;
        const access = await requestGoogleToken(google.clientId, google.accessToken ? '' : 'consent');
        this.persist({
            ...this.settings,
            google: {
                ...this.settings.google,
                accessToken: access.accessToken,
                accessExpiresAt: access.expiresAt,
            },
        });
        return access.accessToken;
    }

    private async onSyncTrakt(): Promise<void> {
        this.error = '';
        this.busy = 'trakt';
        try {
            await this.fetchTrakt();
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Trakt sync failed';
        } finally {
            this.busy = null;
        }
    }

    private onSyncNetflix(): void {
        this.error = '';
        if (!this.netflixText) {
            this.error = 'Choose a Netflix CSV or JSON export first.';
            return;
        }
        this.busy = 'netflix';
        try {
            this.parseNetflix();
        } finally {
            this.busy = null;
        }
    }

    private async onSyncAll(): Promise<void> {
        this.error = '';
        this.busy = 'all';
        try {
            await refreshTraktStatus(this as never);
            if (this.traktAuth?.authorized) {
                await this.fetchTrakt();
            }
            if (this.netflixText) this.parseNetflix();
            this.progress = {
                phase: 'convert',
                done: this.merged().length,
                total: this.merged().length,
                label: 'Sources loaded',
            };
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Sync failed';
        } finally {
            this.busy = null;
        }
    }

    private onDownloadIcs(): void {
        const events = this.merged();
        if (events.length === 0) {
            this.error = 'Sync a source first.';
            return;
        }
        this.error = '';
        this.busy = 'ics';
        try {
            const ics = eventsToIcs(events);
            downloadText('calendar-sync.ics', ics, 'text/calendar;charset=utf-8');
            this.progress = { phase: 'write', done: events.length, total: events.length, label: 'Downloaded ICS' };
            this.persist({
                ...this.settings,
                lastSync: { at: Date.now(), count: events.length, failed: 0, destination: 'ics' },
            });
        } finally {
            this.busy = null;
        }
    }

    private async ensureCalendarId(accessToken: string): Promise<string> {
        const existing = this.settings.google.calendarId;
        if (existing) return existing;
        const calendarId = await findOrCreateCalendar(fetch, accessToken);
        this.persist({ ...this.settings, google: { ...this.settings.google, calendarId } });
        return calendarId;
    }

    private pushGoogleEvents(
        events: CalEvent[],
        accessToken: string,
        calendarId: string,
    ): Promise<{ done: number; failed: number; newUids: string[] }> {
        const written = new Set(this.settings.google.writtenUids);
        return writeEvents({
            events,
            writtenUids: written,
            writeOne: (event) => googleInsertEvent(fetch, accessToken, calendarId, eventToGoogleBody(event)),
            onProgress: this.onProgress,
        });
    }

    private persistGooglePush(calendarId: string, result: { done: number; failed: number; newUids: string[] }): void {
        this.persist({
            ...this.settings,
            google: {
                ...this.settings.google,
                calendarId,
                writtenUids: [...this.settings.google.writtenUids, ...result.newUids],
            },
            lastSync: { at: Date.now(), count: result.done, failed: result.failed, destination: 'google' },
        });
    }

    private async onPushGoogle(): Promise<void> {
        const events = this.merged();
        if (events.length === 0) {
            this.error = 'Sync a source first.';
            return;
        }
        this.error = '';
        this.busy = 'google';
        try {
            const accessToken = await this.ensureGoogleToken();
            const calendarId = await this.ensureCalendarId(accessToken);
            const result = await this.pushGoogleEvents(events, accessToken, calendarId);
            this.persistGooglePush(calendarId, result);
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Google Calendar push failed';
        } finally {
            this.busy = null;
        }
    }

    private traktReady(): boolean {
        return this.traktAuth?.authorized ?? false;
    }

    private traktStatusText(): string {
        if (this.traktEvents.length) return `${this.traktEvents.length} events`;
        if (this.traktAuth?.authorized) return 'Connected';
        if (this.traktAuth?.configured) return 'Credentials saved — connect to authorize';
        return 'Not connected';
    }

    private netflixStatus(): string {
        if (this.netflixEvents.length || this.netflixSkipped) {
            const skipped = this.netflixSkipped ? `, ${this.netflixSkipped} skipped` : '';
            return `${this.netflixEvents.length} events${skipped}`;
        }
        return 'No file loaded';
    }

    private renderBanners(): TemplateResult {
        return html`${this.error ? html`<p class="banner">${this.error}</p>` : html``}
            ${this.notice && !this.error ? html`<p class="notice">${this.notice}</p>` : html``}`;
    }

    private renderProgressBlock(): TemplateResult {
        const p = this.progress;
        if (!p) return html``;
        return html`<div class="progress">
            <cal-progress-bar .done=${p.done} .total=${p.total ?? 0} .failed=${p.failed ?? 0} .label=${p.label ?? ''}></cal-progress-bar>
        </div>`;
    }

    private renderTraktCard(): TemplateResult {
        const ready = this.traktReady();
        return html`<cal-source-card
                name="Trakt"
                help="Upcoming shows/movies plus watch history. Register an app at trakt.tv/oauth/applications and paste the client id/secret below."
                .status=${this.traktStatusText()}
                .statusKind=${ready ? 'ok' : 'idle'}
                .syncing=${this.busy === 'trakt' || this.busy === 'all'}
                .syncDisabled=${this.busy !== null}
                .connectLabel=${ready ? 'Reconnect' : 'Connect'}
                @connect=${() => void this.onConnectTrakt()}
                @sync=${() => void this.onSyncTrakt()}
            >
                <div class="toggles">
                    <label><input type="checkbox" .checked=${this.settings.trakt.includeCalendar} @change=${(e: Event) => this.onToggle(e, 'includeCalendar')}> Upcoming calendar</label>
                    <label><input type="checkbox" .checked=${this.settings.trakt.includeHistory} @change=${(e: Event) => this.onToggle(e, 'includeHistory')}> Watch history</label>
                </div>
            </cal-source-card>`;
    }

    private renderNetflixCard(): TemplateResult {
        return html`<cal-source-card
                name="Netflix"
                help="Netflix has no public API. Upload a viewing-activity CSV or JSON (Title + Date columns)."
                .status=${this.netflixStatus()}
                .statusKind=${this.netflixEvents.length ? 'ok' : 'idle'}
                .syncing=${this.busy === 'netflix'}
                .syncDisabled=${this.busy !== null}
                @sync=${this.onSyncNetflix}
            >
                <input class="file" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" aria-label="Netflix viewing activity file" @change=${this.onNetflixFile}>
            </cal-source-card>`;
    }

    private renderDeviceFlowBlock(): TemplateResult {
        if (!this.deviceFlow) return html``;
        return html`<div class="device">
                <p class="help">Enter this code at <a href=${this.deviceFlow.verificationUrl} target="_blank" rel="noopener">${this.deviceFlow.verificationUrl}</a></p>
                <p class="device-code">${this.deviceFlow.userCode}</p>
            </div>`;
    }

    private renderDestinations(mergedCount: number): TemplateResult {
        const googleReady = Boolean(this.settings.google.accessToken);
        return html`<div class="destinations">
                <button ?disabled=${this.busy !== null} @click=${() => void this.onSyncAll()}>Sync all</button>
                <button class="primary" ?disabled=${this.busy !== null || mergedCount === 0} @click=${() => void this.onDownloadIcs}>Download .ics (${mergedCount})</button>
                <button class="primary" ?disabled=${this.busy !== null || mergedCount === 0} @click=${() => void this.onPushGoogle()}>
                    ${googleReady ? `Add to Google Calendar (${mergedCount})` : 'Connect Google Calendar'}
                </button>
            </div>`;
    }

    private renderLast(): TemplateResult {
        const last = this.settings.lastSync;
        if (!last) return html``;
        return html`<p class="last">Last export: ${last.count} events${last.failed ? `, ${last.failed} failed` : ''} → ${last.destination === 'ics' ? 'ICS' : 'Google Calendar'}</p>`;
    }

    private renderSettingsPanel(): TemplateResult {
        const s = this.settings;
        return html`<details class="settings">
                <summary>Settings</summary>
                <div class="fields">
                    <p class="hint">Trakt app credentials are stored on the server, never in this browser. Create your own Trakt app and a Google Cloud OAuth client (type: Web application) with this origin as an authorized JavaScript origin.</p>
                    <label>Trakt client id
                        <input type="text" autocomplete="off" .value=${this.traktClientId} @input=${(e: Event) => this.onTraktField(e, 'clientId')}>
                    </label>
                    <label>Trakt client secret
                        <input type="password" autocomplete="off" .value=${this.traktClientSecret} @input=${(e: Event) => this.onTraktField(e, 'clientSecret')}>
                    </label>
                    <label>Google OAuth client id
                        <input type="text" autocomplete="off" .value=${s.google.clientId} @input=${this.onGoogleClientId}>
                    </label>
                </div>
            </details>`;
    }

    override render(): TemplateResult {
        if (!this.authed) return renderSignIn(this as never, this.onSignIn);
        const mergedCount = this.merged().length;
        return html`
            <main class="page">
                <h1 class="title">Calendar Sync</h1>
                <p class="lede">Pull upcoming airings and watch history from Trakt, import a Netflix viewing export, then download an .ics or push a dedicated Google Calendar (shows up in Gmail).</p>
                <p class="auth">Signed in as ${this.username ?? ''} <button class="auth-out" @click=${this.onSignOut}>Sign out</button></p>
                ${this.renderBanners()} ${this.renderProgressBlock()}
                <p class="section">Sources</p>
                <div class="grid">${this.renderTraktCard()} ${this.renderNetflixCard()}</div>
                ${this.renderDeviceFlowBlock()} ${this.renderDestinations(mergedCount)} ${this.renderLast()} ${this.renderSettingsPanel()}
            </main>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cal-app-shell': AppShell;
    }
}
