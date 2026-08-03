import { LitElement, html } from 'lit'
import { property } from 'lit/decorators.js'
import type { Order } from '@stock-game/shared'
import { fmtDateTime, fmtNumber } from '../lib/format'
import { tableStyles } from './shared-styles'
import { defineElement } from './define'

export class SgOrdersTable extends LitElement {
  static override styles = tableStyles

  @property({ attribute: false }) orders: Order[] = []
  @property({ type: Boolean }) busy = false

  private onCancel(orderId: number): void {
    this.dispatchEvent(
      new CustomEvent('sg-order-cancel', {
        detail: { id: orderId },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    if (this.orders.length === 0) {
      return html`<p class="muted">No scheduled orders.</p>`
    }
    return html`
      <table class="sg-table">
        <thead>
          <tr>
            <th>Execute At</th>
            <th>Symbol</th>
            <th>Side</th>
            <th class="num">Shares</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.orders.map(
            (order) => html`
              <tr>
                <td>${fmtDateTime(order.executeAt)}</td>
                <td>${order.symbol}</td>
                <td class=${order.side === 'buy' ? 'positive' : 'negative'}>
                  ${order.side}
                </td>
                <td class="num">${fmtNumber(order.qty)}</td>
                <td>${order.status}</td>
                <td>
                  ${order.status === 'pending'
                    ? html`
                        <button ?disabled=${this.busy} @click=${() => this.onCancel(order.id)}>
                          Cancel
                        </button>
                      `
                    : ''}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `
  }
}

defineElement('sg-orders-table', SgOrdersTable)
