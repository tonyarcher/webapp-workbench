import { LitElement, css, html } from 'lit'
import { property } from 'lit/decorators.js'
import type { PropertyValues } from 'lit'
import {
  placeOrderRequestSchema,
  placeTradeRequestSchema,
  type HoldingsEntry,
  type PlaceOrderRequest,
  type PlaceTradeRequest,
  type Quote,
  type Side,
  type SymbolSearchResult,
  type TradeMode,
} from '@stock-game/shared'
import { fmtMoney, fmtPrice } from '../lib/format'
import { SgSymbolSearch } from './sg-symbol-search'
import { defineElement } from './define'

type SubmitDetail = { mode: 'backdated'; data: PlaceTradeRequest } | { mode: 'scheduled'; data: PlaceOrderRequest }

export class SgTradeForm extends LitElement {
  static override styles = css`
    :host {
      display: block;
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

    input[type='number'],
    input[type='datetime-local'] {
      width: 100%;
      font: inherit;
      color: var(--text, #e6edf3);
      background: var(--bg, #0d1117);
      border: 1px solid var(--border, #2a313c);
      border-radius: 8px;
      padding: 9px 12px;
    }

    input:focus {
      outline: none;
      border-color: var(--accent, #4f9cf9);
    }

    .segmented {
      display: inline-flex;
      gap: 4px;
      background: var(--bg, #0d1117);
      border: 1px solid var(--border, #2a313c);
      border-radius: 8px;
      padding: 3px;
    }

    .segmented button {
      border: none;
      background: transparent;
      color: var(--text-muted, #9aa4b2);
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .segmented button.active-buy {
      background: var(--positive, #3fb950);
      color: #0d1117;
    }

    .segmented button.active-sell {
      background: var(--negative, #f85149);
      color: #fff;
    }

    .segmented button.active-mode {
      background: var(--accent, #4f9cf9);
      color: #fff;
    }

    .info {
      margin: 12px 0;
      font-size: 14px;
    }

    .warning {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin: 8px 0;
    }

    .error {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin: 8px 0;
    }

    .muted {
      color: var(--text-muted, #9aa4b2);
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

  @property({ attribute: false }) results: SymbolSearchResult[] = []
  @property({ attribute: false }) quote: Quote | null = null
  @property({ type: Number }) cashCents = 0
  @property({ attribute: false }) holdings: HoldingsEntry[] = []
  @property({ type: Boolean }) busy = false
  @property({ type: String }) symbol = ''

  private typedSymbol = ''
  private side: Side = 'buy'
  private qty = 1
  private mode: TradeMode = 'backdated'
  private when = ''
  private error: string | undefined

  override firstUpdated(): void {
    this.applyExternalSymbol()
  }

  override updated(changed: PropertyValues): void {
    if (changed.has('symbol')) this.applyExternalSymbol()
  }

  private applyExternalSymbol(): void {
    if (this.symbol === '') return
    this.typedSymbol = this.symbol
    const search = this.renderRoot.querySelector('sg-symbol-search')
    if (search !== null) (search as SgSymbolSearch).value = this.symbol
  }

  private onSymbolTyped(event: CustomEvent<{ value: string }>): void {
    this.typedSymbol = event.detail.value
  }

  private onSymbolSelected(event: CustomEvent<SymbolSearchResult>): void {
    this.typedSymbol = event.detail.symbol
  }

  private onSubmit(): void {
    this.error = undefined
    const symbol = this.typedSymbol.trim().toUpperCase()
    if (!symbol) {
      this.error = 'Enter a symbol'
      return
    }
    if (!Number.isInteger(this.qty) || this.qty <= 0) {
      this.error = 'Enter a positive whole number of shares'
      return
    }
    const ms = Date.parse(this.when)
    if (Number.isNaN(ms)) {
      this.error = 'Enter a valid date and time'
      return
    }
    if (this.mode === 'backdated') {
      const parsed = placeTradeRequestSchema.safeParse({ symbol, side: this.side, qty: this.qty, at: ms })
      if (!parsed.success) {
        this.error = 'Invalid trade details'
        return
      }
      this.emit({ mode: 'backdated', data: parsed.data })
    } else {
      if (ms <= Date.now()) {
        this.error = 'Scheduled execution time must be in the future'
        return
      }
      const parsed = placeOrderRequestSchema.safeParse({ symbol, side: this.side, qty: this.qty, executeAt: ms })
      if (!parsed.success) {
        this.error = 'Invalid order details'
        return
      }
      this.emit({ mode: 'scheduled', data: parsed.data })
    }
  }

  private emit(detail: SubmitDetail): void {
    this.dispatchEvent(
      new CustomEvent('sg-trade-submit', { detail, bubbles: true, composed: true }),
    )
  }

  private get heldQty(): number {
    const symbol = this.typedSymbol.trim().toUpperCase()
    if (!symbol) return 0
    return this.holdings.find((holding) => holding.symbol === symbol)?.qty ?? 0
  }

  private get estimatedCostCents(): number | undefined {
    if (!this.quote) return undefined
    return Math.round(this.qty * this.quote.price * 100)
  }

  override render() {
    const cost = this.estimatedCostCents
    const buying = this.side === 'buy'
    const affordable = cost !== undefined ? cost <= this.cashCents : undefined
    const canSell = this.heldQty >= this.qty
    const warn =
      cost !== undefined
        ? buying
          ? affordable === false
            ? 'Not enough cash for this order'
            : undefined
          : !canSell
            ? `Only ${this.heldQty} share(s) of ${this.symbol.trim().toUpperCase()} held`
            : undefined
        : undefined

    return html`
      <div class="field">
        <label>Symbol</label>
        <sg-symbol-search
          .results=${this.results}
          @sg-symbol-input=${(event: CustomEvent<{ value: string }>) => this.onSymbolTyped(event)}
          @sg-symbol-select=${(event: CustomEvent<SymbolSearchResult>) =>
            this.onSymbolSelected(event)}
        ></sg-symbol-search>
      </div>

