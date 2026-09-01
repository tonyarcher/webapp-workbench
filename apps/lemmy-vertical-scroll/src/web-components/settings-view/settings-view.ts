import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {activateServer, clearCaches, rememberServer, removeServer, setInstance} from '../../mutations'
import {popularServersQuery, QueryController, serversQuery} from '../../query'
import {fetchSite, normalizeInstanceUrl} from '../../services/lemmy'
import type {LemmySite, PopularServer, ServerRecord, Settings, Software} from '../../types'
import styles from './settings-view.css?inline'

@customElement('lvs-settings-view')
export class SettingsView extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) settings!: Settings
    @property({attribute: false}) site: LemmySite | null = null
    @property({attribute: false}) software: Software = 'unknown'

    private readonly serversController = new QueryController<ServerRecord[]>(this, () => serversQuery())
    private readonly popularController = new QueryController<PopularServer[]>(this, () => popularServersQuery())

    private input = ''
    private error = ''
    private warning = ''
    private saved = false
    private validating = false
    private clearing = false
    @state() private busyHost: string | null = null

    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('settings') && !this.input) {
            this.input = this.settings?.instance ?? ''
        }
    }

    private onInput(event: Event): void {
        this.input = (event.target as HTMLInputElement).value
        this.error = ''
        this.warning = ''
        this.saved = false
    }

    private async onSave(): Promise<void> {
        const host = normalizeInstanceUrl(this.input)
        if (!host) {
            this.error = 'That does not look like a valid instance URL (try lemmy.world).'
            return
        }
        this.validating = true
        this.error = ''
        this.warning = ''
        this.saved = false
        try {
            const {site, software} = await fetchSite(host)
            if (software === 'piefed') {
                this.warning = `${host} runs PieFed — feeds will use PieFed's own API.`
            } else if (software === 'unknown') {
                this.warning =
                    `${host} responds, but reports no compatible API version. ` +
                    `Feeds may not load unless it supports the Lemmy or PieFed API.`
            }
            this.site = site
            await rememberServer(host, site.name || host, software)
            setInstance(host)
            this.saved = true
        } catch (e) {
            this.error = e instanceof Error ? e.message : String(e)
        } finally {
            this.validating = false
        }
    }

    private onMakeActive(server: ServerRecord): void {
        activateServer(server)
    }

    private onRemove(server: ServerRecord): void {
        void removeServer(server.host).catch((error) => console.error('removeServer failed', error))
    }

    private async onPopularTap(server: PopularServer): Promise<void> {
        this.busyHost = server.host
        this.error = ''
        this.warning = ''
        this.saved = false
        try {
            const {site, software} = await fetchSite(server.host)
            this.site = site
            await rememberServer(server.host, site.name || server.name, software)
            setInstance(server.host)
            this.saved = true
        } catch (e) {
            this.error = `${server.name}: ${e instanceof Error ? e.message : String(e)}`
        } finally {
            this.busyHost = null
        }
    }

    private async onClearCache(): Promise<void> {
        this.clearing = true
        await clearCaches()
        this.clearing = false
    }

    private renderServerRow(server: ServerRecord): TemplateResult {
        const active = server.host === this.settings.instance
        const softwareLabel =
            server.software === 'piefed' ? 'PieFed' : server.software === 'lemmy' ? 'Lemmy' : 'Unknown'
        return html`
            <div class="server-row${active ? ' active' : ''}">
                <span class="server-main">
                    <span class="server-name">${server.name}</span>
                    <span class="server-host">${server.host} · ${softwareLabel}</span>
                </span>
                ${active
                    ? html`<span class="active-mark">Active</span>`
                    : html`<button class="row-button" @click=${() => this.onMakeActive(server)}>Make active</button>`}
                <button class="row-button danger" title="Remove server and its saved login" @click=${() => this.onRemove(server)}>
                    Remove
                </button>
            </div>
        `
    }

    private renderPopular(servers: PopularServer[]): TemplateResult {
        if (!servers.length) {
            return html`<p class="section-hint">The popular list is unavailable right now.</p>`
        }
        return html`
            <div class="popular-grid">
                ${servers.map(
                    (server) => html`
                        <button
                            class="popular-card"
                            .disabled=${this.busyHost !== null}
                            @click=${() => void this.onPopularTap(server)}
                        >
                            <span class="popular-main">
                                <span class="popular-name">${server.name}</span>
                                <span class="popular-host">${server.host}</span>
                            </span>
                            ${server.nsfw ? html`<span class="nsfw-badge">NSFW</span>` : nothing}
                            ${this.busyHost === server.host ? html`<span class="busy-dot"></span>` : nothing}
                        </button>
                    `,
                )}
            </div>
        `
    }

    private softwareLabel(): string | null {
        if (this.software === 'piefed') return 'PieFed'
        if (this.software === 'lemmy') return 'Lemmy'
        return null
    }

    private renderServersSection(siteName: string, label: string | null, version: string | undefined, servers: ServerRecord[]): TemplateResult {
        return html`<section class="section"><h2 class="section-title">Servers</h2><p class="section-hint">Add any Lemmy or PieFed server — it is validated before connecting. Saved servers and their logins live in this browser only; one server is active at a time.</p><div class="form-row"><input class="instance-input" type="text" placeholder="lemmy.world" .value=${this.input} @input=${this.onInput} @keydown=${(e: KeyboardEvent) => {if (e.key === 'Enter') void this.onSave()}}><button class="save-button" .disabled=${this.validating} @click=${() => void this.onSave()}>${this.validating ? 'Checking…' : 'Add server'}</button></div>${this.error ? html`<p class="form-error">${this.error}</p>` : nothing}${this.warning ? html`<p class="form-warning">${this.warning}</p>` : nothing}${this.saved ? html`<p class="form-ok">Connected. Feeds will reload.</p>` : nothing}<p class="section-hint">Connected to <strong>${siteName}</strong>${label && version ? ` · ${label} ${version}` : ''}</p>${servers.length ? html`<div class="server-list">${servers.map((server) => this.renderServerRow(server))}</div>` : nothing}</section>`
    }

    private renderPopularSection(): TemplateResult {
        return html`<section class="section"><h2 class="section-title">Popular servers</h2><p class="section-hint">A curated list, plus the current top Lemmy instances from the public registry. Tap one to connect.</p>${this.renderPopular(this.popularController.value.data ?? [])}</section>`
    }

    private renderStorageSection(): TemplateResult {
        return html`<section class="section"><h2 class="section-title">Storage</h2><p class="section-hint">Cached posts and communities are kept for 10 minutes and reused on load.</p><button class="save-button" .disabled=${this.clearing} @click=${() => void this.onClearCache()}>${this.clearing ? 'Clearing…' : 'Clear cached data'}</button></section>`
    }

    override render(): TemplateResult {
        const siteName = this.site?.name ?? this.settings.instance
        const servers = this.serversController.value.data ?? []
        return html`<div class="settings-page"><h1 class="page-title">Settings</h1>${this.renderServersSection(siteName, this.softwareLabel(), this.site?.version, servers)}${this.renderPopularSection()}${this.renderStorageSection()}<section class="section"><h2 class="section-title">Account</h2><p class="section-hint">Use the <strong>Log in</strong> button in the top bar to unlock Subscribed, Suggested, and Moderator feeds. Each server keeps its own session; you are logged into one at a time.</p></section></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-settings-view': SettingsView
    }
}
