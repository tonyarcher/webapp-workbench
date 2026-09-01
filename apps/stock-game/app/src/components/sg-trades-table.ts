import { LitElement, html } from 'lit'
import type { TemplateResult } from 'lit'
import type { Trade } from '@stock-game/shared'
import { fmtDate, fmtMoney, fmtNumber, fmtPrice } from '../lib/format'
import { tableStyles } from './shared-styles'
import { defineElement } from './define'

export class SgTradesTable extends LitElement {
  static override styles = tableStyles

  static override properties = {
    trades: { attribute: false },
  }

  trades: Trade[] = []

  private renderEmpty(): TemplateResult {
    return html`<p class="muted">No trades yet. Place one from the Trade page.</p>`
  }

  private renderTradeRow(trade: Trade): TemplateResult {
    return html`<tr>
      <td>${fmtDate(trade.executedAt)}</td>
      <td>${trade.symbol}</td>
      <td class=${trade.side === 'buy' ? 'positive' : 'negative'}>${trade.side}</td>
      <td class="num">${fmtNumber(trade.qty)}</td>
      <td class="num">${fmtPrice(trade.price)}</td>
      <td class="num">${fmtMoney(Math.abs(trade.cashDeltaCents))}</td>
      <td>${trade.mode}</td>
    </tr>`
  }

  private renderTable(): TemplateResult {
    return html`<table class="sg-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Symbol</th>
          <th>Side</th>
          <th class="num">Shares</th>
          <th class="num">Price</th>
          <th class="num">Value</th>
          <th>Mode</th>
        </tr>
      </thead>
      <tbody>
        ${this.trades.map((trade) => this.renderTradeRow(trade))}
      </tbody>
    </table>`
  }

  override render(): TemplateResult {
    if (this.trades.length === 0) return this.renderEmpty()
    return this.renderTable()
  }
}

defineElement('sg-trades-table', SgTradesTable)
