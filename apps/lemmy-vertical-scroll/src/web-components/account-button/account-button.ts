import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {login as commitLogin, logout as commitLogout} from '../../mutations'
import {authQuery, QueryController} from '../../query'
import {login as loginRequest} from '../../services/auth'
import type {AuthSession, Software} from '../../types'
import styles from './account-button.css?inline'

@customElement('lvs-account-button')
export class AccountButton extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) instance = ''
    @property({attribute: false}) software: Software = 'unknown'

    private readonly authController = new QueryController<AuthSession | null>(this, () => authQuery(this.instance))

    @state() private open = false
    @state() private error = ''
    @state() private busy = false
    private username = ''
    private password = ''
    private totp = ''

    override connectedCallback(): void {
        super.connectedCallback()
        document.addEventListener('pointerdown', this.onDocumentPointerDown)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    }

    /**
     * Stable identity so the listener can be removed; closes the dropdown on outside taps.
     * Uses composedPath() because event.target is retargeted to the shadow host for
     * listeners outside the shadow root, which would falsely treat inside-clicks as "outside".
     */
    private readonly onDocumentPointerDown = (event: PointerEvent): void => {
        if (!this.open) return
        if (event.composedPath().includes(this)) return
        this.open = false
    }

    override updated(changed: Map<string, unknown>): void {
        super.updated(changed)
        if (changed.has('open') && this.open) {
            const input = this.renderRoot.querySelector<HTMLInputElement>('.account-username')
            input?.focus()
        }
    }

    private onToggle(): void {
        this.open = !this.open
        this.error = ''
    }

    private onUsernameInput(event: Event): void {
        this.username = (event.target as HTMLInputElement).value
        this.error = ''
    }

    private onPasswordInput(event: Event): void {
        this.password = (event.target as HTMLInputElement).value
        this.error = ''
    }

    private onTotpInput(event: Event): void {
        this.totp = (event.target as HTMLInputElement).value
    }

    private async onSubmit(): Promise<void> {
        const username = this.username.trim()
        if (!username || !this.password) {
            this.error = 'Enter your username and password.'
            return
        }
        this.busy = true
        this.error = ''
        try {
            const session = await loginRequest(this.instance, this.software, username, this.password, this.totp.trim() || undefined)
            commitLogin(this.instance, session)
            this.open = false
            this.username = ''
            this.password = ''
            this.totp = ''
        } catch (e) {
            this.error = e instanceof Error ? e.message : String(e)
        } finally {
            this.busy = false
        }
    }

    private onLogout(): void {
        void commitLogout(this.instance)
        this.open = false
    }

    private renderLoggedIn(session: AuthSession): TemplateResult {
        return html`<div class="account logged-in"><span class="account-name" title="Logged in to ${this.instance}">${session.username}</span><button class="logout-button" @click=${this.onLogout}>Log out</button></div>`
    }

    private renderTotp(): TemplateResult {
        if (this.software === 'piefed') return html``
        return html`<input class="account-totp" type="text" inputmode="numeric" placeholder="2FA code (optional)" autocomplete="one-time-code" .value=${this.totp} @input=${this.onTotpInput}>`
    }

    private renderDropdown(): TemplateResult {
        if (!this.open) return html``
        return html`<form class="login-dropdown" @submit=${(e: Event) => {e.preventDefault(); void this.onSubmit()}}><input class="account-username" type="text" placeholder="Username or email" autocomplete="username" .value=${this.username} @input=${this.onUsernameInput}><input class="account-password" type="password" placeholder="Password" autocomplete="current-password" .value=${this.password} @input=${this.onPasswordInput}>${this.renderTotp()}${this.error ? html`<p class="account-error">${this.error}</p>` : nothing}<button class="login-submit" type="submit" .disabled=${this.busy}>${this.busy ? 'Logging in…' : 'Log in'}</button></form>`
    }

    override render(): TemplateResult {
        const session = this.authController.value.data
        if (session) return this.renderLoggedIn(session)
        const disabled = this.software === 'unknown' || !this.instance
        return html`<div class="account"><button class="login-toggle${this.open ? ' open' : ''}" aria-expanded=${this.open} title=${disabled ? 'Connect an instance first' : 'Log in to this instance'} .disabled=${disabled} @click=${this.onToggle}>Log in</button>${this.renderDropdown()}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-account-button': AccountButton
    }
}
