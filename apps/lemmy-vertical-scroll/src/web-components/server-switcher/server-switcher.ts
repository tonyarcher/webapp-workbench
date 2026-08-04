import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import type {StoredAuthSession} from '../../db/auth'
import {activateServer, rememberServer, setInstance} from '../../mutations'
import {authSessionsQuery, popularServersQuery, QueryController, serversQuery} from '../../query'
import {navigate} from '../../router'
import {fetchSite, normalizeInstanceUrl} from '../../services/lemmy'
import type {PopularServer, ServerRecord} from '../../types'
import styles from './server-switcher.css?inline'

@customElement('lvs-server-switcher')
export class ServerSwitcher extends LitElement {
    static override styles = unsafeCSS(styles)

    /** The currently active server. */
    @property({attribute: false}) instance = ''
    /** Display name of the active server (from its site query). */
    @property({attribute: false}) activeName = ''

    private readonly serversController = new QueryController<ServerRecord[]>(this, () => serversQuery())
    private readonly popularController = new QueryController<PopularServer[]>(this, () => popularServersQuery())
    private readonly sessionsController = new QueryController<StoredAuthSession[]>(this, () => authSessionsQuery())

    @state() private open = false
    @state() private error = ''
    @state() private warning = ''
    @state() private adding = false
    @state() private popularBusy: string | null = null
    private addInput = ''

    override connectedCallback(): void {
        super.connectedCallback()
        document.addEventListener('pointerdown', this.onDocumentPointerDown)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    }

    /** Stable identity so the listener can be removed; closes the dropdown on outside taps. */
    private readonly onDocumentPointerDown = (event: PointerEvent): void => {
        if (!this.open) return
        const target = event.target as Node | null
        if (target && this.renderRoot.contains(target)) return
        this.open = false
    }

    override updated(changed: Map<string, unknown>): void {
        super.updated(changed)
        if (changed.has('open') && this.open) {
            const input = this.renderRoot.querySelector<HTMLInputElement>('.add-input')
            input?.focus()
        }
    }

    private onToggle(): void {
        this.open = !this.open
        this.error = ''
        this.warning = ''
    }

    private onAddInput(event: Event): void {
        this.addInput = (event.target as HTMLInputElement).value
        this.error = ''
        this.warning = ''
    }

    private async connect(host: string): Promise<void> {
        const {site, software} = await fetchSite(host)
        if (software === 'piefed') {
            this.warning = `${host} runs PieFed — feeds use PieFed's own API.`
        } else if (software === 'unknown') {
            this.warning = `${host} responds but reports no compatible API version.`
        }
        await rememberServer(host, site.name || host, software)
        setInstance(host)
    }

    private async onAdd(): Promise<void> {
        const host = normalizeInstanceUrl(this.addInput)
        if (!host) {
            this.error = 'That does not look like a valid instance URL (try lemmy.world).'
            return
        }
        this.adding = true
        this.error = ''
        this.warning = ''
        try {
            await this.connect(host)
            this.addInput = ''
            this.open = false
        } catch (e) {
            this.error = e instanceof Error ? e.message : String(e)
        } finally {
            this.adding = false
        }
    }

    private onSelectServer(server: ServerRecord): void {
        activateServer(server)
        this.open = false
    }

    private async onPopularTap(server: PopularServer): Promise<void> {
        this.popularBusy = server.host
        this.error = ''
        try {
            await this.connect(server.host)
            this.open = false
        } catch (e) {
            this.error = `${server.name}: ${e instanceof Error ? e.message : String(e)}`
        } finally {
            this.popularBusy = null
        }
    }

    private onManage(): void {
        this.open = false
        navigate({kind: 'settings'})
    }

    private renderServers(servers: ServerRecord[], sessions: Map<string, string>): TemplateResult {
        if (!servers.length) {
            return html`<p class="section-empty">No saved servers yet — add one below or pick from Popular.</p>`
        }
        return html`
            ${servers.map(
                (server) => html`
                    <button
                        class="server-row${server.host === this.instance ? ' active' : ''}"
                        @click=${() => this.onSelectServer(server)}
                    >
                        <span class="server-main">
                            <span class="server-name">${server.name}</span>
                            <span class="server-host">${server.host}</span>
                        </span>
                        ${server.host === this.instance ? html`<span class="active-mark" aria-label="Active server">✓</span>` : nothing}
                        ${sessions.get(server.host)
                            ? html`<span class="login-dot" title="Logged in as ${sessions.get(server.host)}"></span>`
                            : nothing}
                    </button>
                `,
            )}
        `
    }

    private renderPopular(servers: PopularServer[]): TemplateResult {
        if (!servers.length) return html`<p class="section-empty">Popular list is unavailable right now.</p>`
        return html`
            ${servers.map(
                (server) => html`
                    <button
                        class="server-row"
                        .disabled=${this.popularBusy !== null}
                        @click=${() => void this.onPopularTap(server)}
                    >
                        <span class="server-main">
                            <span class="server-name">${server.name}</span>
                            <span class="server-host">${server.host}</span>
                        </span>
                        ${server.nsfw ? html`<span class="nsfw-badge">NSFW</span>` : nothing}
                        ${this.popularBusy === server.host ? html`<span class="busy-dot"></span>` : nothing}
                    </button>
                `,
            )}
        `
    }

    override render(): TemplateResult {
        const servers = [...(this.serversController.value.data ?? [])].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        const sessions = new Map((this.sessionsController.value.data ?? []).map((session) => [session.host, session.username]))
        return html`
            <div class="switcher">
                <button class="switcher-toggle${this.open ? ' open' : ''}" aria-expanded=${this.open} @click=${this.onToggle}>
                    <span class="switcher-label">${this.activeName || this.instance || 'Server'}</span>
                    <span class="switcher-caret">▾</span>
                </button>
                ${this.open
                    ? html`
                        <div class="switcher-dropdown">
                            <div class="dropdown-section">
                                <h3 class="section-title">Your servers</h3>
                                ${this.renderServers(servers, sessions)}
                            </div>
                            <div class="dropdown-section">
                                <h3 class="section-title">Add a server</h3>
                                <div class="add-form">
                                    <input
                                        class="add-input"
                                        type="text"
                                        placeholder="lemmy.world"
                                        .value=${this.addInput}
                                        @input=${this.onAddInput}
                                        @keydown=${(e: KeyboardEvent) => {
                                            if (e.key === 'Enter') void this.onAdd()
                                        }}
                                    />
                                    <button class="add-button" .disabled=${this.adding} @click=${() => void this.onAdd()}>
                                        ${this.adding ? 'Checking…' : 'Add'}
                                    </button>
                                </div>
                                ${this.error ? html`<p class="switcher-error">${this.error}</p>` : nothing}
                                ${this.warning ? html`<p class="switcher-warning">${this.warning}</p>` : nothing}
                            </div>
                            <div class="dropdown-section">
                                <h3 class="section-title">Popular</h3>
                                ${this.renderPopular(this.popularController.value.data ?? [])}
                            </div>
                            <div class="dropdown-footer">
                                <button class="manage-link" @click=${this.onManage}>Manage servers…</button>
                            </div>
                        </div>
                    `
                    : nothing}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-server-switcher': ServerSwitcher
    }
}
