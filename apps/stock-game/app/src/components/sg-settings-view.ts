import { LitElement, css, html } from 'lit'
import type { TemplateResult } from 'lit'
import type { GameConfig } from '@stock-game/shared'
import { fetchConfig, saveConfig } from '../lib/api'
import { getQueryClient } from '../lib/queryClient'
import type { SettingsSubmitDetail } from './sg-settings-form'
import './sg-settings-form'
import { defineElement } from './define'

export class SgSettingsView extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    h1 {
      font-size: 22px;
      margin: 0 0 16px;
    }

    .card {
      background: var(--bg-elevated, #161b22);
      border: 1px solid var(--border, #2a313c);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .error {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin-top: 8px;
    }

    .positive {
      color: var(--positive, #3fb950);
    }
  `

  static override properties = {
    config: { attribute: false },
    busy: { attribute: false },
    error: { attribute: false },
    saved: { attribute: false },
  }

  config: GameConfig | null = null
  busy = false
  error: string | null = null
  saved = false

  override connectedCallback(): void {
    super.connectedCallback()
    void this.load()
  }

  private async load(): Promise<void> {
    try {
      const config = await getQueryClient().fetchQuery({
        queryKey: ['config'],
        queryFn: () => fetchConfig(),
      })
      if (this.isConnected) this.config = config
    } catch (err) {
      if (this.isConnected) this.error = err instanceof Error ? err.message : String(err)
    }
  }

  private setError(err: unknown): void {
    this.error = err instanceof Error ? err.message : String(err)
  }

  private async onSubmit(event: CustomEvent<SettingsSubmitDetail>): Promise<void> {
    if (this.busy) return
    this.busy = true
    this.error = null
    this.saved = false
    try {
      await saveConfig(event.detail)
    } catch (err) {
      if (this.isConnected) {
        this.setError(err)
        this.busy = false
      }
      return
    }
    if (this.isConnected) this.saved = true
    await this.refreshAfterSave()
  }

  private async refreshAfterSave(): Promise<void> {
    const client = getQueryClient()
    await client.invalidateQueries({ queryKey: ['config'] })
    await client.invalidateQueries({ queryKey: ['portfolio'] })
    await client.invalidateQueries({ queryKey: ['holdings'] })
    try {
      const config = await client.fetchQuery({ queryKey: ['config'], queryFn: () => fetchConfig() })
      if (this.isConnected) this.config = config
    } catch (err) {
      if (this.isConnected) this.setError(err)
    }
    if (this.isConnected) this.busy = false
  }

  override render(): TemplateResult {
    return html`
      <h1>Settings</h1>
      <div class="card">
        <sg-settings-form
          .config=${this.config}
          .busy=${this.busy}
          @sg-config-submit=${this.onSubmit}
        ></sg-settings-form>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        ${this.saved ? html`<div class="positive">Configuration saved.</div>` : ''}
      </div>
    `
  }
}

defineElement('sg-settings-view', SgSettingsView)
