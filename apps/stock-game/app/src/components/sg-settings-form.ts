import { LitElement, css, html } from 'lit'
import { property } from 'lit/decorators.js'
import { z } from 'zod'
import { symbolSchema, type GameConfig } from '@stock-game/shared'
import { defineElement } from './define'

export interface SettingsSubmitDetail {
  startingCashCents: number
  startDate: number
  provider: string
}

const PROVIDERS = ['yahoo', 'twelvedata', 'alphaVantage'] as const

const formSchema = z.object({
  startingCashCents: z.number().int().min(1),
  startDate: z.number().int(),
  provider: symbolSchema.or(z.enum(PROVIDERS)),
})

export class SgSettingsForm extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: 480px;
    }

    .field {
      margin-bottom: 14px;
    }

    label {
      display: block;
      color: var(--text-muted, #9aa4b2);
      font-size: 13px;
      margin-bottom: 6px;
    }

    input,
    select {
      width: 100%;
      font: inherit;
      color: var(--text, #e6edf3);
      background: var(--bg, #0d1117);
      border: 1px solid var(--border, #2a313c);
      border-radius: 8px;
      padding: 9px 12px;
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: var(--accent, #4f9cf9);
    }

    .hint {
      color: var(--text-muted, #9aa4b2);
      font-size: 12px;
      margin: 6px 0 0;
    }

    .error {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin: 8px 0;
    }

    button.submit {
      font: inherit;
      color: #fff;
      background: var(--accent, #4f9cf9);
      border: 1px solid var(--accent, #4f9cf9);
      border-radius: 8px;
      padding: 9px 22px;
      cursor: pointer;
      font-weight: 600;
    }

    button.submit:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `

  @property({ attribute: false }) config: GameConfig | null = null
  @property({ type: Boolean }) busy = false

  private error: string | undefined
  private startDateDraft = ''

  private get cashDraft(): string {
    return this.config !== null ? (this.config.startingCashCents / 100).toString() : ''
  }

  private onDateInput(event: Event): void {
    this.startDateDraft = (event.target as HTMLInputElement).value
  }

  private onSubmit(): void {
    this.error = undefined
    if (!this.config) return
    const cashInput = this.renderRoot.querySelector<HTMLInputElement>('#cash')?.value
    const provider = this.renderRoot.querySelector<HTMLSelectElement>('#provider')?.value
    const dateMs = this.startDateDraft
      ? Date.parse(`${this.startDateDraft}T00:00:00`)
      : this.config.startDate
    const cashCents = Math.round(Number(cashInput) * 100)

    const parsed = formSchema.safeParse({
      startingCashCents: cashCents,
      startDate: dateMs,
      provider,
    })
    if (!parsed.success || Number.isNaN(dateMs)) {
      this.error = 'Check the starting cash and start date values'
      return
    }
    this.dispatchEvent(
      new CustomEvent<SettingsSubmitDetail>('sg-config-submit', {
        detail: parsed.data,
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    if (!this.config) {
      return html`<p class="hint">Loading configuration…</p>`
    }
    const defaultDate = new Date(this.config.startDate).toISOString().slice(0, 10)
    return html`
      <div class="field">
        <label for="cash">Starting cash (USD)</label>
        <input id="cash" type="number" min="1" step="0.01" .value=${this.cashDraft} />
      </div>

      <div class="field">
        <label for="date">Game start date</label>
        <input
          id="date"
          type="date"
          .value=${this.startDateDraft || defaultDate}
          @input=${(event: Event) => this.onDateInput(event)}
        />
        <p class="hint">
          Backdated trades before this date are not possible; the portfolio chart starts here.
        </p>
      </div>

      <div class="field">
        <label for="provider">Price provider</label>
        <select id="provider">
          ${PROVIDERS.map(
            (provider) => html`
              <option value=${provider} ?selected=${this.config?.provider === provider}>
                ${provider}
              </option>
            `,
          )}
        </select>
        <p class="hint">
          Providers sit behind one interface; switching is instant. Key-based providers need their
          env vars set.
        </p>
      </div>

      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      <button class="submit" type="button" ?disabled=${this.busy} @click=${() => this.onSubmit()}>
        Save configuration
      </button>
    `
  }
}

defineElement('sg-settings-form', SgSettingsForm)
