import { LitElement, css, html } from 'lit'
import type { PropertyValues, TemplateResult } from 'lit'
import {
  placeOrderRequestSchema,
  placeTradeRequestSchema,
  type HoldingsEntry,
  type OrderType,
  type PlaceOrderRequest,
  type PlaceTradeRequest,
  type Quote,
  type Side,
  type SymbolSearchResult,
  type Tif,
  type TradeMode,
} from '@stock-game/shared'
import { fmtMoney, fmtPrice } from '../lib/format'
import { SgSymbolSearch } from './sg-symbol-search'
import { defineElement } from './define'

type SubmitDetail =
  | { mode: 'backdated'; data: PlaceTradeRequest }
  | { mode: 'scheduled'; data: PlaceOrderRequest }

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
    input[type='datetime-local'],
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

  static override properties = {
    results: { attribute: false },
    query: { type: String },
    quote: { attribute: false },
    cashCents: { type: Number },
    holdings: { attribute: false },
    busy: { type: Boolean },
    symbol: { type: String },
    searching: { type: Boolean },
    searchError: { attribute: false },
    quoteLoading: { type: Boolean },
    quoteError: { attribute: false },
  }

  results: SymbolSearchResult[] = []
  query = ''
  quote: Quote | null = null
  cashCents = 0
  holdings: HoldingsEntry[] = []
  busy = false
  symbol = ''
  searching = false
  searchError: string | null = null
  quoteLoading = false
  quoteError: string | null = null

  private typedSymbol = ''
  private side: Side = 'buy'
  private qty = 1
  private mode: TradeMode = 'backdated'
  private when = ''
  private orderType: OrderType = 'market'
  private tif: Tif = 'GTC'
  private limitPrice: number | undefined
  private stopPrice: number | undefined
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

  private getSymbol(): string | undefined {
    const symbol = this.typedSymbol.trim().toUpperCase()
    if (!symbol) {
      this.error = 'Enter a symbol'
      return undefined
    }
    return symbol
  }

  private getValidatedQty(): number | undefined {
    if (!Number.isInteger(this.qty) || this.qty <= 0) {
      this.error = 'Enter a positive whole number of shares'
      return undefined
    }
    return this.qty
  }

  private getValidatedTime(): number | undefined {
    const ms = Date.parse(this.when)
    if (Number.isNaN(ms)) {
      this.error = 'Enter a valid date and time'
      return undefined
    }
    return ms
  }

  private buildBackdatedPayload(symbol: string, qty: number, ms: number): Record<string, unknown> {
    const payload: Record<string, unknown> = { symbol, side: this.side, qty, at: ms, orderType: this.orderType }
    if (this.limitPrice !== undefined) payload['limitPrice'] = this.limitPrice
    if (this.stopPrice !== undefined) payload['stopPrice'] = this.stopPrice
    return payload
  }

  private submitBackdated(symbol: string, qty: number, ms: number): void {
    const parsed = placeTradeRequestSchema.safeParse(this.buildBackdatedPayload(symbol, qty, ms))
    if (!parsed.success) {
      this.error = 'Invalid trade details'
      return
    }
    this.emit({ mode: 'backdated', data: parsed.data })
  }

  private buildScheduledPayload(symbol: string, qty: number, ms: number): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      symbol,
      side: this.side,
      qty,
      executeAt: ms,
      orderType: this.orderType,
      tif: this.tif,
    }
    if (this.limitPrice !== undefined) payload['limitPrice'] = this.limitPrice
    if (this.stopPrice !== undefined) payload['stopPrice'] = this.stopPrice
    return payload
  }

  private submitScheduled(symbol: string, qty: number, ms: number): void {
    if (ms <= Date.now()) {
      this.error = 'Scheduled execution time must be in the future'
      return
    }
    const parsed = placeOrderRequestSchema.safeParse(this.buildScheduledPayload(symbol, qty, ms))
    if (!parsed.success) {
      this.error = 'Invalid order details'
      return
    }
    this.emit({ mode: 'scheduled', data: parsed.data })
  }

  private onSubmit(): void {
    this.error = undefined
    const symbol = this.getSymbol()
    if (symbol === undefined) return
    const qty = this.getValidatedQty()
    if (qty === undefined) return
    const ms = this.getValidatedTime()
    if (ms === undefined) return
    if (this.mode === 'backdated') this.submitBackdated(symbol, qty, ms)
    else this.submitScheduled(symbol, qty, ms)
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

  private renderSymbolField(): TemplateResult {
    return html`<div class="field">
      <label>Symbol</label>
      <sg-symbol-search
        .results=${this.results}
        .query=${this.query}
        .searching=${this.searching}
        .error=${this.searchError}
        @sg-symbol-input=${(event: CustomEvent<{ value: string }>) => this.onSymbolTyped(event)}
        @sg-symbol-select=${(event: CustomEvent<SymbolSearchResult>) =>
          this.onSymbolSelected(event)}
      ></sg-symbol-search>
    </div>`
  }

  private sideClass(side: Side): string {
    if (side === 'buy' || side === 'cover') return 'active-buy'
    return 'active-sell'
  }

  private renderSideField(): TemplateResult {
    return html`<div class="field">
      <label>Side</label>
      <div class="segmented">
        <button type="button" class=${this.side === 'buy' ? this.sideClass('buy') : ''} @click=${() => { this.side = 'buy' }}>Buy</button>
        <button type="button" class=${this.side === 'sell' ? this.sideClass('sell') : ''} @click=${() => { this.side = 'sell' }}>Sell</button>
        <button type="button" class=${this.side === 'short' ? this.sideClass('short') : ''} @click=${() => { this.side = 'short' }}>Short</button>
        <button type="button" class=${this.side === 'cover' ? this.sideClass('cover') : ''} @click=${() => { this.side = 'cover' }}>Cover</button>
      </div>
    </div>`
  }

  private renderOrderTypeField(): TemplateResult {
    return html`<div class="field">
      <label>Order type</label>
      <select .value=${this.orderType} @change=${(e: Event) => { this.orderType = (e.target as HTMLSelectElement).value as OrderType }}>
        <option value="market">Market</option>
        <option value="limit">Limit</option>
        <option value="stop">Stop</option>
        <option value="stopLimit">Stop-limit</option>
      </select>
    </div>`
  }

  private renderTifField(): TemplateResult {
    if (this.mode !== 'scheduled') return html``
    return html`<div class="field">
      <label>Time in force</label>
      <div class="segmented">
        <button type="button" class=${this.tif === 'DAY' ? 'active-mode' : ''} @click=${() => { this.tif = 'DAY' }}>Day</button>
        <button type="button" class=${this.tif === 'GTC' ? 'active-mode' : ''} @click=${() => { this.tif = 'GTC' }}>GTC</button>
      </div>
    </div>`
  }

  private renderPriceFields(): TemplateResult {
    const showLimit = this.orderType === 'limit' || this.orderType === 'stopLimit'
    const showStop = this.orderType === 'stop' || this.orderType === 'stopLimit'
    return html`${showLimit
      ? html`<div class="field"><label>Limit price</label><input type="number" min="0" step="0.01" .value=${this.limitPrice !== undefined ? String(this.limitPrice) : ''} @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.limitPrice = v ? Number(v) : undefined }} /></div>`
      : ''}${showStop
      ? html`<div class="field"><label>Stop price</label><input type="number" min="0" step="0.01" .value=${this.stopPrice !== undefined ? String(this.stopPrice) : ''} @input=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.stopPrice = v ? Number(v) : undefined }} /></div>`
      : ''}`
  }

  private renderModeField(): TemplateResult {
    return html`<div class="field">
      <label>Mode</label>
      <div class="segmented">
        <button type="button" class=${this.mode === 'backdated' ? 'active-mode' : ''} @click=${() => { this.mode = 'backdated' }}>Backdated</button>
        <button type="button" class=${this.mode === 'scheduled' ? 'active-mode' : ''} @click=${() => { this.mode = 'scheduled' }}>Scheduled</button>
      </div>
      <p class="muted" style="font-size:12px;margin:6px 0 0;color:var(--text-muted,#9aa4b2)">
        ${this.mode === 'backdated'
          ? 'Fills at the close of the trading day on/after the chosen date.'
          : 'Fills when the market quote updates at the chosen future time.'}
      </p>
    </div>`
  }

  private renderSharesField(): TemplateResult {
    return html`<div class="field">
      <label>Shares</label>
      <input type="number" min="1" step="1" .value=${String(this.qty)} @input=${(event: Event) => { this.qty = Number((event.target as HTMLInputElement).value) }} />
    </div>`
  }

  private renderWhenField(): TemplateResult {
    return html`<div class="field">
      <label>${this.mode === 'backdated' ? 'Trade date/time' : 'Execute at'}</label>
      <input type="datetime-local" .value=${this.when} @input=${(event: Event) => { this.when = (event.target as HTMLInputElement).value }} />
    </div>`
  }

  private renderQuoteContent(cost: number | undefined): TemplateResult {
    if (this.quote) {
      return html`<div>
        ${this.quote.name} — ${fmtPrice(this.quote.price)}
        ${cost !== undefined ? html` · Est. ${fmtMoney(cost)}` : ''}
      </div>`
    }
    if (this.quoteError !== null) return html`<span class="error">${this.quoteError}</span>`
    if (this.quoteLoading) return html`<span class="muted">Loading quote…</span>`
    return html`<span class="muted">Select a symbol to see the current price.</span>`
  }

  private renderInfo(cost: number | undefined): TemplateResult {
    return html`<div class="info">
      ${this.renderQuoteContent(cost)}
      <div class="muted">Cash available: ${fmtMoney(this.cashCents)}</div>
    </div>`
  }

  private getWarning(cost: number | undefined): string | undefined {
    if (cost === undefined) return undefined
    if (this.side === 'buy' || this.side === 'cover') {
      if (cost > this.cashCents) return 'Not enough cash for this order'
      return undefined
    }
    if (this.side !== 'sell') return undefined
    const held = Math.max(0, this.heldQty)
    if (held < this.qty) return `Only ${held} share(s) held`
    return undefined
  }

  override render(): TemplateResult {
    const cost = this.estimatedCostCents
    const warn = this.getWarning(cost)
    return html`
      ${this.renderSymbolField()} ${this.renderSideField()} ${this.renderOrderTypeField()} ${this.renderTifField()} ${this.renderPriceFields()} ${this.renderModeField()}
      ${this.renderSharesField()} ${this.renderWhenField()} ${this.renderInfo(cost)}
      ${warn ? html`<div class="warning">${warn}</div>` : ''}
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
      <button class="submit" type="button" ?disabled=${this.busy} @click=${() => this.onSubmit()}>
        ${this.mode === 'backdated' ? 'Place trade' : 'Schedule order'}
      </button>
    `
  }
}

defineElement('sg-trade-form', SgTradeForm)
