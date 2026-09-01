import { LitElement, html } from 'lit'
import type { TemplateResult } from 'lit'
import type { Order } from '@stock-game/shared'
import { fmtDateTime, fmtNumber, fmtPrice } from '../lib/format'
import { tableStyles } from './shared-styles'
import { defineElement } from './define'

export class SgOrdersTable extends LitElement {
  static override styles = tableStyles

  static override properties = {
    orders: { attribute: false },
    busy: { type: Boolean },
  }

  orders: Order[] = []
  busy = false

  private onCancel(orderId: number): void {
    this.dispatchEvent(
      new CustomEvent('sg-order-cancel', {
        detail: { id: orderId },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private renderEmpty(): TemplateResult {
    return html`<p class="muted">No scheduled orders.</p>`
  }

  private renderCancel(order: Order): TemplateResult {
    if (order.status !== 'pending') return html``
    return html`<button ?disabled=${this.busy} @click=${() => this.onCancel(order.id)}>Cancel</button>`
  }

  private sideClass(side: string): string {
    if (side === 'buy' || side === 'cover') return 'positive'
    return 'negative'
  }

  private formatLimit(order: Order): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (order.limitPrice === null || order.limitPrice === undefined) return '-'
    return fmtPrice(order.limitPrice)
  }

  private formatStop(order: Order): string {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (order.stopPrice === null || order.stopPrice === undefined) return '-'
    return fmtPrice(order.stopPrice)
  }

  private renderOrderRow(order: Order): TemplateResult {
    return html`<tr>
      <td>${fmtDateTime(order.executeAt)}</td>
      <td>${order.symbol}</td>
      <td class=${this.sideClass(order.side)}>${order.side}</td>
      <td class="num">${fmtNumber(order.qty)}</td>
      <td>${order.orderType}</td>
      <td>${order.tif}</td>
      <td class="num">${this.formatLimit(order)}</td>
      <td class="num">${this.formatStop(order)}</td>
      <td>${order.status}</td>
      <td>${this.renderCancel(order)}</td>
    </tr>`
  }

  private renderTable(): TemplateResult {
    return html`<table class="sg-table">
      <thead>
        <tr>
          <th>Execute At</th>
          <th>Symbol</th>
          <th>Side</th>
          <th class="num">Shares</th>
          <th>Type</th>
          <th>TIF</th>
          <th class="num">Limit</th>
          <th class="num">Stop</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${this.orders.map((order) => this.renderOrderRow(order))}
      </tbody>
    </table>`
  }

  override render(): TemplateResult {
    if (this.orders.length === 0) return this.renderEmpty()
    return this.renderTable()
  }
}

defineElement('sg-orders-table', SgOrdersTable)
