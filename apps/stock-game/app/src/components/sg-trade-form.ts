import { LitElement, html } from 'lit'
import type { PropertyValues, TemplateResult } from 'lit'
import {
  defaultFillPriceSource,
  placeOrderRequestSchema,
  placeTradeRequestSchema,
  type FillPriceSource,
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
import { quoteFillPriceClient } from '../lib/quote-fill'
import { SgSymbolSearch } from './sg-symbol-search'
import { defineElement } from './define'
import { tradeFormStyles } from './sg-trade-form-styles'

type SubmitDetail =
  | { mode: 'backdated'; data: PlaceTradeRequest }
  | { mode: 'scheduled'; data: PlaceOrderRequest }

export class SgTradeForm extends LitElement {
  static override styles = tradeFormStyles

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
    commissionCents: { type: Number },
    quoteDelayMinutes: { type: Number },
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
  commissionCents = 0
  quoteDelayMinutes = 15

  private typedSymbol = ''
  private side: Side = 'buy'
  private qty = 1
  private mode: TradeMode = 'backdated'
  private when = ''
  private orderType: OrderType = 'market'
  private tif: Tif = 'GTC'
  private limitPrice: number | undefined
  private stopPrice: number | undefined
  private fillPriceSource: FillPriceSource = 'ask'
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

  private selectSide(side: Side): void {
    this.side = side
    this.fillPriceSource = defaultFillPriceSource(side)
    this.requestUpdate()
  }

  private selectMode(mode: TradeMode): void {
    this.mode = mode
    this.requestUpdate()
  }

  private selectFillSource(source: FillPriceSource): void {
    this.fillPriceSource = source
    this.requestUpdate()
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

  private buildScheduledPayload(symbol: string, qty: number, ms: number | undefined): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      symbol,
      side: this.side,
      qty,
      orderType: this.orderType,
      tif: this.tif,
      fillPriceSource: this.fillPriceSource,
    }
    if (ms !== undefined) payload['executeAt'] = ms
    if (this.limitPrice !== undefined) payload['limitPrice'] = this.limitPrice
    if (this.stopPrice !== undefined) payload['stopPrice'] = this.stopPrice
    return payload
  }

  private submitScheduled(symbol: string, qty: number, ms: number | undefined): void {
    if (ms !== undefined && ms <= Date.now()) {
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
    if (this.mode === 'backdated') this.handleBackdatedSubmit(symbol, qty)
    else this.handleScheduledSubmit(symbol, qty)
  }

  private handleBackdatedSubmit(symbol: string, qty: number): void {
    const ms = this.getValidatedTime()
    if (ms === undefined) return
    this.submitBackdated(symbol, qty, ms)
  }

  private handleScheduledSubmit(symbol: string, qty: number): void {
    if (this.when.trim() === '') {
      this.submitScheduled(symbol, qty, undefined)
      return
    }
    const ms = this.getValidatedTime()
    if (ms === undefined) return
    this.submitScheduled(symbol, qty, ms)
  }

  private emit(detail: SubmitDetail): void {
    this.dispatchEvent(new CustomEvent('sg-trade-submit', { detail, bubbles: true, composed: true }))
  }

  private get heldQty(): number {
    const symbol = this.typedSymbol.trim().toUpperCase()
    if (!symbol) return 0
    return this.holdings.find((holding) => holding.symbol === symbol)?.qty ?? 0
  }

  private get estimatedCostCents(): number | undefined {
    if (!this.quote) return undefined
    const price = this.mode === 'scheduled' ? quoteFillPriceClient(this.quote, this.fillPriceSource) : this.quote.price
    const base = Math.round(this.qty * price * 100)
    if (this.side === 'buy' || this.side === 'cover') return base + this.commissionCents
    return base
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
        @sg-symbol-select=${(event: CustomEvent<SymbolSearchResult>) => this.onSymbolSelected(event)}
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
        <button type="button" class=${this.side === 'buy' ? this.sideClass('buy') : ''} @click=${() => this.selectSide('buy')}>Buy</button>
        <button type="button" class=${this.side === 'sell' ? this.sideClass('sell') : ''} @click=${() => this.selectSide('sell')}>Sell</button>
        <button type="button" class=${this.side === 'short' ? this.sideClass('short') : ''} @click=${() => this.selectSide('short')}>Short</button>
        <button type="button" class=${this.side === 'cover' ? this.sideClass('cover') : ''} @click=${() => this.selectSide('cover')}>Cover</button>
      </div>
    </div>`
  }

  private renderOrderTypeField(): TemplateResult {
    return html`<div class="field">
      <label>Order type</label>
      <select .value=${this.orderType} @change=${(e: Event) => { this.orderType = (e.target as HTMLSelectElement).value as OrderType; this.requestUpdate() }}>
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
        <button type="button" class=${this.tif === 'DAY' ? 'active-mode' : ''} @click=${() => { this.tif = 'DAY'; this.requestUpdate() }}>Day</button>
        <button type="button" class=${this.tif === 'GTC' ? 'active-mode' : ''} @click=${() => { this.tif = 'GTC'; this.requestUpdate() }}>GTC</button>
      </div>
    </div>`
  }

  private renderFillSourceField(): TemplateResult {
    if (this.mode !== 'scheduled') return html``
    return html`<div class="field">
      <label>Fill price</label>
      <div class="segmented">
        <button type="button" class=${this.fillPriceSource === 'last' ? 'active-mode' : ''} @click=${() => this.selectFillSource('last')}>Last</button>
        <button type="button" class=${this.fillPriceSource === 'bid' ? 'active-mode' : ''} @click=${() => this.selectFillSource('bid')}>Bid</button>
        <button type="button" class=${this.fillPriceSource === 'ask' ? 'active-mode' : ''} @click=${() => this.selectFillSource('ask')}>Ask</button>
        <button type="button" class=${this.fillPriceSource === 'mid' ? 'active-mode' : ''} @click=${() => this.selectFillSource('mid')}>Mid</button>
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
        <button type="button" class=${this.mode === 'backdated' ? 'active-mode' : ''} @click=${() => this.selectMode('backdated')}>Backdated</button>
        <button type="button" class=${this.mode === 'scheduled' ? 'active-mode' : ''} @click=${() => this.selectMode('scheduled')}>Scheduled</button>
      </div>
      <p class="muted" style="font-size:12px;margin:6px 0 0;color:var(--text-muted,#9aa4b2)">
        ${this.mode === 'backdated'
          ? 'Fills at the close of the trading day on/after the chosen date.'
          : `Fills at the next NYSE open after a ${this.quoteDelayMinutes} minute delay (or at the chosen time if later). Optional later datetime.`}
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
    const label = this.mode === 'backdated' ? 'Trade date/time' : 'Execute at (optional — ASAP)'
    return html`<div class="field">
      <label>${label}</label>
      <input type="datetime-local" .value=${this.when} @input=${(event: Event) => { this.when = (event.target as HTMLInputElement).value }} />
    </div>`
  }

  private renderQuoteContent(cost: number | undefined): TemplateResult {
    if (this.quote) return this.renderQuoteDetails(cost)
    if (this.quoteError !== null) return html`<span class="error">${this.quoteError}</span>`
    if (this.quoteLoading) return html`<span class="muted">Loading quote…</span>`
    return html`<span class="muted">Select a symbol to see the current price.</span>`
  }

  private renderQuoteDetails(cost: number | undefined): TemplateResult {
    const q = this.quote
    if (q === null) return html`<span class="muted">Select a symbol to see the current price.</span>`
    const hasBidAsk = q.bid !== undefined || q.ask !== undefined
    const priceLine = hasBidAsk ? this.renderBidAskLine(q) : html`${fmtPrice(q.price)}`
    return html`<div>
      ${q.name} — ${priceLine}
      ${cost !== undefined ? html` · Est. ${fmtMoney(cost)}` : ''}
    </div>`
  }

  private renderBidAskLine(q: Quote): TemplateResult {
    const parts: string[] = []
    parts.push(`Last ${fmtPrice(q.price)}`)
    if (q.bid !== undefined) parts.push(`Bid ${fmtPrice(q.bid)}`)
    if (q.ask !== undefined) parts.push(`Ask ${fmtPrice(q.ask)}`)
    return html`${parts.join(' · ')}`
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
      ${this.renderSymbolField()} ${this.renderSideField()} ${this.renderOrderTypeField()} ${this.renderTifField()} ${this.renderFillSourceField()} ${this.renderPriceFields()} ${this.renderModeField()}
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
