import { LitElement, html } from 'lit'
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

  override render() {
    if (this.trades.length === 0) {
      return html`<p class="muted">No trades yet. Place one from the Trade page.</p>`
    }
    return html`
      <table class="sg-table">
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
          ${this.trades.map(
            (trade) => html`
              <tr>
                <td>${fmtDate(trade.executedAt)}</td>
                <td>${trade.symbol}</td>
                <td class=${trade.side === 'buy' ? 'positive' : 'negative'}>
                  ${trade.side}
                </td>
                <td class="num">${fmtNumber(trade.qty)}</td>
                <td class="num">${fmtPrice(trade.price)}</td>
                <td class="num">${fmtMoney(Math.abs(trade.cashDeltaCents))}</td>
                <td>${trade.mode}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `
  }
}

defineElement('sg-trades-table', SgTradesTable)