      <div class="field">
        <label>Side</label>
        <div class="segmented">
          <button
            type="button"
            class=${this.side === 'buy' ? 'active-buy' : ''}
            @click=${() => {
              this.side = 'buy'
            }}
          >
            Buy
          </button>
          <button
            type="button"
            class=${this.side === 'sell' ? 'active-sell' : ''}
            @click=${() => {
              this.side = 'sell'
            }}
          >
            Sell
          </button>
        </div>
      </div>

      <div class="field">
        <label>Mode</label>
        <div class="segmented">
          <button
            type="button"
            class=${this.mode === 'backdated' ? 'active-mode' : ''}
            @click=${() => {
              this.mode = 'backdated'
            }}
          >
            Backdated
          </button>
          <button
            type="button"
            class=${this.mode === 'scheduled' ? 'active-mode' : ''}
            @click=${() => {
              this.mode = 'scheduled'
            }}
          >
            Scheduled
          </button>
        </div>
        <p class="muted" style="font-size:12px;margin:6px 0 0;color:var(--text-muted,#9aa4b2)">
          ${this.mode === 'backdated'
            ? 'Fills at the close of the trading day on/after the chosen date.'
            : 'Fills when the market quote updates at the chosen future time.'}
        </p>
      </div>

      <div class="field">
        <label>Shares</label>
        <input
          type="number"
          min="1"
          step="1"
          .value=${String(this.qty)}
          @input=${(event: Event) => {
            this.qty = Number((event.target as HTMLInputElement).value)
          }}
        />
      </div>

      <div class="field">
        <label>${this.mode === 'backdated' ? 'Trade date/time' : 'Execute at'}</label>
        <input
          type="datetime-local"
          .value=${this.when}
          @input=${(event: Event) => {
            this.when = (event.target as HTMLInputElement).value
          }}
        />
      </div>

      <div class="info">
        ${this.quote
          ? html`
              <div>
                ${this.quote.name} — ${fmtPrice(this.quote.price)}
                ${cost !== undefined ? html` · Est. ${fmtMoney(cost)}` : ''}
              </div>
            `
          : html`<span class="muted">Select a symbol to see the current price.</span>`}
        <div class="muted">Cash available: ${fmtMoney(this.cashCents)}</div>
      </div>

      ${warn ? html`<div class="warning">${warn}</div>` : ''}
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}

      <button class="submit" type="button" ?disabled=${this.busy} @click=${() => this.onSubmit()}>
        ${this.mode === 'backdated' ? 'Place trade' : 'Schedule order'}
      </button>
    `
  }
}

defineElement('sg-trade-form', SgTradeForm)
