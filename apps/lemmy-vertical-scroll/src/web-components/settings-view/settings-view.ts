import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {clearCaches, setInstance} from '../../mutations'
import {fetchSite, normalizeInstanceUrl} from '../../services/lemmy'
import type {LemmySite, Settings, Software} from '../../types'
import styles from './settings-view.css?inline'

@customElement('lvs-settings-view')
export class SettingsView extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) settings!: Settings
    @property({attribute: false}) site: LemmySite | null = null
    @property({attribute: false}) software: Software = 'unknown'

    private input = ''
    private error = ''
    private warning = ''
    private saved = false
    private validating = false
    private clearing = false

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
        const instance = normalizeInstanceUrl(this.input)
        if (!instance) {
            this.error = 'That does not look like a valid instance URL (try lemmy.ml).'
            return
        }
        this.validating = true
        this.error = ''
        this.warning = ''
        try {
            const {site, software} = await fetchSite(instance)
            if (software === 'piefed') {
                this.warning = `${instance} runs PieFed — feeds will use PieFed's own API.`
            } else if (software === 'unknown') {
                this.warning =
                    `${instance} responds, but reports no compatible API version. ` +
                    `Feeds may not load unless it supports the Lemmy or PieFed API.`
            }
            this.site = site
        } catch (e) {
            this.error = e instanceof Error ? e.message : String(e)
            this.validating = false
            return
        }
        this.validating = false
        setInstance(instance)
        this.saved = true
    }

    private async onClearCache(): Promise<void> {
        this.clearing = true
        await clearCaches()
        this.clearing = false
    }

    override render(): TemplateResult {
        const siteName = this.site?.name ?? this.settings.instance
        const softwareLabel =
            this.software === 'piefed' ? 'PieFed' : this.software === 'lemmy' ? 'Lemmy' : null
        const version = this.site?.version
        return html`
            <div class="settings-page">
                <h1 class="page-title">Settings</h1>

                <section class="section">
                    <h2 class="section-title">Instance</h2>
                    <p class="section-hint">
                        Every feed is fetched from one Lemmy instance. Anonymous access, no account needed.
                    </p>
                    <div class="form-row">
                        <input
                            class="instance-input"
                            type="text"
                            placeholder="lemmy.ml"
                            .value=${this.input}
                            @input=${this.onInput}
                            @keydown=${(e: KeyboardEvent) => {
                                if (e.key === 'Enter') void this.onSave()
                            }}
                        />
                        <button class="save-button" .disabled=${this.validating} @click=${() => void this.onSave()}>
                            ${this.validating ? 'Checking…' : 'Save'}
                        </button>
                    </div>
                    ${this.error ? html`<p class="form-error">${this.error}</p>` : nothing}
                    ${this.warning ? html`<p class="form-warning">${this.warning}</p>` : nothing}
                    ${this.saved ? html`<p class="form-ok">Instance updated. Feeds will reload.</p>` : nothing}
                    <p class="section-hint">
                        Connected to <strong>${siteName}</strong>${softwareLabel && version ? ` · ${softwareLabel} ${version}` : ''}
                    </p>
                </section>

                <section class="section">
                    <h2 class="section-title">Storage</h2>
                    <p class="section-hint">Cached posts and communities are kept for 10 minutes and reused on load.</p>
                    <button class="save-button" .disabled=${this.clearing} @click=${() => void this.onClearCache()}>
                        ${this.clearing ? 'Clearing…' : 'Clear cached data'}
                    </button>
                </section>

                <section class="section">
                    <h2 class="section-title">Roadmap</h2>
                    <p class="section-hint">Logged-in feeds (Subscribed, your user feed) are planned for a later version.</p>
                </section>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-settings-view': SettingsView
    }
}
